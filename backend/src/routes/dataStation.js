const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// POST /api/data-station - Record data station visit (no pickDocumentNo required, multi-station)
router.post('/', authenticate, async (req, res) => {
  try {
    const { tripId, stationIds, notes } = req.body;

    if (!tripId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ Trip' });
    }

    const pool = getPool();

    const tripCheck = await pool.request()
      .input('TripID', sql.Int, tripId)
      .query(`SELECT TripID, Status, LicensePlate FROM WMS_Trips WHERE TripID = @TripID`);

    if (tripCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบ Trip นี้' });
    }

    const primaryStation = Array.isArray(stationIds) && stationIds.length > 0 ? stationIds[0] : null;

    // Upsert WMS_DataStation (keep for backward compat with trips display)
    const existing = await pool.request()
      .input('TripID', sql.Int, tripId)
      .query('SELECT DataStationID FROM WMS_DataStation WHERE TripID = @TripID');

    if (existing.recordset.length > 0) {
      await pool.request()
        .input('TripID', sql.Int, tripId)
        .input('TargetStationID', sql.Int, primaryStation || null)
        .input('Notes', sql.NVarChar, notes || '')
        .input('OperatorID', sql.Int, req.user.UserID)
        .query(`UPDATE WMS_DataStation SET TargetStationID=@TargetStationID,
                PickDocumentNo=NULL, ReceivedTime=GETDATE(),
                Notes=@Notes, OperatorID=@OperatorID
                WHERE TripID=@TripID`);
    } else {
      await pool.request()
        .input('TripID', sql.Int, tripId)
        .input('TargetStationID', sql.Int, primaryStation || null)
        .input('Notes', sql.NVarChar, notes || '')
        .input('OperatorID', sql.Int, req.user.UserID)
        .query(`INSERT INTO WMS_DataStation (TripID, TargetStationID, PickDocumentNo, Notes, OperatorID)
                VALUES (@TripID, @TargetStationID, NULL, @Notes, @OperatorID)`);
    }

    // Store all target stations in WMS_DataStationTargets
    if (Array.isArray(stationIds) && stationIds.length > 0) {
      await pool.request().input('TripID', sql.Int, tripId)
        .query('DELETE FROM WMS_DataStationTargets WHERE TripID = @TripID');
      for (const sid of stationIds) {
        await pool.request()
          .input('TripID', sql.Int, tripId)
          .input('StationID', sql.Int, sid)
          .query('INSERT INTO WMS_DataStationTargets (TripID, StationID) VALUES (@TripID, @StationID)');
      }
    }

    // Update trip status to WaitPick (waiting for Pick document before loading)
    await pool.request()
      .input('TripID', sql.Int, tripId)
      .query(`UPDATE WMS_Trips SET Status = 'WaitPick' WHERE TripID = @TripID`);

    const trip = tripCheck.recordset[0];
    res.json({
      success: true,
      message: `บันทึกสถานี Data สำเร็จ | ทะเบียน: ${trip.LicensePlate}`
    });
  } catch (err) {
    console.error('DataStation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/data-station/pending
router.get('/pending', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query(`
        SELECT t.TripID, t.LicensePlate, t.Status, t.CreatedAt,
               t.DeliveryType, t.Priority,
               vt.TypeName as VehicleType,
               w.WarehouseName,
               c.CustomerName,
               wi.TareWeight, wi.WeighDateTime,
               DATEDIFF(MINUTE, wi.WeighDateTime, GETUTCDATE()) as WaitMinutes
        FROM WMS_Trips t
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
        WHERE t.Status = 'Data'
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

// PUT /api/data-station/:tripId/wait-pick
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
