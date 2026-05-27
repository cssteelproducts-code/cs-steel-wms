const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// POST /api/checker - Record checker verification
router.post('/', authenticate, async (req, res) => {
  try {
    const { tripId, isApproved, remarks, checkDurationMinutes, checkStartTime } = req.body;

    if (!tripId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ Trip' });
    }

    const pool = getPool();

    const existing = await pool.request()
      .input('TripID', sql.Int, tripId)
      .query('SELECT CheckerID FROM WMS_CheckerRecord WHERE TripID = @TripID');

    const startTime = checkStartTime ? new Date(checkStartTime) : null;

    if (existing.recordset.length > 0) {
      await pool.request()
        .input('TripID', sql.Int, tripId)
        .input('IsApproved', sql.Bit, isApproved ? 1 : 0)
        .input('Remarks', sql.NVarChar, remarks || '')
        .input('OperatorID', sql.Int, req.user.UserID)
        .input('CheckDurationMinutes', sql.Int, checkDurationMinutes != null ? checkDurationMinutes : null)
        .input('CheckStartTime', sql.DateTime, startTime)
        .query(`UPDATE WMS_CheckerRecord SET CheckTime=GETDATE(), IsApproved=@IsApproved,
                Remarks=@Remarks, OperatorID=@OperatorID,
                CheckDurationMinutes=@CheckDurationMinutes, CheckStartTime=@CheckStartTime
                WHERE TripID=@TripID`);
    } else {
      await pool.request()
        .input('TripID', sql.Int, tripId)
        .input('IsApproved', sql.Bit, isApproved ? 1 : 0)
        .input('Remarks', sql.NVarChar, remarks || '')
        .input('OperatorID', sql.Int, req.user.UserID)
        .input('CheckDurationMinutes', sql.Int, checkDurationMinutes != null ? checkDurationMinutes : null)
        .input('CheckStartTime', sql.DateTime, startTime)
        .query(`INSERT INTO WMS_CheckerRecord (TripID, IsApproved, Remarks, OperatorID, CheckDurationMinutes, CheckStartTime)
                VALUES (@TripID, @IsApproved, @Remarks, @OperatorID, @CheckDurationMinutes, @CheckStartTime)`);
    }

    if (isApproved) {
      await pool.request()
        .input('TripID', sql.Int, tripId)
        .query(`UPDATE WMS_Trips SET Status='Complete', CompletedAt=GETDATE() WHERE TripID=@TripID`);
    }

    const tripInfo = await pool.request()
      .input('TripID', sql.Int, tripId)
      .query('SELECT LicensePlate FROM WMS_Trips WHERE TripID = @TripID');

    const plate = tripInfo.recordset[0]?.LicensePlate || '';
    const statusText = isApproved ? 'ผ่านการตรวจสอบ ✓' : 'ไม่ผ่านการตรวจสอบ ✗';

    res.json({
      success: true,
      message: `${statusText} | ทะเบียน: ${plate}`
    });
  } catch (err) {
    console.error('Checker error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/checker/pending - Get trips waiting for checker
router.get('/pending', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query(`
        SELECT t.TripID, t.LicensePlate, t.Status, t.CreatedAt,
               t.DeliveryType,
               vt.TypeName as VehicleType,
               w.WarehouseName,
               c.CustomerName,
               ds.PickDocumentNo,
               ls_target.StationName as TargetStation,
               DATEDIFF(MINUTE, t.CreatedAt, GETUTCDATE()) as MinutesInWarehouse
        FROM WMS_Trips t
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_DataStation ds ON t.TripID = ds.TripID
        LEFT JOIN WMS_LoadingStations ls_target ON ds.TargetStationID = ls_target.StationID
        WHERE t.Status = 'Checker'
        AND CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY t.CreatedAt ASC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/checker/trip/:tripId
router.get('/trip/:tripId', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('TripID', sql.Int, req.params.tripId)
      .query(`SELECT cr.*, u.FullName as OperatorName FROM WMS_CheckerRecord cr
              LEFT JOIN WMS_Users u ON cr.OperatorID = u.UserID
              WHERE cr.TripID = @TripID`);
    res.json({ success: true, data: result.recordset[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/checker/move-to-checker/:tripId - Move trip to checker status
router.put('/move-to-checker/:tripId', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('TripID', sql.Int, req.params.tripId)
      .query(`UPDATE WMS_Trips SET Status = 'Checker' WHERE TripID = @TripID`);
    res.json({ success: true, message: 'ส่งไปสถานีเช็คเกอร์แล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
