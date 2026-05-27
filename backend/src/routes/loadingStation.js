const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// POST /api/loading-station/entry - Record entry to loading station
router.post('/entry', authenticate, async (req, res) => {
  try {
    const { tripId, stationId, notes } = req.body;

    if (!tripId || !stationId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ Trip และสถานี' });
    }

    const pool = getPool();

    // Check if already at this station without exit
    const activeRecord = await pool.request()
      .input('TripID', sql.Int, tripId)
      .input('StationID', sql.Int, stationId)
      .query(`SELECT RecordID FROM WMS_LoadingRecord
              WHERE TripID = @TripID AND StationID = @StationID AND ExitTime IS NULL`);

    if (activeRecord.recordset.length > 0) {
      return res.status(400).json({ success: false, message: 'รถคันนี้อยู่ที่สถานีนี้แล้ว กรุณาบันทึกออกก่อน' });
    }

    const result = await pool.request()
      .input('TripID', sql.Int, tripId)
      .input('StationID', sql.Int, stationId)
      .input('EntryTime', sql.DateTime, new Date())
      .input('Notes', sql.NVarChar, notes || '')
      .input('OperatorID', sql.Int, req.user.UserID)
      .query(`
        INSERT INTO WMS_LoadingRecord (TripID, StationID, EntryTime, Notes, OperatorID)
        OUTPUT INSERTED.RecordID
        VALUES (@TripID, @StationID, @EntryTime, @Notes, @OperatorID)
      `);

    // Get station and trip info for response
    const info = await pool.request()
      .input('TripID', sql.Int, tripId)
      .input('StationID', sql.Int, stationId)
      .query(`
        SELECT t.LicensePlate, ls.StationName
        FROM WMS_Trips t, WMS_LoadingStations ls
        WHERE t.TripID = @TripID AND ls.StationID = @StationID
      `);

    // Move trip status to Loading
    await pool.request()
      .input('TripID', sql.Int, tripId)
      .query(`UPDATE WMS_Trips SET Status='Loading' WHERE TripID=@TripID AND Status IN ('WaitPick','Data')`);

    const recordId = result.recordset[0].RecordID;
    const info2 = info.recordset[0];

    res.json({
      success: true,
      recordId,
      message: `บันทึกเข้าสถานี "${info2?.StationName}" สำเร็จ | ทะเบียน: ${info2?.LicensePlate}`
    });
  } catch (err) {
    console.error('LoadingStation entry error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/loading-station/exit/:recordId - Record exit from loading station
router.put('/exit/:recordId', authenticate, async (req, res) => {
  try {
    const { notes } = req.body;
    const pool = getPool();

    const record = await pool.request()
      .input('RecordID', sql.Int, req.params.recordId)
      .query(`SELECT lr.*, ls.StationName, t.LicensePlate
              FROM WMS_LoadingRecord lr
              JOIN WMS_LoadingStations ls ON lr.StationID = ls.StationID
              JOIN WMS_Trips t ON lr.TripID = t.TripID
              WHERE lr.RecordID = @RecordID AND lr.ExitTime IS NULL`);

    if (record.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล หรือบันทึกออกแล้ว' });
    }

    const entryTime = new Date(record.recordset[0].EntryTime);
    const exitTime = new Date();
    const durationMinutes = Math.round((exitTime - entryTime) / 60000);

    await pool.request()
      .input('RecordID', sql.Int, req.params.recordId)
      .input('ExitTime', sql.DateTime, exitTime)
      .input('DurationMinutes', sql.Int, durationMinutes)
      .input('Notes', sql.NVarChar, notes || '')
      .query(`UPDATE WMS_LoadingRecord SET ExitTime=@ExitTime, DurationMinutes=@DurationMinutes,
              Notes=@Notes WHERE RecordID=@RecordID`);

    const r = record.recordset[0];
    res.json({
      success: true,
      message: `บันทึกออกจากสถานี "${r.StationName}" สำเร็จ | ทะเบียน: ${r.LicensePlate} | เวลาอยู่: ${durationMinutes} นาที`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/loading-station/done/:tripId - Mark loading complete, send to WeighOut
router.put('/done/:tripId', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const info = await pool.request()
      .input('TripID', sql.Int, req.params.tripId)
      .query(`SELECT LicensePlate FROM WMS_Trips WHERE TripID=@TripID`);
    await pool.request()
      .input('TripID', sql.Int, req.params.tripId)
      .query(`UPDATE WMS_Trips SET Status='WeighOut' WHERE TripID=@TripID AND Status='Loading'`);
    const plate = info.recordset[0]?.LicensePlate || '';
    res.json({ success: true, message: `ส่งชั่งออกแล้ว | ทะเบียน: ${plate}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/loading-station/active - Get all active loading (no exit time)
router.get('/active', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { stationId } = req.query;

    let whereClause = 'WHERE lr.ExitTime IS NULL AND CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)';
    const request = pool.request();

    if (stationId) {
      whereClause += ' AND lr.StationID = @StationID';
      request.input('StationID', sql.Int, stationId);
    }

    const result = await request.query(`
      SELECT lr.RecordID, lr.TripID, lr.StationID, lr.EntryTime, lr.Notes,
             ls.StationName, ls.StationCode,
             t.LicensePlate, t.Status,
             vt.TypeName as VehicleType,
             c.CustomerName,
             w.WarehouseName,
             DATEDIFF(MINUTE, lr.EntryTime, GETUTCDATE()) as MinutesAtStation,
             u.FullName as OperatorName
      FROM WMS_LoadingRecord lr
      JOIN WMS_LoadingStations ls ON lr.StationID = ls.StationID
      JOIN WMS_Trips t ON lr.TripID = t.TripID
      LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
      LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
      LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
      LEFT JOIN WMS_Users u ON lr.OperatorID = u.UserID
      ${whereClause}
      ORDER BY lr.EntryTime DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/loading-station/trip/:tripId/target-stations - Get all target stations with done status
router.get('/trip/:tripId/target-stations', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('TripID', sql.Int, req.params.tripId)
      .query(`
        SELECT dst.StationID, ls.StationName, ls.StationCode,
               CASE WHEN lr.RecordID IS NOT NULL THEN 1 ELSE 0 END as IsDone
        FROM WMS_DataStationTargets dst
        JOIN WMS_LoadingStations ls ON dst.StationID = ls.StationID
        LEFT JOIN WMS_LoadingRecord lr ON lr.TripID = dst.TripID
          AND lr.StationID = dst.StationID
          AND lr.ExitTime IS NOT NULL
        WHERE dst.TripID = @TripID
        ORDER BY ls.StationName
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/loading-station/trip/:tripId - Get loading records for a trip
router.get('/trip/:tripId', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('TripID', sql.Int, req.params.tripId)
      .query(`
        SELECT lr.*, ls.StationName, ls.StationCode, u.FullName as OperatorName
        FROM WMS_LoadingRecord lr
        JOIN WMS_LoadingStations ls ON lr.StationID = ls.StationID
        LEFT JOIN WMS_Users u ON lr.OperatorID = u.UserID
        WHERE lr.TripID = @TripID
        ORDER BY lr.EntryTime
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/loading-station/stations-status - Get all stations with current occupancy
router.get('/stations-status', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query(`
        SELECT ls.StationID, ls.StationCode, ls.StationName, ls.WarehouseID,
               w.WarehouseName,
               COUNT(lr.RecordID) as ActiveTrucks,
               (SELECT TOP 1 t.LicensePlate FROM WMS_LoadingRecord lr2
                JOIN WMS_Trips t ON lr2.TripID = t.TripID
                WHERE lr2.StationID = ls.StationID AND lr2.ExitTime IS NULL
                AND CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)) as CurrentTruck
        FROM WMS_LoadingStations ls
        LEFT JOIN WMS_Warehouses w ON ls.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_LoadingRecord lr ON ls.StationID = lr.StationID
          AND lr.ExitTime IS NULL
          AND EXISTS(SELECT 1 FROM WMS_Trips t WHERE t.TripID = lr.TripID
                     AND CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE))
        WHERE ls.IsActive = 1
        GROUP BY ls.StationID, ls.StationCode, ls.StationName, ls.WarehouseID, w.WarehouseName
        ORDER BY ls.SortOrder, ls.StationName
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
