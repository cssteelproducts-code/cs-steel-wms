const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// POST /api/data-station - Record data station visit
router.post('/', authenticate, async (req, res) => {
  try {
    const { tripId, targetStationId, pickDocumentNo, notes } = req.body;

    if (!tripId || !pickDocumentNo) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    }

    const pool = getPool();

    // Verify trip exists and is in correct status
    const tripCheck = await pool.request()
      .input('TripID', sql.Int, tripId)
      .query(`SELECT TripID, Status, LicensePlate FROM WMS_Trips WHERE TripID = @TripID`);

    if (tripCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบ Trip นี้' });
    }

    // Check if already processed at data station
    const existing = await pool.request()
      .input('TripID', sql.Int, tripId)
      .query('SELECT DataStationID FROM WMS_DataStation WHERE TripID = @TripID');

    if (existing.recordset.length > 0) {
      // Update existing record
      await pool.request()
        .input('TripID', sql.Int, tripId)
        .input('TargetStationID', sql.Int, targetStationId || null)
        .input('PickDocumentNo', sql.NVarChar, pickDocumentNo)
        .input('Notes', sql.NVarChar, notes || '')
        .input('OperatorID', sql.Int, req.user.UserID)
        .query(`UPDATE WMS_DataStation SET TargetStationID=@TargetStationID,
                PickDocumentNo=@PickDocumentNo, ReceivedTime=GETDATE(),
                Notes=@Notes, OperatorID=@OperatorID
                WHERE TripID=@TripID`);
    } else {
      await pool.request()
        .input('TripID', sql.Int, tripId)
        .input('TargetStationID', sql.Int, targetStationId || null)
        .input('PickDocumentNo', sql.NVarChar, pickDocumentNo)
        .input('Notes', sql.NVarChar, notes || '')
        .input('OperatorID', sql.Int, req.user.UserID)
        .query(`INSERT INTO WMS_DataStation (TripID, TargetStationID, PickDocumentNo, Notes, OperatorID)
                VALUES (@TripID, @TargetStationID, @PickDocumentNo, @Notes, @OperatorID)`);
    }

    // Update trip status
    await pool.request()
      .input('TripID', sql.Int, tripId)
      .query(`UPDATE WMS_Trips SET Status = 'Loading' WHERE TripID = @TripID`);

    const trip = tripCheck.recordset[0];
    res.json({
      success: true,
      message: `บันทึกสถานี Data สำเร็จ | ทะเบียน: ${trip.LicensePlate} | เอกสาร: ${pickDocumentNo}`
    });
  } catch (err) {
    console.error('DataStation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/data-station/pending - Get trips waiting for data station
router.get('/pending', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query(`
        SELECT t.TripID, t.LicensePlate, t.Status, t.CreatedAt,
               vt.TypeName as VehicleType,
               w.WarehouseName,
               c.CustomerName,
               wi.TareWeight, wi.WeighDateTime,
               DATEDIFF(MINUTE, wi.WeighDateTime, GETDATE()) as WaitMinutes
        FROM WMS_Trips t
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
        WHERE t.Status IN ('Data', 'WaitPick')
        AND CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY t.CreatedAt ASC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/data-station/trip/:tripId
router.get('/trip/:tripId', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('TripID', sql.Int, req.params.tripId)
      .query(`
        SELECT ds.*, ls.StationName as TargetStation, u.FullName as OperatorName
        FROM WMS_DataStation ds
        LEFT JOIN WMS_LoadingStations ls ON ds.TargetStationID = ls.StationID
        LEFT JOIN WMS_Users u ON ds.OperatorID = u.UserID
        WHERE ds.TripID = @TripID
      `);
    res.json({ success: true, data: result.recordset[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/data-station/:tripId/wait-pick — mark trip as waiting for Pick document
router.put('/:tripId/wait-pick', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('TripID', sql.Int, req.params.tripId)
      .query(`UPDATE WMS_Trips SET Status = 'WaitPick' WHERE TripID = @TripID AND Status IN ('Data', 'WaitPick')`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
