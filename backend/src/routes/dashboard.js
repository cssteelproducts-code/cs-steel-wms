const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard/summary
router.get('/summary', authenticate, async (req, res) => {
  try {
    const pool = getPool();

    const settle = r => r.status === 'fulfilled' ? r.value : null;

    const results = await Promise.allSettled([
      pool.request().query(`
        SELECT
          COUNT(*) as TotalTrips,
          SUM(CASE WHEN Status = 'Complete' THEN 1 ELSE 0 END) as Completed,
          SUM(CASE WHEN Status NOT IN ('Complete','Cancelled') THEN 1 ELSE 0 END) as InProgress,
          SUM(CASE WHEN Status = 'Cancelled' THEN 1 ELSE 0 END) as Cancelled
        FROM WMS_Trips
        WHERE CAST(TripDate AS DATE) = CAST(GETDATE() AS DATE)
      `),
      pool.request().query(`
        SELECT
          SUM(wo.NetWeight) as TotalNetWeight,
          AVG(wo.NetWeight) as AvgNetWeight,
          MAX(wo.NetWeight) as MaxNetWeight,
          COUNT(*) as CompletedCount
        FROM WMS_WeighOut wo
        JOIN WMS_Trips t ON wo.TripID = t.TripID
        WHERE CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
      `),
      pool.request().query(`
        SELECT Status, COUNT(*) as Count
        FROM WMS_Trips
        WHERE CAST(TripDate AS DATE) = CAST(GETDATE() AS DATE)
        AND Status NOT IN ('Complete','Cancelled')
        GROUP BY Status
      `),
      pool.request().query(`
        SELECT AVG(DATEDIFF(MINUTE, wi.WeighDateTime, wo.WeighDateTime)) as AvgMinutes
        FROM WMS_Trips t
        JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
        JOIN WMS_WeighOut wo ON t.TripID = wo.TripID
        WHERE CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
      `),
      pool.request().query(`
        SELECT TOP 10 t.TripID, t.LicensePlate, t.Status, t.CreatedAt,
               c.CustomerName, w.WarehouseName,
               vt.TypeName as VehicleType
        FROM WMS_Trips t
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        WHERE CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY t.CreatedAt DESC
      `),
      pool.request().query(`
        SELECT ls.StationName,
               COUNT(dst.TripID) as ActiveTrucks
        FROM WMS_LoadingStations ls
        LEFT JOIN WMS_DataStationTargets dst ON ls.StationID = dst.StationID
        LEFT JOIN WMS_Trips t ON dst.TripID = t.TripID
          AND t.Status IN ('WaitPick','Loading')
          AND CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
        WHERE ls.IsActive = 1
        GROUP BY ls.StationID, ls.StationName, ls.SortOrder
        HAVING COUNT(dst.TripID) > 0
        ORDER BY ls.SortOrder
      `),
      pool.request().query(`
        SELECT CAST(TripDate AS DATE) as TripDate,
               COUNT(*) as TotalTrips,
               SUM(CASE WHEN Status='Complete' THEN 1 ELSE 0 END) as Completed
        FROM WMS_Trips
        WHERE TripDate >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE))
        GROUP BY CAST(TripDate AS DATE)
        ORDER BY TripDate
      `),
      pool.request().query(`
        SELECT
          SUM(CASE WHEN CAST(TripDate AS DATE)=CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as TodayTotal,
          SUM(CASE WHEN YEAR(TripDate)=YEAR(GETDATE()) AND MONTH(TripDate)=MONTH(GETDATE()) THEN 1 ELSE 0 END) as MonthTotal,
          SUM(CASE WHEN YEAR(TripDate)=YEAR(GETDATE()) THEN 1 ELSE 0 END) as YearTotal
        FROM WMS_Trips
      `),
      pool.request().query(`
        SELECT
          SUM(CASE WHEN CAST(t.TripDate AS DATE)=CAST(GETDATE() AS DATE) THEN ISNULL(wo.NetWeight,0) ELSE 0 END) as TodayWeight,
          SUM(CASE WHEN CAST(t.TripDate AS DATE)=CAST(DATEADD(DAY,-1,GETDATE()) AS DATE) THEN ISNULL(wo.NetWeight,0) ELSE 0 END) as YesterdayWeight
        FROM WMS_Trips t
        LEFT JOIN WMS_WeighOut wo ON wo.TripID = t.TripID
        WHERE CAST(t.TripDate AS DATE) >= CAST(DATEADD(DAY,-2,GETDATE()) AS DATE)
      `),
      pool.request().query(`
        SELECT vt.TypeName, COUNT(*) as Count
        FROM WMS_Trips t
        JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        WHERE CAST(t.TripDate AS DATE)=CAST(GETDATE() AS DATE)
        GROUP BY vt.TypeName ORDER BY Count DESC
      `),
      pool.request().query(`
        SELECT
          SUM(CASE WHEN CAST(t.TripDate AS DATE)=CAST(GETDATE() AS DATE)
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) >= ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) <= ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0)
            THEN 1 ELSE 0 END) as TodayOnTime,
          SUM(CASE WHEN CAST(t.TripDate AS DATE)=CAST(GETDATE() AS DATE)
            AND (DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) < ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
              OR DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) > ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0))
            THEN 1 ELSE 0 END) as TodayOvertime,
          SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETDATE()) AND MONTH(t.TripDate)=MONTH(GETDATE())
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) >= ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) <= ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0)
            THEN 1 ELSE 0 END) as MonthOnTime,
          SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETDATE()) AND MONTH(t.TripDate)=MONTH(GETDATE())
            AND (DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) < ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
              OR DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) > ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0))
            THEN 1 ELSE 0 END) as MonthOvertime,
          SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETDATE())
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) >= ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) <= ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0)
            THEN 1 ELSE 0 END) as YearOnTime,
          SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETDATE())
            AND (DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) < ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
              OR DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) > ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0))
            THEN 1 ELSE 0 END) as YearOvertime
        FROM WMS_Trips t
        JOIN WMS_WeighIn wi ON t.TripID=wi.TripID
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
      `),
      pool.request().query(`
        SELECT vt.TypeName, COUNT(*) as Count
        FROM WMS_Trips t JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        WHERE YEAR(t.TripDate)=YEAR(GETDATE()) AND MONTH(t.TripDate)=MONTH(GETDATE())
        GROUP BY vt.TypeName ORDER BY Count DESC
      `),
      pool.request().query(`
        SELECT vt.TypeName, COUNT(*) as Count
        FROM WMS_Trips t JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        WHERE YEAR(t.TripDate)=YEAR(GETDATE())
        GROUP BY vt.TypeName ORDER BY Count DESC
      `),
      pool.request().query(`
        SELECT t.TripID, t.LicensePlate, ISNULL(vt.TypeName, '-') as TypeName,
               lr.EntryTime,
               DATEDIFF(HOUR, lr.EntryTime, GETUTCDATE()) as HoursIn,
               CASE WHEN
                 DATEPART(HOUR,DATEADD(MINUTE,420,lr.EntryTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,lr.EntryTime)) < ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
                 OR DATEPART(HOUR,DATEADD(MINUTE,420,lr.EntryTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,lr.EntryTime)) > ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0)
               THEN 1 ELSE 0 END as IsOvertime
        FROM WMS_LoadingRecord lr
        JOIN WMS_Trips t ON lr.TripID=t.TripID
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        WHERE lr.ExitTime IS NULL AND t.Status NOT IN ('Complete','Cancelled')
        ORDER BY lr.EntryTime
      `),
      pool.request().query(`
        SELECT TOP 20 t.TripID, t.LicensePlate, t.CompletedAt,
               ISNULL(vt.TypeName, '-') as TypeName,
               wo.NetWeight,
               DATEDIFF(MINUTE, wi.WeighDateTime, wo.WeighDateTime) as Minutes
        FROM WMS_Trips t
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        LEFT JOIN WMS_WeighOut wo ON t.TripID=wo.TripID
        LEFT JOIN WMS_WeighIn wi ON t.TripID=wi.TripID
        WHERE t.Status='Complete' AND CAST(t.CompletedAt AS DATE)=CAST(GETDATE() AS DATE)
        ORDER BY t.CompletedAt DESC
      `),
      pool.request().query(`
        SELECT
          ISNULL(DeliveryType,'') as DeliveryType,
          SUM(CASE WHEN CAST(TripDate AS DATE)=CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as TodayCount,
          SUM(CASE WHEN YEAR(TripDate)=YEAR(GETDATE()) AND MONTH(TripDate)=MONTH(GETDATE()) THEN 1 ELSE 0 END) as MonthCount,
          SUM(CASE WHEN YEAR(TripDate)=YEAR(GETDATE()) THEN 1 ELSE 0 END) as YearCount
        FROM WMS_Trips
        WHERE DeliveryType IS NOT NULL AND DeliveryType != ''
        GROUP BY DeliveryType
      `)
    ]);

    const [
      todayStats, weightStats, statusFlow, avgTime, recentActivity,
      stationLoad, weeklyTrend, tripCounts, weightHistory,
      vehicleTypesToday, onTimeStats, vtBreakdownMonth, vtBreakdownYear,
      incompleteLoading, completedToday, deliveryTypeResult
    ] = results.map(settle);

    // Log any failed queries for debugging
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.warn(`Dashboard query[${i}] failed:`, r.reason?.message);
    });

    const deliveryTypeStats = deliveryTypeResult?.recordset || [];

    res.json({
      success: true,
      data: {
        today: todayStats?.recordset[0] || {},
        weight: weightStats?.recordset[0] || {},
        statusFlow: statusFlow?.recordset || [],
        avgProcessingMinutes: avgTime?.recordset[0]?.AvgMinutes || 0,
        recentActivity: recentActivity?.recordset || [],
        stationLoad: stationLoad?.recordset || [],
        weeklyTrend: weeklyTrend?.recordset || [],
        tripCounts: tripCounts?.recordset[0] || {},
        weightHistory: weightHistory?.recordset[0] || {},
        vehicleTypesToday: vehicleTypesToday?.recordset || [],
        onTimeStats: onTimeStats?.recordset[0] || {},
        vtBreakdownMonth: vtBreakdownMonth?.recordset || [],
        vtBreakdownYear: vtBreakdownYear?.recordset || [],
        incompleteLoading: incompleteLoading?.recordset || [],
        completedToday: completedToday?.recordset || [],
        deliveryTypeStats
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/dashboard/history?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/history', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ success: false, message: 'ต้องระบุวันที่' });
    const pool = getPool();
    const result = await pool.request()
      .input('From', sql.Date, from)
      .input('To', sql.Date, to)
      .query(`
        SELECT t.TripID, t.LicensePlate, CAST(t.TripDate AS DATE) as TripDate, t.CompletedAt,
               ISNULL(vt.TypeName,'-') as TypeName, ISNULL(c.CustomerName,'-') as CustomerName,
               wo.NetWeight, DATEDIFF(MINUTE,wi.WeighDateTime,wo.WeighDateTime) as Minutes
        FROM WMS_Trips t
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        LEFT JOIN WMS_Customers c ON t.CustomerID=c.CustomerID
        LEFT JOIN WMS_WeighOut wo ON t.TripID=wo.TripID
        LEFT JOIN WMS_WeighIn wi ON t.TripID=wi.TripID
        WHERE t.Status='Complete'
          AND CAST(t.TripDate AS DATE) BETWEEN @From AND @To
        ORDER BY t.TripDate DESC, t.CompletedAt DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/dashboard/monthly-report?month=YYYY-MM
router.get('/monthly-report', authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'ต้องระบุเดือน' });
    const [year, mon] = month.split('-').map(Number);
    if (!year || !mon) return res.status(400).json({ success: false, message: 'รูปแบบเดือนไม่ถูกต้อง (YYYY-MM)' });
    const pool = getPool();
    const result = await pool.request()
      .input('Year', sql.Int, year)
      .input('Month', sql.Int, mon)
      .query(`
        SELECT t.LicensePlate, ISNULL(vt.TypeName,'-') as TypeName,
               COUNT(*) as TripCount,
               SUM(ISNULL(wo.NetWeight,0)) as TotalWeight,
               SUM(CASE WHEN t.Status='Complete' THEN 1 ELSE 0 END) as Completed
        FROM WMS_Trips t
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        LEFT JOIN WMS_WeighOut wo ON t.TripID=wo.TripID
        WHERE YEAR(t.TripDate)=@Year AND MONTH(t.TripDate)=@Month
        GROUP BY t.LicensePlate, vt.TypeName
        ORDER BY TripCount DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/dashboard/live - Live trip monitor
router.get('/live', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT t.TripID, t.LicensePlate, t.Status, t.CreatedAt,
             vt.TypeName as VehicleType,
             w.WarehouseName,
             c.CustomerName,
             wi.TareWeight, wi.WeighDateTime as WeighInTime,
             ds.PickDocumentNo,
             ls_target.StationName as TargetStation,
             DATEDIFF(MINUTE, t.CreatedAt, GETUTCDATE()) as MinutesInWarehouse,
             (SELECT TOP 1 ls2.StationName
              FROM WMS_LoadingRecord lr2
              JOIN WMS_LoadingStations ls2 ON lr2.StationID = ls2.StationID
              WHERE lr2.TripID = t.TripID AND lr2.ExitTime IS NULL) as CurrentStation
      FROM WMS_Trips t
      LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
      LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
      LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
      LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
      LEFT JOIN WMS_DataStation ds ON t.TripID = ds.TripID
      LEFT JOIN WMS_LoadingStations ls_target ON ds.TargetStationID = ls_target.StationID
      WHERE t.Status NOT IN ('Complete','Cancelled')
      AND CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
      ORDER BY t.CreatedAt DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/dashboard/report - Daily report
router.get('/report', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { date, warehouseId } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];

    let whereClause = 'WHERE CAST(t.TripDate AS DATE) = @ReportDate';
    const request = pool.request();
    request.input('ReportDate', sql.Date, reportDate);

    if (warehouseId) {
      whereClause += ' AND t.WarehouseID = @WarehouseID';
      request.input('WarehouseID', sql.Int, warehouseId);
    }

    const result = await request.query(`
      SELECT t.TripID, t.LicensePlate, t.Status, t.TripDate, t.CreatedAt, t.CompletedAt,
             vt.TypeName as VehicleType,
             w.WarehouseName,
             c.CustomerName,
             wi.TareWeight, wi.WeighDateTime as WeighInTime,
             ds.PickDocumentNo,
             ls_t.StationName as TargetStation,
             wo.GrossWeight, wo.NetWeight, wo.WeighDateTime as WeighOutTime,
             DATEDIFF(MINUTE, wi.WeighDateTime, wo.WeighDateTime) as ProcessingMinutes
      FROM WMS_Trips t
      LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
      LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
      LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
      LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
      LEFT JOIN WMS_DataStation ds ON t.TripID = ds.TripID
      LEFT JOIN WMS_LoadingStations ls_t ON ds.TargetStationID = ls_t.StationID
      LEFT JOIN WMS_WeighOut wo ON t.TripID = wo.TripID
      ${whereClause}
      ORDER BY t.CreatedAt
    `);

    res.json({ success: true, data: result.recordset, reportDate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/dashboard/station-vehicles?stationName=...
router.get('/station-vehicles', authenticate, async (req, res) => {
  try {
    const { stationName } = req.query;
    if (!stationName) return res.status(400).json({ success: false, message: 'stationName required' });
    const pool = getPool();
    const result = await pool.request()
      .input('stationName', sql.NVarChar, stationName)
      .query(`
        SELECT
          t.TripID, t.LicensePlate, t.VehicleTypeID,
          c.CustomerName,
          vt.TypeName AS VehicleTypeName,
          lr.EntryTime,
          DATEDIFF(MINUTE, lr.EntryTime, GETUTCDATE()) AS MinutesIn
        FROM WMS_LoadingRecord lr
        JOIN WMS_LoadingStations ls ON lr.StationID = ls.StationID
        JOIN WMS_Trips t ON lr.TripID = t.TripID
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        WHERE ls.StationName = @stationName
          AND lr.ExitTime IS NULL
          AND CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY lr.EntryTime
      `);
    res.json({ success: true, data: result.recordset, stationName });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
