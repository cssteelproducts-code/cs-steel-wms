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

module.exports = router;
