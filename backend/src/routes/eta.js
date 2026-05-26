const express = require('express');
const router = express.Router();
const axios = require('axios');
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// Helper: calculate distance between two GPS coords (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// GET /api/eta/vehicles - Get all tracked vehicles from DTC GPS API
router.get('/vehicles', authenticate, async (req, res) => {
  try {
    const dtcApiUrl = process.env.DTC_API_URL;
    const dtcApiKey = process.env.DTC_API_KEY;

    if (!dtcApiUrl || !dtcApiKey || dtcApiKey === 'your_dtc_api_key_here') {
      // Return mock data for development
      const pool = getPool();
      const warehouses = await pool.request()
        .query('SELECT WarehouseID, WarehouseName, GpsLat, GpsLng FROM WMS_Warehouses WHERE IsActive=1');

      const mockVehicles = [
        {
          vehicleId: 'DTC001', licensePlate: 'กข-1234', driverName: 'สมชาย ใจดี',
          lat: 13.7563, lng: 100.5018, speed: 60, status: 'Moving',
          warehouseId: warehouses.recordset[0]?.WarehouseID || 1,
          warehouseName: warehouses.recordset[0]?.WarehouseName || 'คลัง 1',
          lastUpdate: new Date().toISOString(),
          address: 'ถนนสุขุมวิท กรุงเทพฯ'
        },
        {
          vehicleId: 'DTC002', licensePlate: 'คง-5678', driverName: 'สมหญิง รักดี',
          lat: 13.8500, lng: 100.5200, speed: 0, status: 'Stopped',
          warehouseId: warehouses.recordset[1]?.WarehouseID || 1,
          warehouseName: warehouses.recordset[1]?.WarehouseName || 'คลัง 2',
          lastUpdate: new Date().toISOString(),
          address: 'ถนนรังสิต ปทุมธานี'
        }
      ];

      // Calculate distance and ETA for each vehicle
      const result = mockVehicles.map(v => {
        const warehouse = warehouses.recordset.find(w => w.WarehouseID === v.warehouseId);
        let distanceKm = null;
        let etaMinutes = null;
        let etaTime = null;

        if (warehouse?.GpsLat && warehouse?.GpsLng) {
          distanceKm = calculateDistance(v.lat, v.lng, warehouse.GpsLat, warehouse.GpsLng);
          const avgSpeedKmh = v.speed > 10 ? v.speed : 60;
          etaMinutes = Math.round((distanceKm / avgSpeedKmh) * 60);
          const eta = new Date();
          eta.setMinutes(eta.getMinutes() + etaMinutes);
          etaTime = eta.toISOString();
        }

        return { ...v, distanceKm: distanceKm?.toFixed(1), etaMinutes, etaTime };
      });

      return res.json({ success: true, data: result, source: 'mock' });
    }

    // Real DTC API call — endpoint: GET /getlocation?TokenKey=KEY
    const response = await axios.get(`${dtcApiUrl}/getlocation`, {
      params: { TokenKey: dtcApiKey },
      timeout: 15000,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      validateStatus: () => true // don't throw on non-2xx
    });

    // DTC returns HTML "ไม่พบข้อมูล" when no vehicles are online
    const isJson = typeof response.data === 'object' || (typeof response.data === 'string' && response.data.trim().startsWith('['));
    if (!isJson || (Array.isArray(response.data) && response.data.length === 0)) {
      return res.json({ success: true, data: [], source: 'dtc', message: 'ไม่มีข้อมูลรถจาก DTC GPS ขณะนี้' });
    }

    const pool = getPool();
    const warehouses = await pool.request()
      .query('SELECT WarehouseID, WarehouseName, GpsLat, GpsLng FROM WMS_Warehouses WHERE IsActive=1');

    // DTC response fields: IMEI, PlateNo/VehicleName, Lat/Lng, Speed, DateTimeGPS, Address, EngineStatus
    const rawVehicles = Array.isArray(response.data) ? response.data : (response.data.data || []);
    const result = rawVehicles.map(v => {
      const lat = parseFloat(v.Lat || v.lat || v.latitude || 0);
      const lng = parseFloat(v.Lng || v.lng || v.longitude || 0);
      const speed = parseFloat(v.Speed || v.speed || 0);

      // Match vehicle to a warehouse by VehicleID or first warehouse as fallback
      const warehouseId = v.WarehouseID || v.warehouseId || warehouses.recordset[0]?.WarehouseID;
      const warehouse = warehouses.recordset.find(w => w.WarehouseID === warehouseId) || warehouses.recordset[0];

      let distanceKm = null, etaMinutes = null, etaTime = null;
      if (warehouse?.GpsLat && warehouse?.GpsLng && lat && lng) {
        distanceKm = calculateDistance(lat, lng, warehouse.GpsLat, warehouse.GpsLng);
        const avgSpeedKmh = speed > 10 ? speed : 60;
        etaMinutes = Math.round((distanceKm / avgSpeedKmh) * 60);
        const eta = new Date();
        eta.setMinutes(eta.getMinutes() + etaMinutes);
        etaTime = eta.toISOString();
      }

      return {
        vehicleId: v.IMEI || v.VehicleID || v.vehicleId || v.id,
        licensePlate: v.PlateNo || v.LicensePlate || v.licensePlate || v.plate || '-',
        driverName: v.DriverName || v.VehicleName || v.driverName || '-',
        lat, lng, speed,
        status: v.EngineStatus === 'ON' || speed > 0 ? 'Moving' : 'Stopped',
        warehouseId: warehouse?.WarehouseID,
        warehouseName: warehouse?.WarehouseName,
        lastUpdate: v.DateTimeGPS || v.DateTime || v.lastUpdate || v.timestamp || new Date().toISOString(),
        address: v.Address || v.address || '',
        distanceKm: distanceKm?.toFixed(1),
        etaMinutes,
        etaTime
      };
    });

    res.json({ success: true, data: result, source: 'dtc' });
  } catch (err) {
    console.error('ETA/GPS error:', err.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงข้อมูล GPS ได้: ' + err.message });
  }
});

// POST /api/eta/config - Update DTC API config (Admin only)
router.post('/config', authenticate, async (req, res) => {
  // Note: In production, store these in DB or secure vault
  res.json({ success: true, message: 'กรุณาตั้งค่า DTC_API_URL และ DTC_API_KEY ใน Environment Variables' });
});

module.exports = router;
