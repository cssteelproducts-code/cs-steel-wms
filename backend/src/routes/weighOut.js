const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const cache = require('../utils/cache');

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
        FROM WMS_Trips t WITH (NOLOCK)
        LEFT JOIN WMS_WeighIn wi WITH (NOLOCK) ON t.TripID = wi.TripID
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
        .input('GrossWeight', sql.Decimal(10, 2), grossWeight)
        .input('TareWeight', sql.Decimal(10, 2), tareWeight)
        .input('NetWeight', sql.Decimal(10, 2), netWeight)
        .input('Notes', sql.NVarChar, notes || '')
        .input('OperatorID', sql.Int, req.user.UserID)
        .query(`INSERT INTO WMS_WeighOut (TripID, WeighDateTime, GrossWeight, TareWeight, NetWeight, Notes, OperatorID)
                VALUES (@TripID, DATEADD(HOUR,7,GETUTCDATE()), @GrossWeight, @TareWeight, @NetWeight, @Notes, @OperatorID)`);

      await transaction.request()
        .input('TripID', sql.Int, tripId)
        .query(`UPDATE WMS_Trips SET Status='Checker' WHERE TripID=@TripID`);

      await transaction.commit();

      cache.del('wo:pending', 'wo:today');

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

// GET /api/weigh-out/pending
router.get('/pending', authenticate, async (req, res) => {
  try {
    const data = await cache.wrap('wo:pending', async () => {
      const pool = getPool();
      const result = await pool.request().query(`
        SELECT t.TripID, t.LicensePlate, t.Status, t.CreatedAt, t.TripDate,
               t.DeliveryType, t.Priority, t.CustomerID, t.SOWaitStartedAt,
               vt.TypeName  AS VehicleType,
               w.WarehouseName,
               c.CustomerName,
               wi.TareWeight, wi.WeighDateTime AS WeighInTime,
               ds.PickDocumentNo,
               DATEDIFF(MINUTE, wi.WeighDateTime, DATEADD(HOUR,7,GETUTCDATE())) AS MinutesInWarehouse,
               CASE WHEN EXISTS(SELECT 1 FROM WMS_LoadingRecord      WITH (NOLOCK) WHERE TripID=t.TripID) THEN 1 ELSE 0 END AS HasLoadingRecord,
               CASE WHEN EXISTS(SELECT 1 FROM WMS_DataStationTargets WITH (NOLOCK) WHERE TripID=t.TripID) THEN 1 ELSE 0 END AS HasDataStationTargets,
               cur.StationName AS CurrentStation
        FROM WMS_Trips t WITH (NOLOCK)
        INNER JOIN WMS_WeighIn wi      WITH (NOLOCK) ON wi.TripID     = t.TripID
        LEFT JOIN  WMS_VehicleTypes vt WITH (NOLOCK) ON vt.TypeID     = t.VehicleTypeID
        LEFT JOIN  WMS_Warehouses w    WITH (NOLOCK) ON w.WarehouseID = t.WarehouseID
        LEFT JOIN  WMS_Customers c     WITH (NOLOCK) ON c.CustomerID  = t.CustomerID
        LEFT JOIN  WMS_DataStation ds  WITH (NOLOCK) ON ds.TripID     = t.TripID
        OUTER APPLY (
          SELECT TOP 1 ls.StationName
          FROM WMS_LoadingRecord lr WITH (NOLOCK)
          JOIN WMS_LoadingStations ls WITH (NOLOCK) ON ls.StationID = lr.StationID
          WHERE lr.TripID = t.TripID AND lr.ExitTime IS NULL
          ORDER BY lr.EntryTime DESC
        ) cur
        WHERE t.Status NOT IN ('Complete','Cancelled')
          AND t.TripDate >= CAST(DATEADD(DAY,-1, DATEADD(HOUR,7,GETUTCDATE())) AS DATE)
        ORDER BY
          CASE t.Status WHEN 'WeighOut' THEN 0 WHEN 'Loading' THEN 1 WHEN 'WaitPick' THEN 2 WHEN 'Data' THEN 3 ELSE 4 END,
          t.CreatedAt DESC
      `);
      return result.recordset;
    }, 10_000);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[WeighOut/pending] error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/weigh-out/today
router.get('/today', authenticate, async (req, res) => {
  try {
    const data = await cache.wrap('wo:today', async () => {
      const pool = getPool();
      const result = await pool.request().query(`
        SELECT t.TripID, t.LicensePlate, t.CompletedAt,
               vt.TypeName AS VehicleType,
               c.CustomerName,
               w.WarehouseName,
               wi.TareWeight, wi.WeighDateTime AS WeighInTime,
               wo.GrossWeight, wo.NetWeight, wo.WeighDateTime AS WeighOutTime,
               DATEDIFF(MINUTE, wi.WeighDateTime, wo.WeighDateTime) AS TotalMinutes,
               u.FullName AS OperatorName
        FROM WMS_WeighOut wo WITH (NOLOCK)
        JOIN  WMS_Trips t         WITH (NOLOCK) ON t.TripID      = wo.TripID
        LEFT JOIN WMS_VehicleTypes vt WITH (NOLOCK) ON vt.TypeID    = t.VehicleTypeID
        LEFT JOIN WMS_Customers c     WITH (NOLOCK) ON c.CustomerID  = t.CustomerID
        LEFT JOIN WMS_Warehouses w    WITH (NOLOCK) ON w.WarehouseID = t.WarehouseID
        LEFT JOIN WMS_WeighIn wi      WITH (NOLOCK) ON wi.TripID     = t.TripID
        LEFT JOIN WMS_Users u         WITH (NOLOCK) ON u.UserID      = wo.OperatorID
        WHERE CAST(wo.WeighDateTime AS DATE) >= CAST(DATEADD(DAY,-1, DATEADD(HOUR,7,GETUTCDATE())) AS DATE)
        ORDER BY wo.WeighDateTime DESC
      `);
      return result.recordset;
    }, 15_000);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.clearPendingCache = () => cache.del('wo:pending', 'wo:today');
