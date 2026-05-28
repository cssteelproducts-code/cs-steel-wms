const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

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
        FROM WMS_Alerts a
        LEFT JOIN WMS_Warehouses w ON a.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Trips t ON a.TripID = t.TripID
        ${where}
        ORDER BY a.CreatedAt DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/alerts/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query('SELECT COUNT(*) AS cnt FROM WMS_Alerts WHERE IsRead = 0 AND IsResolved = 0');
    res.json({ success: true, count: result.recordset[0].cnt });
  } catch (err) {
    res.status(500).json({ success: false, count: 0 });
  }
});

// PUT /api/alerts/read-all
router.put('/read-all', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().query('UPDATE WMS_Alerts SET IsRead = 1 WHERE IsRead = 0');
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
      .query('UPDATE WMS_Alerts SET IsResolved = 1, IsRead = 1, ResolvedAt = GETDATE() WHERE AlertID = @id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/alerts/check - trigger alert check (called by frontend polling)
router.post('/check', async (req, res) => {
  try {
    const pool = getPool();
    const newAlerts = [];

    const configs = await pool.request()
      .query('SELECT * FROM WMS_AlertConfig WHERE IsActive = 1');

    for (const cfg of configs.recordset) {
      if (cfg.AlertType === 'OVERSTAY') {
        const r = pool.request().input('threshold', sql.Decimal(10, 2), cfg.ThresholdValue);
        if (cfg.WarehouseID) r.input('warehouseId', sql.Int, cfg.WarehouseID);
        if (cfg.VehicleTypeID) r.input('vehicleTypeId', sql.Int, cfg.VehicleTypeID);

        const trips = await r.query(`
          SELECT t.TripID, t.LicensePlate, t.WarehouseID, t.VehicleTypeID,
            DATEDIFF(MINUTE, t.CreatedAt, GETUTCDATE()) AS MinutesInWarehouse
          FROM WMS_Trips t
          WHERE t.Status NOT IN ('Complete', 'Cancelled')
            AND DATEDIFF(MINUTE, t.CreatedAt, GETUTCDATE()) > @threshold
            ${cfg.WarehouseID ? 'AND t.WarehouseID = @warehouseId' : ''}
            ${cfg.VehicleTypeID ? 'AND t.VehicleTypeID = @vehicleTypeId' : ''}
            AND NOT EXISTS (
              SELECT 1 FROM WMS_Alerts a
              WHERE a.TripID = t.TripID AND a.AlertType = 'OVERSTAY'
                AND a.IsResolved = 0
                AND CAST(a.CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
            )
        `);

        if (trips.recordset.length > 0) {
          const batchReq = pool.request();
          const vals = trips.recordset.map((trip, i) => {
            const hrs = Math.floor(trip.MinutesInWarehouse / 60);
            const mins = trip.MinutesInWarehouse % 60;
            const t = hrs > 0 ? `${hrs} ชม. ${mins} นาที` : `${mins} นาที`;
            const msg = `ทะเบียน ${trip.LicensePlate} อยู่ในคลังนาน ${t} (เกินกำหนด ${cfg.ThresholdValue} นาที)`;
            const severity = trip.MinutesInWarehouse > cfg.ThresholdValue * 2 ? 'CRITICAL' : 'WARNING';
            batchReq.input(`sv${i}`, sql.NVarChar, severity);
            batchReq.input(`ti${i}`, sql.Int, trip.TripID);
            batchReq.input(`wi${i}`, sql.Int, trip.WarehouseID);
            batchReq.input(`ms${i}`, sql.NVarChar, msg);
            newAlerts.push(msg);
            return `('OVERSTAY', @sv${i}, @ti${i}, @wi${i}, @ms${i})`;
          });
          await batchReq.query(`INSERT INTO WMS_Alerts (AlertType, Severity, TripID, WarehouseID, Message) VALUES ${vals.join(', ')}`);
        }
      }

      if (cfg.AlertType === 'OVERWEIGHT') {
        const trips = await pool.request()
          .input('threshold', sql.Decimal(10, 2), cfg.ThresholdValue)
          .query(`
            SELECT t.TripID, t.LicensePlate, t.WarehouseID, wo.NetWeight
            FROM WMS_Trips t
            JOIN WMS_WeighOut wo ON wo.TripID = t.TripID
            WHERE t.Status = 'Complete'
              AND t.CompletedAt >= DATEADD(HOUR, -2, GETDATE())
              AND wo.NetWeight > @threshold
              AND NOT EXISTS (
                SELECT 1 FROM WMS_Alerts a
                WHERE a.TripID = t.TripID AND a.AlertType = 'OVERWEIGHT'
              )
          `);

        if (trips.recordset.length > 0) {
          const batchReq = pool.request();
          const vals = trips.recordset.map((trip, i) => {
            const msg = `ทะเบียน ${trip.LicensePlate} น้ำหนักสุทธิ ${trip.NetWeight.toFixed(2)} กก. เกินพิกัด ${cfg.ThresholdValue} กก.`;
            batchReq.input(`ti${i}`, sql.Int, trip.TripID);
            batchReq.input(`wi${i}`, sql.Int, trip.WarehouseID);
            batchReq.input(`ms${i}`, sql.NVarChar, msg);
            newAlerts.push(msg);
            return `('OVERWEIGHT', 'WARNING', @ti${i}, @wi${i}, @ms${i})`;
          });
          await batchReq.query(`INSERT INTO WMS_Alerts (AlertType, Severity, TripID, WarehouseID, Message) VALUES ${vals.join(', ')}`);
        }
      }
    }

    res.json({ success: true, newAlerts: newAlerts.length, alerts: newAlerts });
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
