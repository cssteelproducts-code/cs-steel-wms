const express = require('express');
const router = express.Router();
const axios = require('axios');
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Haversine formula — returns distance in km
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Attach warehouse and compute ETA for a vehicle position
const enrichWithEta = (lat, lng, speed, warehouses) => {
  const warehouse = warehouses[0];
  if (!warehouse?.GpsLat || !warehouse?.GpsLng || !lat || !lng) {
    return { warehouseId: warehouse?.WarehouseID, warehouseName: warehouse?.WarehouseName, distanceKm: null, etaMinutes: null, etaTime: null };
  }
  const distanceKm = calculateDistance(lat, lng, warehouse.GpsLat, warehouse.GpsLng);
  const avgSpeedKmh = speed > 10 ? speed : 60;
  const etaMinutes = Math.round((distanceKm / avgSpeedKmh) * 60);
  const eta = new Date();
  eta.setMinutes(eta.getMinutes() + etaMinutes);
  return {
    warehouseId: warehouse.WarehouseID,
    warehouseName: warehouse.WarehouseName,
    distanceKm: distanceKm.toFixed(1),
    etaMinutes,
    etaTime: eta.toISOString()
  };
};

// GET /api/eta/vehicles
router.get('/vehicles', authenticate, async (req, res) => {
  try {
    const dtcApiUrl = process.env.DTC_API_URL;
    const dtcApiKey = process.env.DTC_API_KEY;

    const pool = getPool();
    const warehouseResult = await pool.request()
      .query('SELECT WarehouseID, WarehouseName, GpsLat, GpsLng FROM WMS_Warehouses WHERE IsActive=1');
    const warehouses = warehouseResult.recordset;

    // Fall back to mock data when DTC credentials are not configured
    if (!dtcApiUrl || !dtcApiKey || dtcApiKey === 'your_dtc_api_key_here') {
      const mockVehicles = [
        {
          vehicleId: 'DTC001', licensePlate: 'กข-1234', driverName: 'สมชาย ใจดี',
          lat: 13.7563, lng: 100.5018, speed: 60, status: 'Moving',
          lastUpdate: new Date().toISOString(), address: 'ถนนสุขุมวิท กรุงเทพฯ'
        },
        {
          vehicleId: 'DTC002', licensePlate: 'คง-5678', driverName: 'สมหญิง รักดี',
          lat: 13.8500, lng: 100.5200, speed: 0, status: 'Stopped',
          lastUpdate: new Date().toISOString(), address: 'ถนนรังสิต ปทุมธานี'
        }
      ];

      const result = mockVehicles.map(v => ({
        ...v,
        ...enrichWithEta(v.lat, v.lng, v.speed, warehouses)
      }));

      return res.json({ success: true, data: result, source: 'mock' });
    }

    // POST /getRealtimeData — official DTC GPS API format
    const baseUrl = dtcApiUrl.replace(/\/$/, '');
    const response = await axios.post(
      `${baseUrl}/getRealtimeData`,
      { api_token_key: dtcApiKey, gps_list: [] },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
        httpsAgent,
        validateStatus: () => true
      }
    );

    const body = response.data;

    if (!body || body.error !== false || !Array.isArray(body.data) || body.data.length === 0) {
      const msg = body?.message || 'ไม่มีข้อมูลรถจาก DTC GPS ขณะนี้';
      return res.json({ success: true, data: [], source: 'dtc', message: msg });
    }

    const result = body.data.map(v => {
      const lat = parseFloat(v.lat || 0);
      const lng = parseFloat(v.lon || v.lng || 0);
      const speed = parseFloat(v.gps_speed || v.speed || 0);

      return {
        vehicleId: v.gps_id || v.id,
        licensePlate: v.truck_license || v.truck_name || '-',
        driverName: v.driver_name || v.truck_name || '-',
        lat, lng, speed,
        status: v.status_name_en || (speed > 0 ? 'Moving' : 'Stopped'),
        statusTh: v.status_name_th || '',
        lastUpdate: v.time || new Date().toISOString(),
        truckType: v.truck_type_name || '',
        heading: v.heading || 0,
        ...enrichWithEta(lat, lng, speed, warehouses)
      };
    });

    res.json({ success: true, data: result, source: 'dtc' });
  } catch (err) {
    console.error('ETA/GPS error:', err.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงข้อมูล GPS ได้: ' + err.message });
  }
});

// POST /api/eta/config
router.post('/config', authenticate, async (req, res) => {
  res.json({ success: true, message: 'กรุณาตั้งค่า DTC_API_URL และ DTC_API_KEY ใน Environment Variables' });
});

module.exports = router;
