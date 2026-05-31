const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { runAlertCheck } = require('../jobs/alertJob');

router.use(authenticate);

let _unreadCache = null;
let _unreadCacheExp = 0;

// GET /api/alerts - recent alerts
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const { unreadOnly, limit = 100 } = req.query;
    const where = unreadOnly === 'true' ? 'WHERE a.IsRead = 0 AND a.IsResolved = 0' : '';
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

// GET /api/alerts/unread-count — cached 20s to reduce DB load from polling
router.get('/unread-count', async (req, res) => {
  if (_unreadCache !== null && Date.now() < _unreadCacheExp) {
    return res.json({ success: true, count: _unreadCache });
  }
  try {
    const pool = getPool();
    const result = await pool.request()
      .query('SELECT COUNT(*) AS cnt FROM WMS_Alerts WITH (NOLOCK) WHERE IsRead = 0 AND IsResolved = 0');
    _unreadCache = result.recordset[0].cnt;
    _unreadCacheExp = Date.now() + 20000;
    res.json({ success: true, count: _unreadCache });
  } catch (err) {
    res.status(500).json({ success: false, count: 0 });
  }
});

// PUT /api/alerts/read-all
router.put('/read-all', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().query('UPDATE WMS_Alerts SET IsRead = 1 WHERE IsRead = 0');
    _unreadCache = 0; _unreadCacheExp = Date.now() + 20000;
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
    _unreadCacheExp = 0;
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
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/alerts/check - trigger alert check manually
router.post('/check', async (req, res) => {
  try {
    const count = await runAlertCheck();
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
