const express = require('express');
const router = express.Router();
const axios = require('axios');
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Haversine fallback
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Road distance cache (5 min TTL, ~1 km position bucket)
const distCache = new Map();

const getRoadDistanceKm = async (lat, lng, wLat, wLng) => {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${wLat.toFixed(4)},${wLng.toFixed(4)}`;
  if (distCache.has(key)) return distCache.get(key);
  try {
    const resp = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${wLng},${wLat}?overview=false`,
      { timeout: 6000 }
    );
    if (resp.data?.code === 'Ok' && resp.data.routes?.[0]) {
      const km = resp.data.routes[0].distance / 1000;
      distCache.set(key, km);
      setTimeout(() => distCache.delete(key), 5 * 60 * 1000);
      return km;
    }
  } catch {}
  return haversine(lat, lng, wLat, wLng);
};

const enrichWithEta = async (lat, lng, speed, warehouse) => {
  if (!warehouse?.GpsLat || !warehouse?.GpsLng || !lat || !lng) {
    return { warehouseId: warehouse?.WarehouseID, warehouseName: warehouse?.WarehouseName, distanceKm: null, etaMinutes: null, etaTime: null, withinRadius: false, radiusKm: warehouse?.RadiusKm || 5 };
  }
  const distKm = await getRoadDistanceKm(lat, lng, warehouse.GpsLat, warehouse.GpsLng);
  const radiusKm = warehouse.RadiusKm || 5;
  const withinRadius = distKm <= radiusKm;
  const effSpeed = Math.min(speed > 5 ? speed : 60, 90);
  const etaMinutes = withinRadius ? 0 : Math.round((distKm / effSpeed) * 60);
  return {
    warehouseId: warehouse.WarehouseID,
    warehouseName: warehouse.WarehouseName,
    distanceKm: distKm.toFixed(1),
    etaMinutes,
    etaTime: new Date(Date.now() + etaMinutes * 60000).toISOString(),
    withinRadius,
    radiusKm
  };
};

const loadAssignments = async (pool) => {
  try {
    const r = await pool.request().query('SELECT VehicleID, WarehouseID FROM WMS_ETAAssignments');
    const map = {};
    r.recordset.forEach(row => { map[row.VehicleID] = row.WarehouseID; });
    return map;
  } catch { return {}; }
};

// Sync all vehicles from DTC into WMS_ETAVehicles using MERGE (single batch)
const syncVehicleList = async (pool, dtcVehicles) => {
  if (!dtcVehicles.length) return;
  try {
    const r = pool.request();
    const vals = dtcVehicles.map((v, i) => {
      r.input(`vid${i}`, sql.NVarChar, v.vehicleId);
      r.input(`lp${i}`, sql.NVarChar, v.licensePlate || '');
      r.input(`lbl${i}`, sql.NVarChar, v.label || v.licensePlate || '');
      return `(@vid${i}, @lp${i}, @lbl${i})`;
    });
    await r.query(`
      MERGE WMS_ETAVehicles AS target
      USING (VALUES ${vals.join(', ')}) AS source(VehicleID, LicensePlate, Label)
      ON target.VehicleID = source.VehicleID
      WHEN MATCHED THEN
        UPDATE SET LicensePlate=source.LicensePlate, Label=source.Label, UpdatedAt=GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (VehicleID, LicensePlate, Label, IsTransport) VALUES (source.VehicleID, source.LicensePlate, source.Label, 0);
    `);
  } catch (e) {
    console.warn('syncVehicleList error:', e.message);
  }
};

// Auto-assign vehicles to their most-used warehouse from trip history (fills gaps in WMS_ETAAssignments)
const autoAssignFromTrips = async (pool, vehicles, existingAssignments) => {
  const unassigned = vehicles.filter(v => !existingAssignments[v.vehicleId] && v.licensePlate);
  if (!unassigned.length) return existingAssignments;
  try {
    const req = pool.request();
    const params = unassigned.map((v, i) => { req.input(`p${i}`, sql.NVarChar, v.licensePlate); return `@p${i}`; });
    const result = await req.query(`
      SELECT LicensePlate, WarehouseID FROM (
        SELECT LicensePlate, WarehouseID,
          ROW_NUMBER() OVER (PARTITION BY LicensePlate ORDER BY COUNT(*) DESC) rn
        FROM WMS_Trips
        WHERE LicensePlate IN (${params.join(',')}) AND WarehouseID IS NOT NULL
        GROUP BY LicensePlate, WarehouseID
      ) t WHERE rn = 1
    `);
    const map = { ...existingAssignments };
    const plateToId = {};
    unassigned.forEach(v => { plateToId[v.licensePlate] = v.vehicleId; });
    result.recordset.forEach(row => {
      const vid = plateToId[row.LicensePlate];
      if (vid) map[vid] = row.WarehouseID;
    });
    return map;
  } catch { return existingAssignments; }
};

// GET /api/eta/vehicles — returns only IsTransport=1 vehicles
router.get('/vehicles', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    let warehouseQuery = 'SELECT WarehouseID, WarehouseName, GpsLat, GpsLng, ISNULL(RadiusKm,5) AS RadiusKm FROM WMS_Warehouses WHERE IsActive=1 ORDER BY WarehouseID';
    // Fallback if RadiusKm column not yet migrated
    const [warehouseResult, assignments] = await Promise.all([
      pool.request().query(warehouseQuery).catch(() =>
        pool.request().query('SELECT WarehouseID, WarehouseName, GpsLat, GpsLng, 5 AS RadiusKm FROM WMS_Warehouses WHERE IsActive=1 ORDER BY WarehouseID')
      ),
      loadAssignments(pool)
    ]);
    const warehouses = warehouseResult.recordset;

    const dtcApiUrl = process.env.DTC_API_URL;
    const dtcApiKey = process.env.DTC_API_KEY;

    if (!dtcApiUrl || !dtcApiKey || dtcApiKey === 'your_dtc_api_key_here') {
      const mockVehicles = [
        { vehicleId: 'DTC001', licensePlate: 'กข-1234', label: 'รถ 10 ล้อ กข-1234', lat: 13.7563, lng: 100.5018, speed: 60, status: 'Moving', lastUpdate: new Date().toISOString(), address: 'ถนนสุขุมวิท กรุงเทพฯ' },
        { vehicleId: 'DTC002', licensePlate: 'คง-5678', label: 'รถ 6 ล้อ คง-5678', lat: 13.8500, lng: 100.5200, speed: 0, status: 'Stopped', lastUpdate: new Date().toISOString(), address: 'ถนนรังสิต ปทุมธานี' }
      ];
      await syncVehicleList(pool, mockVehicles);

      const wlResult = await pool.request().query(`SELECT VehicleID FROM WMS_ETAVehicles WHERE IsTransport=1`);
      const transportIds = new Set(wlResult.recordset.map(r => r.VehicleID));
      const filtered = transportIds.size > 0 ? mockVehicles.filter(v => transportIds.has(v.vehicleId)) : mockVehicles;

      const finalAssign = await autoAssignFromTrips(pool, filtered, assignments);
      const pickWh = (vehicleId) => {
        const wid = finalAssign[vehicleId];
        return (wid ? warehouses.find(w => w.WarehouseID === wid) : null) || warehouses[0] || null;
      };
      const result = await Promise.all(filtered.map(async v => ({
        ...v,
        ...(await enrichWithEta(v.lat, v.lng, v.speed, pickWh(v.vehicleId)))
      })));
      return res.json({ success: true, data: result, source: 'mock', warehouses, whitelistConfigured: transportIds.size > 0 });
    }

    const baseUrl = dtcApiUrl.replace(/\/$/, '');
    const response = await axios.post(
      `${baseUrl}/getRealtimeData`,
      { api_token_key: dtcApiKey, gps_list: [] },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000, httpsAgent, validateStatus: () => true }
    );

    const body = response.data;
    if (!body || body.error !== false || !Array.isArray(body.data) || body.data.length === 0) {
      return res.json({ success: true, data: [], source: 'dtc', message: body?.message || 'ไม่มีข้อมูลรถ', warehouses });
    }

    // Parse all vehicles
    const allVehicles = body.data.map(v => ({
      vehicleId: v.gps_id || v.id,
      licensePlate: v.truck_license || v.truck_name || '-',
      label: v.truck_name || v.truck_license || '-',
      lat: parseFloat(v.lat || 0),
      lng: parseFloat(v.lon || v.lng || 0),
      speed: parseFloat(v.gps_speed || v.speed || 0),
      status: v.status_name_en || (parseFloat(v.gps_speed || 0) > 0 ? 'Moving' : 'Stopped'),
      statusTh: v.status_name_th || '',
      lastUpdate: v.time || new Date().toISOString(),
      address: v.address || v.location || '',
      heading: v.heading || 0,
    }));

    // Sync to DB and load whitelist
    await syncVehicleList(pool, allVehicles);
    const wlResult = await pool.request().query(`SELECT VehicleID FROM WMS_ETAVehicles WHERE IsTransport=1`);
    const transportIds = new Set(wlResult.recordset.map(r => r.VehicleID));

    const transportVehicles = transportIds.size > 0
      ? allVehicles.filter(v => transportIds.has(v.vehicleId))
      : allVehicles;

    const finalAssign = await autoAssignFromTrips(pool, transportVehicles, assignments);
    const pickWh = (vehicleId) => {
      const wid = finalAssign[vehicleId];
      return (wid ? warehouses.find(w => w.WarehouseID === wid) : null) || warehouses[0] || null;
    };
    const result = await Promise.all(transportVehicles.map(async v => ({
      ...v,
      ...(await enrichWithEta(v.lat, v.lng, v.speed, pickWh(v.vehicleId)))
    })));

    res.json({ success: true, data: result, source: 'dtc', warehouses, whitelistConfigured: transportIds.size > 0 });
  } catch (err) {
    console.error('ETA/GPS error:', err.message);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงข้อมูล GPS ได้: ' + err.message });
  }
});

// GET /api/eta/all-vehicles — all vehicles (for management modal)
router.get('/all-vehicles', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query('SELECT VehicleID, LicensePlate, Label, IsTransport, UpdatedAt FROM WMS_ETAVehicles ORDER BY IsTransport DESC, LicensePlate');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/eta/vehicles/:vehicleId/transport — toggle IsTransport
router.put('/vehicles/:vehicleId/transport', authenticate, async (req, res) => {
  try {
    const { isTransport } = req.body;
    const pool = getPool();
    await pool.request()
      .input('VehicleID', sql.NVarChar, req.params.vehicleId)
      .input('IsTransport', sql.Bit, isTransport ? 1 : 0)
      .query('UPDATE WMS_ETAVehicles SET IsTransport=@IsTransport, UpdatedAt=GETDATE() WHERE VehicleID=@VehicleID');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/eta/assignments
router.get('/assignments', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const r = await pool.request().query('SELECT VehicleID, WarehouseID FROM WMS_ETAAssignments');
    res.json({ success: true, data: r.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/eta/assignments/:vehicleId
router.put('/assignments/:vehicleId', authenticate, async (req, res) => {
  try {
    const { warehouseId } = req.body;
    const pool = getPool();
    await pool.request()
      .input('VehicleID', sql.NVarChar, req.params.vehicleId)
      .input('WarehouseID', sql.Int, warehouseId)
      .query(`
        IF EXISTS (SELECT 1 FROM WMS_ETAAssignments WHERE VehicleID=@VehicleID)
          UPDATE WMS_ETAAssignments SET WarehouseID=@WarehouseID, UpdatedAt=GETDATE() WHERE VehicleID=@VehicleID
        ELSE
          INSERT INTO WMS_ETAAssignments (VehicleID, WarehouseID) VALUES (@VehicleID, @WarehouseID)
      `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
