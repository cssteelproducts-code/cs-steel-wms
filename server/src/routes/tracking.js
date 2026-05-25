// แทน TrackingDB.gs — Vehicle ETA Tracking (GPS)
const router         = require('express').Router();
const https          = require('https');
const { v4: uuidv4 } = require('uuid');
const { query, execute } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
const { getRoleAccess } = require('./utils');

const DTC_REALTIME_URL = 'https://gps.dtc.co.th:8099/getRealtimeData';

router.use(authMiddleware);

// GET /api/tracking/warehouses
router.get('/warehouses', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.eta.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    const rows = await query('SELECT * FROM dbo.WarehouseList ORDER BY [SortOrder]').catch(() => []);
    return res.json({ success: true, warehouses: rows });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// GET /api/tracking/vehicles
router.get('/vehicles', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.eta.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    const rows = await query('SELECT * FROM dbo.VehicleETA ORDER BY [UpdatedAt] DESC').catch(() => []);
    return res.json({ success: true, vehicles: rows });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/tracking/update  (บันทึก GPS ตำแหน่งรถ)
router.post('/update', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.eta.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    const { licensePlate, lat, lng, notes, warehouseId } = req.body;
    if (!licensePlate) return res.json({ success: false, message: 'ระบุทะเบียนรถ' });

    const now = new Date().toISOString();
    const existing = await query(
      'SELECT [ID] FROM dbo.VehicleETA WHERE [LicensePlate]=@lp',
      { lp: (licensePlate || '').toUpperCase() }
    ).catch(() => []);

    if (existing.length) {
      await execute(
        'UPDATE dbo.VehicleETA SET [Lat]=@lat,[Lng]=@lng,[UpdatedAt]=@ua,[UpdatedBy]=@ub,[Notes]=@n,[WarehouseId]=@wh WHERE [LicensePlate]=@lp',
        { lat: lat || null, lng: lng || null, ua: now, ub: req.user.username, n: notes || '', wh: warehouseId || '', lp: (licensePlate || '').toUpperCase() }
      );
    } else {
      await execute(
        'INSERT INTO dbo.VehicleETA ([ID],[LicensePlate],[Lat],[Lng],[UpdatedAt],[UpdatedBy],[Notes],[WarehouseId]) VALUES (@id,@lp,@lat,@lng,@ua,@ub,@n,@wh)',
        { id: uuidv4(), lp: (licensePlate || '').toUpperCase(), lat: lat || null, lng: lng || null, ua: now, ub: req.user.username, n: notes || '', wh: warehouseId || '' }
      );
    }
    return res.json({ success: true });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// GET /api/tracking/gps  (ดึงข้อมูล GPS จาก DTC API)
router.get('/gps', async (req, res) => {
  try {
    const apiToken = process.env.DTC_API_TOKEN;
    if (!apiToken) return res.json({ success: false, message: 'ยังไม่ได้ตั้งค่า DTC_API_TOKEN' });

    const data   = await _fetchDtcVehicles(apiToken);
    if (!data) return res.json({ success: false, message: 'ไม่สามารถดึงข้อมูล GPS ได้' });
    return res.json({ success: true, vehicles: data });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// ── DTC helper functions ──
function normalizeDtcResponse(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(normalizeDtcVehicle);
  if (Array.isArray(raw.vehicle_list)) return raw.vehicle_list.map(normalizeDtcVehicle);
  if (Array.isArray(raw.result?.vehicle_list)) return raw.result.vehicle_list.map(normalizeDtcVehicle);
  if (Array.isArray(raw.data)) return raw.data.map(normalizeDtcVehicle);
  return [];
}

function normalizeDtcVehicle(v) {
  const plate = String(v.license_plate_no || v.PlateNo || v.plate_no || v.device_name || v.DeviceName || v.name || '').trim();
  const speed  = parseFloat(v.speed || v.Speed || 0);
  const engineOn = v.acc_status === 1 || v.acc_status === '1' || v.engine_status === 'ON';
  return {
    vehicleId:   String(v.gps_id || v.vehicle_id || v.VehicleID || v.id || plate),
    licensePlate: plate,
    vehicleType:  String(v.vehicle_type || v.VehicleType || v.group_name || v.GroupName || ''),
    lat:   parseFloat(v.lat || v.Lat || 0),
    lon:   parseFloat(v.lon || v.lng || v.Lng || v.Lon || 0),
    speed,
    engineOn,
    currentZone: [v.province_name || v.ProvinceName || '', v.district_name || v.DistrictName || ''].filter(Boolean).join(' '),
    status: String(v.vehicle_status || v.Status || (speed > 3 ? 'Run' : 'Stop')),
    updatedAt: String(v.last_receive_datetime || v.LastUpdate || v.datetime || v.UpdatedAt || ''),
    remark: String(v.driver_name || v.DriverName || ''),
  };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// GET /api/tracking/gps-eta  (DTC GPS + ETA calculation)
router.get('/gps-eta', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.eta?.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    const apiToken = process.env.DTC_API_TOKEN;
    const [warehouseRows, mapRows, dtcRaw] = await Promise.all([
      query('SELECT * FROM dbo.WarehouseList ORDER BY [SortOrder]').catch(() => []),
      query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'VEHICLE_WH_MAP'").catch(() => []),
      apiToken ? _fetchDtcVehicles(apiToken) : Promise.resolve(null),
    ]);

    let vehWhMap = {};
    if (mapRows.length && mapRows[0].Value) {
      try { vehWhMap = JSON.parse(mapRows[0].Value); } catch {}
    }

    const dtcVehicles = normalizeDtcResponse(dtcRaw);
    const warehouses  = warehouseRows;

    const vehicles = dtcVehicles.map(v => {
      const whId = vehWhMap[v.licensePlate] || vehWhMap[v.vehicleId] || null;
      const wh   = whId ? warehouses.find(w => String(w.WarehouseID) === String(whId)) : null;
      let etaMinutes = null, distanceKm = null;
      if (wh && v.lat && v.lon && wh.Lat && wh.Lng) {
        distanceKm = Math.round(haversineKm(v.lat, v.lon, parseFloat(wh.Lat), parseFloat(wh.Lng)) * 10) / 10;
        const spd  = v.speed > 10 ? v.speed : 60;
        etaMinutes = Math.round((distanceKm / spd) * 60);
      }
      return { ...v, warehouseId: whId, warehouseName: wh?.Name || '', etaMinutes, distanceKm };
    });

    return res.json({ success: true, vehicles, warehouses, hasDtc: !!apiToken });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

function _fetchDtcVehicles(apiToken) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ api_token_key: apiToken, gps_list: [] });
    const opts  = {
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      rejectUnauthorized: false,
      timeout:  10000,
    };
    const url = new URL(DTC_REALTIME_URL);
    opts.hostname = url.hostname;
    opts.port     = url.port;
    opts.path     = url.pathname;
    const req = https.request(opts, r => {
      let raw = '';
      r.on('data', c => raw += c);
      r.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// GET /api/tracking/all  (ETA module — vehicles + warehouses + vehWhMap ในคำขอเดียว)
router.get('/all', async (req, res) => {
  try {
    const [vehicles, warehouses, whMapRows] = await Promise.all([
      query('SELECT * FROM dbo.VehicleETA ORDER BY [UpdatedAt] DESC').catch(() => []),
      query('SELECT * FROM dbo.WarehouseList ORDER BY [SortOrder]').catch(() => []),
      query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'VEHICLE_WH_MAP'").catch(() => []),
    ]);
    let vehWhMap = {};
    if (whMapRows.length && whMapRows[0].Value) {
      try { vehWhMap = JSON.parse(whMapRows[0].Value); } catch {}
    }
    return res.json({ success: true, vehicles, warehouses, vehWhMap });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/tracking/vehicle-delete
router.post('/vehicle-delete', async (req, res) => {
  try {
    const { licensePlate } = req.body;
    if (!licensePlate) return res.json({ success: false, message: 'ระบุ licensePlate' });
    await execute('DELETE FROM dbo.VehicleETA WHERE [LicensePlate]=@lp',
      { lp: licensePlate.toUpperCase() });
    return res.json({ success: true, message: 'ลบรถแล้ว' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/tracking/warehouses-save
router.post('/warehouses-save', async (req, res) => {
  try {
    const { warehouses } = req.body;
    if (!Array.isArray(warehouses)) return res.json({ success: false, message: 'warehouses must be array' });
    for (const wh of warehouses) {
      if (!wh.id) continue;
      const exists = await query('SELECT [WarehouseID] FROM dbo.WarehouseList WHERE [WarehouseID]=@id', { id: wh.id }).catch(() => []);
      if (exists.length) {
        await execute(
          'UPDATE dbo.WarehouseList SET [Name]=@n,[Address]=@a,[Lat]=@lat,[Lng]=@lng,[SortOrder]=@so WHERE [WarehouseID]=@id',
          { n: wh.name || '', a: wh.address || '', lat: wh.lat || null, lng: wh.lng || null, so: wh.sortOrder || 0, id: wh.id }
        );
      } else {
        await execute(
          'INSERT INTO dbo.WarehouseList ([WarehouseID],[Name],[Address],[Lat],[Lng],[SortOrder]) VALUES (@id,@n,@a,@lat,@lng,@so)',
          { id: wh.id, n: wh.name || '', a: wh.address || '', lat: wh.lat || null, lng: wh.lng || null, so: wh.sortOrder || 0 }
        );
      }
    }
    return res.json({ success: true, message: 'บันทึก warehouses แล้ว' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/tracking/wh-map
router.post('/wh-map', async (req, res) => {
  try {
    const map = req.body;
    const val = JSON.stringify(map || {});
    const rows = await query("SELECT [Key] FROM dbo.AppConfig WHERE [Key]=N'VEHICLE_WH_MAP'").catch(() => []);
    if (rows.length) {
      await execute("UPDATE dbo.AppConfig SET [Value]=@v,[UpdatedAt]=@ua WHERE [Key]=N'VEHICLE_WH_MAP'",
        { v: val, ua: new Date().toISOString() });
    } else {
      await execute("INSERT INTO dbo.AppConfig ([Key],[Value],[UpdatedAt]) VALUES (N'VEHICLE_WH_MAP',@v,@ua)",
        { v: val, ua: new Date().toISOString() });
    }
    return res.json({ success: true, message: 'บันทึก WH map แล้ว' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

module.exports = router;
