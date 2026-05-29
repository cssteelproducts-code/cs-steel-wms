const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/records - List trips with all related data
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, search, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pool = getPool();

    let where = 'WHERE 1=1';
    const req1 = pool.request();

    if (date) {
      where += ' AND CAST(t.TripDate AS DATE) = @Date';
      req1.input('Date', sql.Date, date);
    }

    if (status && status !== 'all') {
      where += ' AND t.Status = @Status';
      req1.input('Status', sql.NVarChar, status);
    } else if (!status) {
      where += " AND t.Status = 'Complete'";
    }

    if (search) {
      where += ' AND (t.LicensePlate LIKE @Search OR c.CustomerName LIKE @Search OR c.CustomerCode LIKE @Search)';
      req1.input('Search', sql.NVarChar, `%${search}%`);
    }

    const countResult = await req1.query(`
      SELECT COUNT(*) as Total
      FROM WMS_Trips t
      LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
      ${where}
    `);

    const req2 = pool.request();
    if (date) req2.input('Date', sql.Date, date);
    if (status && status !== 'all') req2.input('Status', sql.NVarChar, status);
    if (search) req2.input('Search', sql.NVarChar, `%${search}%`);
    req2.input('Offset', sql.Int, offset);
    req2.input('Limit', sql.Int, parseInt(limit));

    const result = await req2.query(`
      SELECT
        t.TripID, t.TripDate, t.LicensePlate, t.Status, t.Priority, t.DeliveryType,
        t.CreatedAt, t.CompletedAt,
        vt.TypeID as VehicleTypeID, vt.TypeName as VehicleType,
        w.WarehouseID, w.WarehouseName,
        c.CustomerID, c.CustomerName, c.CustomerCode,
        wi.TareWeight, wi.WeighDateTime as WeighInTime,
        wo.GrossWeight, wo.NetWeight, wo.WeighDateTime as WeighOutTime,
        cr.IsApproved, cr.Remarks as CheckerRemarks, cr.CheckTime,
        u.FullName as CheckerName,
        ds.PickDocumentNo,
        (SELECT COUNT(*) FROM WMS_LoadingRecord lr WHERE lr.TripID = t.TripID) as LoadingCount
      FROM WMS_Trips t
      LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
      LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
      LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
      LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
      LEFT JOIN WMS_WeighOut wo ON t.TripID = wo.TripID
      LEFT JOIN WMS_CheckerRecord cr ON t.TripID = cr.TripID
      LEFT JOIN WMS_Users u ON cr.OperatorID = u.UserID
      LEFT JOIN WMS_DataStation ds ON t.TripID = ds.TripID
      ${where}
      ORDER BY t.CreatedAt DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `);

    res.json({
      success: true,
      data: result.recordset,
      pagination: {
        total: countResult.recordset[0].Total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.recordset[0].Total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Records GET error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/records/:tripId/loading - Loading station history for a trip
router.get('/:tripId/loading', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('TripID', sql.Int, req.params.tripId)
      .query(`
        SELECT lr.RecordID, lr.StationID, ls.StationName, lr.EntryTime, lr.ExitTime, lr.DurationMinutes, lr.Round
        FROM WMS_LoadingRecord lr
        JOIN WMS_LoadingStations ls ON lr.StationID = ls.StationID
        WHERE lr.TripID = @TripID
        ORDER BY lr.Round, lr.EntryTime
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/records/:tripId/timeline - Full timing breakdown
router.get('/:tripId/timeline', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const tripId = parseInt(req.params.tripId);

    // Trip-level timing
    const tripData = await pool.request().input('TripID', sql.Int, tripId).query(`
      SELECT t.SOWaitStartedAt,
             wi.WeighDateTime as WeighInTime,
             ds.ReceivedTime as DataStationTime,
             (SELECT MIN(lr2.EntryTime) FROM WMS_LoadingRecord lr2 WHERE lr2.TripID = t.TripID) as FirstLoadEntry
      FROM WMS_Trips t
      LEFT JOIN WMS_WeighIn wi ON wi.TripID = t.TripID
      LEFT JOIN WMS_DataStation ds ON ds.TripID = t.TripID
      WHERE t.TripID = @TripID
    `);

    // Loading station records
    const loadingData = await pool.request().input('TripID', sql.Int, tripId).query(`
      SELECT ls.StationName, lr.EntryTime, lr.ExitTime, lr.DurationMinutes, lr.Round
      FROM WMS_LoadingRecord lr
      JOIN WMS_LoadingStations ls ON lr.StationID = ls.StationID
      WHERE lr.TripID = @TripID
      ORDER BY lr.EntryTime
    `);

    const t = tripData.recordset[0] || {};

    // Calculate DataStation wait phases
    const pickWaitMinutes = t.SOWaitStartedAt && t.WeighInTime
      ? Math.max(0, Math.round((new Date(t.SOWaitStartedAt) - new Date(t.WeighInTime)) / 60000))
      : t.WeighInTime && (t.DataStationTime || t.FirstLoadEntry)
        ? Math.max(0, Math.round((new Date(t.DataStationTime || t.FirstLoadEntry) - new Date(t.WeighInTime)) / 60000))
        : null;

    const soWaitMinutes = t.SOWaitStartedAt && (t.DataStationTime || t.FirstLoadEntry)
      ? Math.max(0, Math.round((new Date(t.DataStationTime || t.FirstLoadEntry) - new Date(t.SOWaitStartedAt)) / 60000))
      : null;

    res.json({
      success: true,
      data: {
        pickWaitMinutes,
        soWaitMinutes,
        hasSOWait: !!t.SOWaitStartedAt,
        stations: loadingData.recordset
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/records/:tripId - Update trip record
router.put('/:tripId', authenticate, async (req, res) => {
  try {
    const { licensePlate, vehicleTypeId, customerId, tareWeight, grossWeight, checkerRemarks, priority, weighInTime } = req.body;
    const tripId = parseInt(req.params.tripId);
    const pool = getPool();

    await pool.request()
      .input('TripID', sql.Int, tripId)
      .input('LicensePlate', sql.NVarChar, (licensePlate || '').toUpperCase().trim())
      .input('VehicleTypeID', sql.Int, vehicleTypeId || null)
      .input('CustomerID', sql.Int, customerId || null)
      .input('Priority', sql.NVarChar, priority || 'ปกติ')
      .query(`UPDATE WMS_Trips SET LicensePlate=@LicensePlate, VehicleTypeID=@VehicleTypeID, CustomerID=@CustomerID, Priority=@Priority WHERE TripID=@TripID`);

    if (weighInTime && /^\d{2}:\d{2}$/.test(weighInTime)) {
      const tripRes = await pool.request()
        .input('TripID', sql.Int, tripId)
        .query(`SELECT CONVERT(VARCHAR(10), TripDate, 23) as TripDateStr FROM WMS_Trips WHERE TripID=@TripID`);
      if (tripRes.recordset.length > 0) {
        const dateStr = tripRes.recordset[0].TripDateStr;
        const dt = new Date(`${dateStr}T${weighInTime}:00+07:00`);
        if (!isNaN(dt.getTime())) {
          await pool.request()
            .input('TripID', sql.Int, tripId)
            .input('WeighDateTime', sql.DateTime, dt)
            .query(`UPDATE WMS_WeighIn SET WeighDateTime=@WeighDateTime WHERE TripID=@TripID`);
        }
      }
    }

    if (tareWeight !== undefined && tareWeight !== '') {
      await pool.request()
        .input('TripID', sql.Int, tripId)
        .input('TareWeight', sql.Decimal(10, 2), parseFloat(tareWeight))
        .query(`UPDATE WMS_WeighIn SET TareWeight=@TareWeight WHERE TripID=@TripID`);
    }

    if (grossWeight !== undefined && grossWeight !== '') {
      const gw = parseFloat(grossWeight);
      const tw = tareWeight !== undefined && tareWeight !== '' ? parseFloat(tareWeight) : null;
      const nw = tw !== null ? gw - tw : null;
      const req3 = pool.request()
        .input('TripID', sql.Int, tripId)
        .input('GrossWeight', sql.Decimal(10, 2), gw);
      if (nw !== null) req3.input('NetWeight', sql.Decimal(10, 2), nw);
      await req3.query(
        nw !== null
          ? `UPDATE WMS_WeighOut SET GrossWeight=@GrossWeight, NetWeight=@NetWeight WHERE TripID=@TripID`
          : `UPDATE WMS_WeighOut SET GrossWeight=@GrossWeight WHERE TripID=@TripID`
      );
    }

    if (checkerRemarks !== undefined) {
      await pool.request()
        .input('TripID', sql.Int, tripId)
        .input('Remarks', sql.NVarChar, checkerRemarks || '')
        .query(`UPDATE WMS_CheckerRecord SET Remarks=@Remarks WHERE TripID=@TripID`);
    }

    res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) {
    console.error('Records PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/records/:tripId - Delete trip and all related records
router.delete('/:tripId', authenticate, async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const pool = getPool();

    await pool.request().input('TripID', sql.Int, tripId).query(`DELETE FROM WMS_LoadingRecord WHERE TripID=@TripID`);
    await pool.request().input('TripID', sql.Int, tripId).query(`DELETE FROM WMS_CheckerRecord WHERE TripID=@TripID`);
    await pool.request().input('TripID', sql.Int, tripId).query(`DELETE FROM WMS_WeighOut WHERE TripID=@TripID`);
    await pool.request().input('TripID', sql.Int, tripId).query(`DELETE FROM WMS_WeighIn WHERE TripID=@TripID`);
    await pool.request().input('TripID', sql.Int, tripId).query(`DELETE FROM WMS_DataStationTargets WHERE TripID=@TripID`);
    await pool.request().input('TripID', sql.Int, tripId).query(`DELETE FROM WMS_DataStation WHERE TripID=@TripID`);
    await pool.request().input('TripID', sql.Int, tripId).query(`DELETE FROM WMS_Trips WHERE TripID=@TripID`);

    res.json({ success: true, message: `ลบ Trip #${tripId} สำเร็จ` });
  } catch (err) {
    console.error('Records DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
