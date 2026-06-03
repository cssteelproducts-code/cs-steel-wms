const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const cache = require('../utils/cache');

// GET /api/shift-plan/config
router.get('/config', authenticate, async (req, res) => {
  try {
    const data = await cache.wrap('shiftplan:config', async () => {
      const result = await getPool().request()
        .query(`SELECT TOP 1 ConfigJSON FROM WMS_ShiftPlanConfig WHERE ConfigKey='default' ORDER BY ConfigID DESC`);
      return result.recordset.length ? JSON.parse(result.recordset[0].ConfigJSON) : null;
    }, 30_000);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/shift-plan/config
router.put('/config', authenticate, async (req, res) => {
  cache.del('shiftplan:config');
  try {
    const pool = getPool();
    const json = JSON.stringify(req.body);
    const exists = await pool.request()
      .query(`SELECT TOP 1 ConfigID FROM WMS_ShiftPlanConfig WHERE ConfigKey='default'`);
    if (exists.recordset.length) {
      await pool.request().input('j', sql.NVarChar(sql.MAX), json)
        .query(`UPDATE WMS_ShiftPlanConfig SET ConfigJSON=@j, UpdatedAt=GETDATE() WHERE ConfigKey='default'`);
    } else {
      await pool.request().input('j', sql.NVarChar(sql.MAX), json)
        .query(`INSERT INTO WMS_ShiftPlanConfig (ConfigKey, ConfigJSON) VALUES ('default', @j)`);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/shift-plan/records
router.get('/records', authenticate, async (req, res) => {
  try {
    const data = await cache.wrap('shiftplan:records', async () => {
      const result = await getPool().request()
        .query(`SELECT RecordID as id, CONVERT(VARCHAR(10),RecordDate,23) as date, EndTime as endTime, OTEmp as otEmp, OTHrs1 as otHrs1, OTHrs2 as otHrs2 FROM WMS_ShiftPlanRecords ORDER BY RecordDate ASC`);
      return result.recordset;
    }, 30_000);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/shift-plan/records  (single or batch)
router.post('/records', authenticate, async (req, res) => {
  cache.del('shiftplan:records');
  try {
    const pool = getPool();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const inserted = [];
    for (const r of rows) {
      const result = await pool.request()
        .input('d', sql.Date, r.date)
        .input('et', sql.NVarChar(10), r.endTime)
        .input('emp', sql.Int, r.otEmp || 0)
        .input('h1', sql.Decimal(10,2), r.otHrs1 || 0)
        .input('h2', sql.Decimal(10,2), r.otHrs2 || 0)
        .query(`INSERT INTO WMS_ShiftPlanRecords (RecordDate,EndTime,OTEmp,OTHrs1,OTHrs2) OUTPUT INSERTED.RecordID as id, CONVERT(VARCHAR(10),INSERTED.RecordDate,23) as date, INSERTED.EndTime as endTime, INSERTED.OTEmp as otEmp, INSERTED.OTHrs1 as otHrs1, INSERTED.OTHrs2 as otHrs2 VALUES (@d,@et,@emp,@h1,@h2)`);
      inserted.push(result.recordset[0]);
    }
    res.json({ success: true, data: inserted });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/shift-plan/records/:id
router.put('/records/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { endTime, otEmp, otHrs1, otHrs2 } = req.body;
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('et', sql.NVarChar(10), endTime)
      .input('emp', sql.Int, otEmp || 0)
      .input('h1', sql.Decimal(10,2), otHrs1 || 0)
      .input('h2', sql.Decimal(10,2), otHrs2 || 0)
      .query(`UPDATE WMS_ShiftPlanRecords SET EndTime=@et,OTEmp=@emp,OTHrs1=@h1,OTHrs2=@h2 WHERE RecordID=@id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/shift-plan/records/bulk  (delete selected IDs in one query)
router.delete('/records/bulk', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'ไม่มีรายการที่จะลบ' });
    const pool = getPool();
    const request = pool.request();
    const safeIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    safeIds.forEach((id, i) => request.input(`id${i}`, sql.Int, id));
    await request.query(`DELETE FROM WMS_ShiftPlanRecords WHERE RecordID IN (${safeIds.map((_, i) => `@id${i}`).join(',')})`);
    res.json({ success: true, message: `ลบ ${safeIds.length} รายการสำเร็จ` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/shift-plan/records/:id
router.delete('/records/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('id', sql.Int, req.params.id)
      .query(`DELETE FROM WMS_ShiftPlanRecords WHERE RecordID=@id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/shift-plan/records  (clear all)
router.delete('/records', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().query(`DELETE FROM WMS_ShiftPlanRecords`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
