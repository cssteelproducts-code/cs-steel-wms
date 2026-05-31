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

    req1.input('Offset', sql.Int, offset);
    req1.input('Limit', sql.Int, parseInt(limit));

    const result = await req1.query(`
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
        (SELECT COUNT(*) FROM WMS_LoadingRecord lr WITH (NOLOCK) WHERE lr.TripID = t.TripID) as LoadingCount,
        COUNT(*) OVER() AS TotalRows
      FROM WMS_Trips t          WITH (NOLOCK)
      LEFT JOIN WMS_VehicleTypes vt WITH (NOLOCK) ON vt.TypeID     = t.VehicleTypeID
      LEFT JOIN WMS_Warehouses w    WITH (NOLOCK) ON w.WarehouseID = t.WarehouseID
      LEFT JOIN WMS_Customers c     WITH (NOLOCK) ON c.CustomerID  = t.CustomerID
      LEFT JOIN WMS_WeighIn wi      WITH (NOLOCK) ON wi.TripID     = t.TripID
      LEFT JOIN WMS_WeighOut wo     WITH (NOLOCK) ON wo.TripID     = t.TripID
      LEFT JOIN WMS_CheckerRecord cr WITH (NOLOCK) ON cr.TripID    = t.TripID
      LEFT JOIN WMS_Users u         WITH (NOLOCK) ON u.UserID      = cr.OperatorID
      LEFT JOIN WMS_DataStation ds  WITH (NOLOCK) ON ds.TripID     = t.TripID
      ${where}
      ORDER BY t.CreatedAt DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `);

    const total = result.recordset[0]?.TotalRows ?? 0;
    res.json({
      success: true,
      data: result.recordset,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
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

    const tripData = await pool.request().input('TripID', sql.Int, tripId).query(`
      SELECT t.SOWaitStartedAt,
             wi.WeighDateTime as WeighInTime,
             ds.ReceivedTime as DataStationTime,
             (SELECT MIN(lr2.EntryTime) FROM WMS_LoadingRecord lr2 WHERE lr2.TripID = t.TripID) as FirstLoadEntry,
             (SELECT MAX(lr3.ExitTime)  FROM WMS_LoadingRecord lr3 WHERE lr3.TripID = t.TripID) as LastLoadExit,
             wo.WeighDateTime as WeighOutTime,
             cr.CheckTime,
             cr.CheckStartTime,
             cr.CheckDurationMinutes
      FROM WMS_Trips t
      LEFT JOIN WMS_WeighIn wi ON wi.TripID = t.TripID
      LEFT JOIN WMS_DataStation ds ON ds.TripID = t.TripID
      LEFT JOIN WMS_WeighOut wo ON wo.TripID = t.TripID
      LEFT JOIN WMS_CheckerRecord cr ON cr.TripID = t.TripID
      WHERE t.TripID = @TripID
    `);

    const loadingData = await pool.request().input('TripID', sql.Int, tripId).query(`
      SELECT ls.StationName, lr.EntryTime, lr.ExitTime, lr.DurationMinutes, lr.Round
      FROM WMS_LoadingRecord lr
      JOIN WMS_LoadingStations ls ON lr.StationID = ls.StationID
      WHERE lr.TripID = @TripID
      ORDER BY lr.EntryTime
    `);

    const t = tripData.recordset[0] || {};

    const pickWaitMinutes = t.SOWaitStartedAt && t.WeighInTime
      ? Math.max(0, Math.round((new Date(t.SOWaitStartedAt) - new Date(t.WeighInTime)) / 60000))
      : t.WeighInTime && (t.DataStationTime || t.FirstLoadEntry)
        ? Math.max(0, Math.round((new Date(t.DataStationTime || t.FirstLoadEntry) - new Date(t.WeighInTime)) / 60000))
        : null;

    const soWaitMinutes = t.SOWaitStartedAt && t.FirstLoadEntry
      ? Math.max(0, Math.round((new Date(t.FirstLoadEntry) - new Date(t.SOWaitStartedAt)) / 60000))
      : null;

    const weighOutWaitMinutes = t.LastLoadExit && t.WeighOutTime
      ? Math.max(0, Math.round((new Date(t.WeighOutTime) - new Date(t.LastLoadExit)) / 60000))
      : null;

    // ใช้ CheckDurationMinutes ที่บันทึกไว้ตอนเช็คเกอร์ submit (ถูกต้องที่สุด)
    // ถ้าไม่มี ใช้ CheckTime - CheckStartTime
    // ถ้าไม่มี CheckStartTime ค่อย fallback เป็น CheckTime - WeighOutTime
    const checkerMinutes = t.CheckDurationMinutes != null
      ? t.CheckDurationMinutes
      : t.CheckStartTime && t.CheckTime
        ? Math.max(0, Math.round((new Date(t.CheckTime) - new Date(t.CheckStartTime)) / 60000))
        : t.WeighOutTime && t.CheckTime
          ? Math.max(0, Math.round((new Date(t.CheckTime) - new Date(t.WeighOutTime)) / 60000))
          : null;

    const endTime = t.CheckTime || t.WeighOutTime;
    const totalTripMinutes = t.WeighInTime && endTime
      ? Math.max(0, Math.round((new Date(endTime) - new Date(t.WeighInTime)) / 60000))
      : null;

    res.json({
      success: true,
      data: {
        pickWaitMinutes,
        soWaitMinutes,
        hasSOWait: !!t.SOWaitStartedAt,
        stations: loadingData.recordset,
        weighOutWaitMinutes,
        checkerMinutes,
        totalTripMinutes,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/records/:tripId - Update trip record (full edit)
router.put('/:tripId', authenticate, async (req, res) => {
  try {
    const {
      licensePlate, vehicleTypeId, customerId, priority,
      tripDate, status,
      weighInTime, tareWeight,
      weighOutTime, grossWeight,
      isApproved, checkerRemarks, completedAtTime,
      pickDocumentNo,
    } = req.body;

    const tripId = parseInt(req.params.tripId);
    const pool = getPool();

    // Fetch current trip for date/status reference
    const tripInfo = await pool.request()
      .input('TripID', sql.Int, tripId)
      .query(`SELECT CONVERT(VARCHAR(10), TripDate, 23) as TripDateStr, Status FROM WMS_Trips WHERE TripID=@TripID`);
    if (tripInfo.recordset.length === 0)
      return res.status(404).json({ success: false, message: 'ไม่พบ Trip' });

    const baseDateStr = tripDate || tripInfo.recordset[0].TripDateStr;
    const prevStatus = tripInfo.recordset[0].Status;

    // --- WMS_Trips ---
    const tripsReq = pool.request().input('TripID', sql.Int, tripId);
    const tripSets = ['LicensePlate=@LP', 'VehicleTypeID=@VTID', 'CustomerID=@CID', 'Priority=@Pri'];
    tripsReq.input('LP', sql.NVarChar, (licensePlate || '').toUpperCase().trim());
    tripsReq.input('VTID', sql.Int, vehicleTypeId || null);
    tripsReq.input('CID', sql.Int, customerId || null);
    tripsReq.input('Pri', sql.NVarChar, priority || 'ปกติ');

    if (tripDate) {
      tripSets.push('TripDate=@TripDate');
      tripsReq.input('TripDate', sql.Date, tripDate);
    }
    if (status) {
      tripSets.push('Status=@Status');
      tripsReq.input('Status', sql.NVarChar, status);
      if (status === 'Complete' && prevStatus !== 'Complete' && !completedAtTime) {
        tripSets.push('CompletedAt=DATEADD(HOUR,7,GETUTCDATE())');
      }
    }
    if (completedAtTime && /^\d{2}:\d{2}$/.test(completedAtTime)) {
      const dt = new Date(`${baseDateStr}T${completedAtTime}:00+07:00`);
      if (!isNaN(dt.getTime())) {
        tripSets.push('CompletedAt=@CompletedAt');
        tripsReq.input('CompletedAt', sql.DateTime, dt);
      }
    }
    await tripsReq.query(`UPDATE WMS_Trips SET ${tripSets.join(',')} WHERE TripID=@TripID`);

    // --- WMS_WeighIn ---
    if (weighInTime && /^\d{2}:\d{2}$/.test(weighInTime)) {
      const dt = new Date(`${baseDateStr}T${weighInTime}:00+07:00`);
      if (!isNaN(dt.getTime())) {
        await pool.request()
          .input('TripID', sql.Int, tripId)
          .input('WDT', sql.DateTime, dt)
          .query(`UPDATE WMS_WeighIn SET WeighDateTime=@WDT WHERE TripID=@TripID`);
      }
    }
    if (tareWeight !== undefined && tareWeight !== '') {
      await pool.request()
        .input('TripID', sql.Int, tripId)
        .input('TW', sql.Decimal(10, 2), parseFloat(tareWeight))
        .query(`UPDATE WMS_WeighIn SET TareWeight=@TW WHERE TripID=@TripID`);
    }

    // --- WMS_WeighOut ---
    if (weighOutTime && /^\d{2}:\d{2}$/.test(weighOutTime)) {
      const dt = new Date(`${baseDateStr}T${weighOutTime}:00+07:00`);
      if (!isNaN(dt.getTime())) {
        await pool.request()
          .input('TripID', sql.Int, tripId)
          .input('WDT', sql.DateTime, dt)
          .query(`UPDATE WMS_WeighOut SET WeighDateTime=@WDT WHERE TripID=@TripID`);
      }
    }
    if (grossWeight !== undefined && grossWeight !== '') {
      const gw = parseFloat(grossWeight);
      const tw = tareWeight !== undefined && tareWeight !== '' ? parseFloat(tareWeight) : null;
      const nw = tw !== null ? gw - tw : null;
      const woReq = pool.request().input('TripID', sql.Int, tripId).input('GW', sql.Decimal(10, 2), gw);
      if (nw !== null) woReq.input('NW', sql.Decimal(10, 2), nw);
      await woReq.query(
        nw !== null
          ? `UPDATE WMS_WeighOut SET GrossWeight=@GW, NetWeight=@NW WHERE TripID=@TripID`
          : `UPDATE WMS_WeighOut SET GrossWeight=@GW WHERE TripID=@TripID`
      );
    }

    // --- WMS_CheckerRecord ---
    if (isApproved !== undefined || checkerRemarks !== undefined) {
      const existing = await pool.request()
        .input('TripID', sql.Int, tripId)
        .query('SELECT CheckerID FROM WMS_CheckerRecord WHERE TripID=@TripID');
      if (existing.recordset.length > 0) {
        const crReq = pool.request().input('TripID', sql.Int, tripId);
        const crSets = [];
        if (checkerRemarks !== undefined) {
          crReq.input('Remarks', sql.NVarChar, checkerRemarks || '');
          crSets.push('Remarks=@Remarks');
        }
        if (isApproved !== undefined && isApproved !== '') {
          crReq.input('IsApproved', sql.Bit, isApproved === '1' ? 1 : 0);
          crSets.push('IsApproved=@IsApproved');
        }
        if (crSets.length > 0)
          await crReq.query(`UPDATE WMS_CheckerRecord SET ${crSets.join(',')} WHERE TripID=@TripID`);
      }
    }

    // --- WMS_DataStation ---
    if (pickDocumentNo !== undefined) {
      await pool.request()
        .input('TripID', sql.Int, tripId)
        .input('PickNo', sql.NVarChar, pickDocumentNo || '')
        .query(`UPDATE WMS_DataStation SET PickDocumentNo=@PickNo WHERE TripID=@TripID`);
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
