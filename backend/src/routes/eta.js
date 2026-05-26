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

    // Real DTC API call
    const response = await axios.get(`${dtcApiUrl}/vehicles`, {
      headers: { 'Authorization': `Bearer ${dtcApiKey}`, 'Content-Type': 'application/json' },
      timeout: 10000
    });

    const pool = getPool();
    const warehouses = await pool.request()
      .query('SELECT WarehouseID, WarehouseName, GpsLat, GpsLng FROM WMS_Warehouses WHERE IsActive=1');

    const vehicles = response.data.vehicles || response.data.data || [];
    const result = vehicles.map(v => {
      const warehouseId = v.warehouseId;
      const warehouse = warehouses.recordset.find(w => w.WarehouseID === warehouseId);
      let distanceKm = null, etaMinutes = null, etaTime = null;

      if (warehouse?.GpsLat && warehouse?.GpsLng && v.lat && v.lng) {
        distanceKm = calculateDistance(v.lat, v.lng, warehouse.GpsLat, warehouse.GpsLng);
        const avgSpeedKmh = (v.speed > 10 ? v.speed : 60);
        etaMinutes = Math.round((distanceKm / avgSpeedKmh) * 60);
        const eta = new Date();
        eta.setMinutes(eta.getMinutes() + etaMinutes);
        etaTime = eta.toISOString();
      }

      return {
        vehicleId: v.vehicleId || v.id,
        licensePlate: v.licensePlate || v.plate,
        driverName: v.driverName || v.driver,
        lat: v.lat || v.latitude,
        lng: v.lng || v.longitude,
        speed: v.speed,
        status: v.status,
        warehouseName: warehouse?.WarehouseName,
        lastUpdate: v.lastUpdate || v.timestamp,
        address: v.address,
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
