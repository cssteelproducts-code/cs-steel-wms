const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { runAlertCheck } = require('../jobs/alertJob');

router.use(authenticate);

// Per-role permission cache for TRANSFER_VEHICLES (60s TTL)
const _permCache = new Map();
async function canSeeVehicleAlerts(roleId, roleName) {
  if (roleName === 'Admin') return true;
  const key = `vp:${roleId}`;
  const hit = _permCache.get(key);
  if (hit && Date.now() < hit.exp) return hit.v;
  try {
    const r = await getPool().request()
      .input('RID', sql.Int, roleId)
      .query(`SELECT 1 AS p FROM WMS_MenuPermissions WITH (NOLOCK)
              WHERE RoleID=@RID AND MenuCode='TRANSFER_VEHICLES' AND CanView=1`);
    const v = r.recordset.length > 0;
    _permCache.set(key, { v, exp: Date.now() + 60000 });
    return v;
  } catch { return false; }
}

// Per-role unread-count cache (keyed by roleId+canSeeVeh)
const _unreadCache = new Map();
const unreadKey = (roleId, veh) => `u:${roleId}:${veh?1:0}`;
const getUnreadCache = (k) => { const e = _unreadCache.get(k); return (e && Date.now() < e.exp) ? e.v : null; };
const setUnreadCache = (k, v) => _unreadCache.set(k, { v, exp: Date.now() + 20000 });
const clearUnreadCache = () => _unreadCache.clear();

// GET /api/alerts - recent alerts (VEH_* filtered by TRANSFER_VEHICLES permission)
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const { unreadOnly, limit = 100 } = req.query;
    const canVeh = await canSeeVehicleAlerts(req.user.RoleID, req.user.RoleName);

    const conditions = [];
    if (unreadOnly === 'true') conditions.push('a.IsRead = 0 AND a.IsResolved = 0');
    if (!canVeh) conditions.push("a.AlertType NOT LIKE 'VEH_%'");
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await pool.request()
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        SELECT TOP (@limit)
          a.AlertID, a.AlertType, a.Severity, a.TripID, a.WarehouseID,
          a.Message, a.IsRead, a.IsResolved, a.CreatedAt, a.ResolvedAt,
          w.WarehouseName, t.LicensePlate
        FROM WMS_Alerts a WITH (NOLOCK)
        LEFT JOIN WMS_Warehouses w WITH (NOLOCK) ON a.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Trips t WITH (NOLOCK) ON a.TripID = t.TripID
        ${where}
        ORDER BY a.CreatedAt DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/alerts/unread-count — per-role cache (VEH_* filtered by permission)
router.get('/unread-count', async (req, res) => {
  try {
    const canVeh = await canSeeVehicleAlerts(req.user.RoleID, req.user.RoleName);
    const key = unreadKey(req.user.RoleID, canVeh);
    const hit = getUnreadCache(key);
    if (hit !== null) return res.json({ success: true, count: hit });

    const vehFilter = canVeh ? '' : "AND AlertType NOT LIKE 'VEH_%'";
    const result = await getPool().request()
      .query(`SELECT COUNT(*) AS cnt FROM WMS_Alerts WITH (NOLOCK)
              WHERE IsRead = 0 AND IsResolved = 0 ${vehFilter}`);
    const count = result.recordset[0].cnt;
    setUnreadCache(key, count);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, count: 0 });
  }
});

// PUT /api/alerts/read-all
router.put('/read-all', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().query('UPDATE WMS_Alerts SET IsRead = 1 WHERE IsRead = 0');
    clearUnreadCache();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/alerts/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE WMS_Alerts SET IsRead = 1 WHERE AlertID = @id');
    clearUnreadCache();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE WMS_Alerts SET IsResolved = 1, IsRead = 1, ResolvedAt = DATEADD(HOUR,7,GETUTCDATE()) WHERE AlertID = @id');
    clearUnreadCache();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/alerts/check - trigger alert check manually
router.post('/check', async (req, res) => {
  try {
    const count = await runAlertCheck();
    clearUnreadCache();
    res.json({ success: true, newAlerts: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/alerts/config/:id
router.delete('/config/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM WMS_AlertConfig WHERE ConfigID = @id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/alerts/config
router.get('/config', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT c.*, w.WarehouseName, vt.TypeName as VehicleTypeName
      FROM WMS_AlertConfig c
      LEFT JOIN WMS_Warehouses w ON c.WarehouseID = w.WarehouseID
      LEFT JOIN WMS_VehicleTypes vt ON c.VehicleTypeID = vt.TypeID
      ORDER BY c.AlertType, c.ConfigID
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/alerts/config
router.post('/config', async (req, res) => {
  try {
    const pool = getPool();
    const { alertType, warehouseId, vehicleTypeId, thresholdValue, isActive, configId } = req.body;

    if (configId) {
      await pool.request()
        .input('id', sql.Int, configId)
        .input('threshold', sql.Decimal(10, 2), thresholdValue)
        .input('active', sql.Bit, isActive !== false ? 1 : 0)
        .input('vehicleTypeId', sql.Int, vehicleTypeId || null)
        .query('UPDATE WMS_AlertConfig SET ThresholdValue=@threshold, IsActive=@active, VehicleTypeID=@vehicleTypeId, UpdatedAt=GETDATE() WHERE ConfigID=@id');
    } else {
      await pool.request()
        .input('alertType', sql.NVarChar, alertType)
        .input('warehouseId', sql.Int, warehouseId || null)
        .input('vehicleTypeId', sql.Int, vehicleTypeId || null)
        .input('threshold', sql.Decimal(10, 2), thresholdValue)
        .query(`
          INSERT INTO WMS_AlertConfig (AlertType, WarehouseID, VehicleTypeID, ThresholdValue)
          VALUES (@alertType, @warehouseId, @vehicleTypeId, @threshold)
        `);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
