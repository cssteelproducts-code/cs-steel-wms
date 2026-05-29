const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// POST /api/weigh-out - Record weigh-out and complete trip
router.post('/', authenticate, async (req, res) => {
  try {
    const { tripId, grossWeight, notes, overrideLicensePlate, overrideTareWeight, overrideCustomerId, overrideEntryTime } = req.body;

    if (!tripId || !grossWeight) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    }

    const pool = getPool();

    const tripInfo = await pool.request()
      .input('TripID', sql.Int, tripId)
      .query(`
        SELECT t.TripID, t.LicensePlate, t.Status,
               wi.TareWeight
        FROM WMS_Trips t
        LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
        WHERE t.TripID = @TripID
      `);

    if (tripInfo.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบ Trip นี้' });
    }

    const trip = tripInfo.recordset[0];
    const tareWeight = overrideTareWeight != null ? parseFloat(overrideTareWeight) : (parseFloat(trip.TareWeight) || 0);
    const netWeight = parseFloat(grossWeight) - tareWeight;
    const licensePlate = overrideLicensePlate?.trim().toUpperCase() || trip.LicensePlate;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      if (overrideLicensePlate || overrideCustomerId != null || overrideEntryTime) {
        const upd = transaction.request().input('TripID', sql.Int, tripId);
        let setClauses = [];
        if (overrideLicensePlate) { upd.input('LP', sql.NVarChar, licensePlate); setClauses.push('LicensePlate=@LP'); }
        if (overrideCustomerId != null) { upd.input('CID', sql.Int, overrideCustomerId || null); setClauses.push('CustomerID=@CID'); }
        if (setClauses.length) await upd.query(`UPDATE WMS_Trips SET ${setClauses.join(',')} WHERE TripID=@TripID`);
      }

      if (overrideTareWeight != null) {
        await transaction.request()
          .input('WTID', sql.Int, tripId)
          .input('TW', sql.Decimal(10, 2), tareWeight)
          .query(`UPDATE WMS_WeighIn SET TareWeight=@TW WHERE TripID=@WTID`);
      }

      await transaction.request()
        .input('TripID', sql.Int, tripId)
        .input('WeighDateTime', sql.DateTime, new Date())
        .input('GrossWeight', sql.Decimal(10, 2), grossWeight)
        .input('TareWeight', sql.Decimal(10, 2), tareWeight)
        .input('NetWeight', sql.Decimal(10, 2), netWeight)
        .input('Notes', sql.NVarChar, notes || '')
        .input('OperatorID', sql.Int, req.user.UserID)
        .query(`INSERT INTO WMS_WeighOut (TripID, WeighDateTime, GrossWeight, TareWeight, NetWeight, Notes, OperatorID)
                VALUES (@TripID, @WeighDateTime, @GrossWeight, @TareWeight, @NetWeight, @Notes, @OperatorID)`);

      await transaction.request()
        .input('TripID', sql.Int, tripId)
        .query(`UPDATE WMS_Trips SET Status='Checker' WHERE TripID=@TripID`);

      await transaction.commit();

      res.json({
        success: true,
        message: `ชั่งออกสำเร็จ | ทะเบียน: ${licensePlate} | น้ำหนักสุทธิ: ${netWeight.toFixed(2)} กก.`,
        data: { tripId, grossWeight, tareWeight, netWeight: parseFloat(netWeight.toFixed(2)) }
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('WeighOut error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/weigh-out/pending - All trips with WeighIn record, not yet Complete/Cancelled
router.get('/pending', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query(`
        SELECT t.TripID, t.LicensePlate, t.Status, t.CreatedAt, t.TripDate,
               t.DeliveryType, t.Priority, t.CustomerID, t.SOWaitStartedAt,
               vt.TypeName as VehicleType,
               w.WarehouseName,
               c.CustomerName,
               wi.TareWeight, wi.WeighDateTime as WeighInTime,
               ds.PickDocumentNo,
               DATEDIFF(MINUTE, wi.WeighDateTime, GETUTCDATE()) as MinutesInWarehouse,
               ISNULL(lr_ex.HasRecord, 0) as HasLoadingRecord,
               ISNULL(dst_ex.HasTargets, 0) as HasDataStationTargets,
               cur.StationName as CurrentStation
        FROM WMS_Trips t
        INNER JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_DataStation ds ON t.TripID = ds.TripID
        LEFT JOIN (SELECT DISTINCT TripID, 1 as HasRecord FROM WMS_LoadingRecord) lr_ex ON lr_ex.TripID = t.TripID
        LEFT JOIN (SELECT DISTINCT TripID, 1 as HasTargets FROM WMS_DataStationTargets) dst_ex ON dst_ex.TripID = t.TripID
        LEFT JOIN (
          SELECT lr2.TripID, ls2.StationName,
            ROW_NUMBER() OVER (PARTITION BY lr2.TripID ORDER BY lr2.EntryTime DESC) as rn
          FROM WMS_LoadingRecord lr2 JOIN WMS_LoadingStations ls2 ON lr2.StationID = ls2.StationID
          WHERE lr2.ExitTime IS NULL
        ) cur ON cur.TripID = t.TripID AND cur.rn = 1
        WHERE t.Status NOT IN ('Complete', 'Cancelled')
        ORDER BY
          CASE t.Status WHEN 'WeighOut' THEN 0 WHEN 'Loading' THEN 1 WHEN 'WaitPick' THEN 2 WHEN 'Data' THEN 3 ELSE 4 END,
          t.CreatedAt DESC
      `);
    console.log(`[WeighOut/pending] found ${result.recordset.length} trips`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[WeighOut/pending] error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/weigh-out/today - Trips weighed-out today (Checker/Complete with WeighOut record)
router.get('/today', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query(`
        SELECT t.TripID, t.LicensePlate, t.CompletedAt,
               vt.TypeName as VehicleType,
               c.CustomerName,
               w.WarehouseName,
               wi.TareWeight, wi.WeighDateTime as WeighInTime,
               wo.GrossWeight, wo.NetWeight, wo.WeighDateTime as WeighOutTime,
               DATEDIFF(MINUTE, wi.WeighDateTime, wo.WeighDateTime) as TotalMinutes,
               u.FullName as OperatorName
        FROM WMS_WeighOut wo
        JOIN WMS_Trips t ON wo.TripID = t.TripID
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
        LEFT JOIN WMS_Users u ON wo.OperatorID = u.UserID
        WHERE CAST(wo.WeighDateTime AS DATE) >= CAST(DATEADD(DAY,-1,GETUTCDATE()) AS DATE)
        ORDER BY wo.WeighDateTime DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
