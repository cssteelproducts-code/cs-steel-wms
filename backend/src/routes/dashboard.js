const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// Simple in-memory TTL cache — avoids re-running expensive queries on every poll
const _cache = new Map();
const getCache = (k) => { const e = _cache.get(k); return (e && Date.now() < e.exp) ? e.data : null; };
const setCache = (k, d, ms) => _cache.set(k, { data: d, exp: Date.now() + ms });

// GET /api/dashboard/summary
router.get('/summary', authenticate, async (req, res) => {
  const cached = getCache('dashboard:summary');
  if (cached) return res.json({ success: true, data: cached });
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
        WHERE CAST(TripDate AS DATE) = CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
      `),
      pool.request().query(`
        SELECT
          SUM(wo.NetWeight) as TotalNetWeight,
          AVG(wo.NetWeight) as AvgNetWeight,
          MAX(wo.NetWeight) as MaxNetWeight,
          COUNT(*) as CompletedCount
        FROM WMS_WeighOut wo
        JOIN WMS_Trips t ON wo.TripID = t.TripID
        WHERE CAST(t.TripDate AS DATE) = CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
      `),
      pool.request().query(`
        SELECT Status, COUNT(*) as Count
        FROM WMS_Trips
        WHERE CAST(TripDate AS DATE) = CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
        AND Status NOT IN ('Complete','Cancelled')
        GROUP BY Status
      `),
      pool.request().query(`
        SELECT AVG(DATEDIFF(MINUTE, wi.WeighDateTime, wo.WeighDateTime)) as AvgMinutes
        FROM WMS_Trips t
        JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
        JOIN WMS_WeighOut wo ON t.TripID = wo.TripID
        WHERE CAST(t.TripDate AS DATE) = CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
      `),
      pool.request().query(`
        SELECT TOP 10 t.TripID, t.LicensePlate, t.Status, t.CreatedAt,
               t.SOWaitStartedAt,
               c.CustomerName, w.WarehouseName,
               vt.TypeName as VehicleType,
               wi.WeighDateTime as WeighInTime,
               ISNULL(lr_ex.HasRecord, 0) as HasLoadingRecord,
               ISNULL(dst_ex.HasTargets, 0) as HasDataStationTargets,
               cur.StationName as CurrentStation
        FROM WMS_Trips t
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
        LEFT JOIN (SELECT DISTINCT TripID, 1 as HasRecord FROM WMS_LoadingRecord) lr_ex ON lr_ex.TripID = t.TripID
        LEFT JOIN (SELECT DISTINCT TripID, 1 as HasTargets FROM WMS_DataStationTargets) dst_ex ON dst_ex.TripID = t.TripID
        LEFT JOIN (
          SELECT lr.TripID, ls.StationName,
            ROW_NUMBER() OVER (PARTITION BY lr.TripID ORDER BY lr.EntryTime DESC) as rn
          FROM WMS_LoadingRecord lr JOIN WMS_LoadingStations ls ON lr.StationID=ls.StationID
          WHERE lr.ExitTime IS NULL
        ) cur ON cur.TripID = t.TripID AND cur.rn = 1
        WHERE t.TripDate >= CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
          AND t.Status NOT IN ('Complete','Cancelled')
        ORDER BY t.CreatedAt DESC
      `),
      pool.request().query(`
        SELECT ls.StationName,
               COUNT(DISTINCT t.TripID) as ActiveTrucks
        FROM WMS_LoadingStations ls
        JOIN WMS_DataStationTargets dst ON ls.StationID = dst.StationID
        JOIN WMS_Trips t ON dst.TripID = t.TripID
          AND t.Status NOT IN ('Complete','Cancelled','WeighOut','Checker')
          AND CAST(t.TripDate AS DATE) = CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
        LEFT JOIN WMS_LoadingRecord lr_done ON lr_done.TripID = t.TripID
          AND lr_done.StationID = ls.StationID AND lr_done.ExitTime IS NOT NULL
        WHERE ls.IsActive = 1
          AND lr_done.RecordID IS NULL
        GROUP BY ls.StationID, ls.StationName, ls.SortOrder
        HAVING COUNT(DISTINCT t.TripID) > 0
        ORDER BY ls.SortOrder
      `),
      pool.request().query(`
        SELECT CAST(TripDate AS DATE) as TripDate,
               COUNT(*) as TotalTrips,
               SUM(CASE WHEN Status='Complete' THEN 1 ELSE 0 END) as Completed
        FROM WMS_Trips
        WHERE TripDate >= DATEADD(DAY, -14, CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE))
        GROUP BY CAST(TripDate AS DATE)
        ORDER BY TripDate
      `),
      pool.request().query(`
        SELECT
          SUM(CASE WHEN CAST(TripDate AS DATE)=CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END) as TodayTotal,
          SUM(CASE WHEN YEAR(TripDate)=YEAR(GETUTCDATE()) AND MONTH(TripDate)=MONTH(GETUTCDATE()) THEN 1 ELSE 0 END) as MonthTotal,
          SUM(CASE WHEN YEAR(TripDate)=YEAR(GETUTCDATE()) THEN 1 ELSE 0 END) as YearTotal
        FROM WMS_Trips
      `),
      pool.request().query(`
        SELECT
          SUM(CASE WHEN CAST(t.TripDate AS DATE)=
            CASE DATEPART(WEEKDAY,GETUTCDATE()) WHEN 2 THEN DATEADD(DAY,-2,CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE))
            ELSE DATEADD(DAY,-1,CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)) END
          THEN ISNULL(wo.NetWeight,0) ELSE 0 END) as YesterdayWeight,
          SUM(CASE WHEN CAST(t.TripDate AS DATE)=
            CASE DATEPART(WEEKDAY,GETUTCDATE())
              WHEN 2 THEN DATEADD(DAY,-3,CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE))
              WHEN 3 THEN DATEADD(DAY,-3,CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE))
              ELSE DATEADD(DAY,-2,CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)) END
          THEN ISNULL(wo.NetWeight,0) ELSE 0 END) as DayBeforeWeight
        FROM WMS_Trips t
        LEFT JOIN WMS_WeighOut wo ON wo.TripID = t.TripID
        WHERE CAST(t.TripDate AS DATE) >= CAST(DATEADD(DAY,-7,GETDATE()) AS DATE)
      `),
      pool.request().query(`
        SELECT vt.TypeName, COUNT(*) as Count
        FROM WMS_Trips t
        JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        WHERE CAST(t.TripDate AS DATE)=CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
        GROUP BY vt.TypeName ORDER BY Count DESC
      `),
      pool.request().query(`
        SELECT
          SUM(CASE WHEN CAST(t.TripDate AS DATE)=CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) >= ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) <= ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0)
            THEN 1 ELSE 0 END) as TodayOnTime,
          SUM(CASE WHEN CAST(t.TripDate AS DATE)=CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
            AND (DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) < ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
              OR DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) > ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0))
            THEN 1 ELSE 0 END) as TodayOvertime,
          SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETUTCDATE()) AND MONTH(t.TripDate)=MONTH(GETUTCDATE())
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) >= ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) <= ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0)
            THEN 1 ELSE 0 END) as MonthOnTime,
          SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETUTCDATE()) AND MONTH(t.TripDate)=MONTH(GETUTCDATE())
            AND (DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) < ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
              OR DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) > ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0))
            THEN 1 ELSE 0 END) as MonthOvertime,
          SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETUTCDATE())
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) >= ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
            AND DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) <= ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0)
            THEN 1 ELSE 0 END) as YearOnTime,
          SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETUTCDATE())
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
        WHERE YEAR(t.TripDate)=YEAR(GETUTCDATE()) AND MONTH(t.TripDate)=MONTH(GETUTCDATE())
        GROUP BY vt.TypeName ORDER BY Count DESC
      `),
      pool.request().query(`
        SELECT vt.TypeName, COUNT(*) as Count
        FROM WMS_Trips t JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        WHERE YEAR(t.TripDate)=YEAR(GETUTCDATE())
        GROUP BY vt.TypeName ORDER BY Count DESC
      `),
      pool.request().query(`
        SELECT t.TripID, t.LicensePlate, ISNULL(vt.TypeName, '-') as TypeName,
               lr.EntryTime,
               DATEDIFF(HOUR, lr.EntryTime, DATEADD(HOUR,7,GETUTCDATE())) as HoursIn,
               CASE WHEN
                 DATEPART(HOUR,lr.EntryTime)*60+DATEPART(MINUTE,lr.EntryTime) < ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
                 OR DATEPART(HOUR,lr.EntryTime)*60+DATEPART(MINUTE,lr.EntryTime) > ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0)
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
        WHERE t.Status='Complete' AND CAST(t.CompletedAt AS DATE)=CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
        ORDER BY t.CompletedAt DESC
      `),
      pool.request().query(`
        SELECT
          ISNULL(DeliveryType,'') as DeliveryType,
          SUM(CASE WHEN CAST(TripDate AS DATE)=CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END) as TodayCount,
          SUM(CASE WHEN YEAR(TripDate)=YEAR(GETUTCDATE()) AND MONTH(TripDate)=MONTH(GETUTCDATE()) THEN 1 ELSE 0 END) as MonthCount,
          SUM(CASE WHEN YEAR(TripDate)=YEAR(GETUTCDATE()) THEN 1 ELSE 0 END) as YearCount
        FROM WMS_Trips
        WHERE DeliveryType IS NOT NULL AND DeliveryType != ''
        GROUP BY DeliveryType
      `),
      pool.request().query(`
        SELECT ls.StationName, ls.StationCode,
          COUNT(*) as TotalTrips,
          AVG(lr.DurationMinutes) as AvgMinutes,
          MIN(lr.DurationMinutes) as MinMinutes,
          MAX(lr.DurationMinutes) as MaxMinutes,
          SUM(CASE WHEN CAST(lr.EntryTime AS DATE)=CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END) as TodayTrips
        FROM WMS_LoadingRecord lr
        JOIN WMS_LoadingStations ls ON lr.StationID=ls.StationID
        WHERE lr.ExitTime IS NOT NULL
          AND lr.DurationMinutes > 0
          AND lr.EntryTime >= DATEADD(DAY,-30,GETUTCDATE())
        GROUP BY ls.StationID, ls.StationName, ls.StationCode
        ORDER BY AVG(lr.DurationMinutes) DESC
      `),
      pool.request().query(`
        SELECT vt.TypeName, COUNT(*) as Count
        FROM WMS_Trips t
        JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        JOIN WMS_WeighIn wi ON t.TripID=wi.TripID
        WHERE CAST(t.TripDate AS DATE)=CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
          AND (DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) < ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
            OR DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) > ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0))
        GROUP BY vt.TypeName ORDER BY Count DESC
      `),
      pool.request().query(`
        SELECT vt.TypeName, COUNT(*) as Count
        FROM WMS_Trips t
        JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        JOIN WMS_WeighIn wi ON t.TripID=wi.TripID
        WHERE YEAR(t.TripDate)=YEAR(GETUTCDATE()) AND MONTH(t.TripDate)=MONTH(GETUTCDATE())
          AND (DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) < ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
            OR DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) > ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0))
        GROUP BY vt.TypeName ORDER BY Count DESC
      `),
      pool.request().query(`
        SELECT vt.TypeName, COUNT(*) as Count
        FROM WMS_Trips t
        JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
        JOIN WMS_WeighIn wi ON t.TripID=wi.TripID
        WHERE YEAR(t.TripDate)=YEAR(GETUTCDATE())
          AND (DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) < ISNULL(vt.StartHour,8)*60+ISNULL(vt.StartMinute,0)
            OR DATEPART(HOUR,DATEADD(MINUTE,420,wi.WeighDateTime))*60+DATEPART(MINUTE,DATEADD(MINUTE,420,wi.WeighDateTime)) > ISNULL(vt.CutoffHour,16)*60+ISNULL(vt.CutoffMinute,0))
        GROUP BY vt.TypeName ORDER BY Count DESC
      `)
    ]);

    const [
      todayStats, weightStats, statusFlow, avgTime, recentActivity,
      stationLoad, weeklyTrend, tripCounts, weightHistory,
      vehicleTypesToday, onTimeStats, vtBreakdownMonth, vtBreakdownYear,
      incompleteLoading, completedToday, deliveryTypeResult, stationAvgTimeResult,
      overtimeByTypeToday, overtimeByTypeMonth, overtimeByTypeYear
    ] = results.map(settle);

    // Log any failed queries for debugging
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.warn(`Dashboard query[${i}] failed:`, r.reason?.message);
    });

    const deliveryTypeStats = deliveryTypeResult?.recordset || [];

    const responseData = {
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
      deliveryTypeStats,
      stationAvgTime: stationAvgTimeResult?.recordset || [],
      overtimeByTypeToday: overtimeByTypeToday?.recordset || [],
      overtimeByTypeMonth: overtimeByTypeMonth?.recordset || [],
      overtimeByTypeYear:  overtimeByTypeYear?.recordset  || []
    };
    setCache('dashboard:summary', responseData, 12000); // 12s cache
    res.json({ success: true, data: responseData });
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
  const cached = getCache('dashboard:live');
  if (cached) return res.json({ success: true, data: cached });
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT t.TripID, t.LicensePlate, t.Status, t.CreatedAt,
             t.DeliveryType, t.Priority, t.SOWaitStartedAt,
             vt.TypeName as VehicleType,
             w.WarehouseName,
             c.CustomerName,
             wi.TareWeight, wi.WeighDateTime as WeighInTime,
             ds.PickDocumentNo,
             DATEDIFF(MINUTE, wi.WeighDateTime, DATEADD(HOUR,7,GETUTCDATE())) as MinutesInWarehouse,
             ISNULL(lr_ex.HasRecord, 0) as HasLoadingRecord,
             ISNULL(dst_ex.HasTargets, 0) as HasDataStationTargets,
             cur.StationName as CurrentStation,
             STUFF((
               SELECT ',' + ls3.StationName + ':' +
                 CAST(CASE WHEN EXISTS(
                   SELECT 1 FROM WMS_LoadingRecord lr3
                   WHERE lr3.TripID = t.TripID AND lr3.StationID = dst2.StationID AND lr3.ExitTime IS NOT NULL
                 ) THEN 1 ELSE 0 END AS NVARCHAR(1))
               FROM WMS_DataStationTargets dst2
               JOIN WMS_LoadingStations ls3 ON dst2.StationID = ls3.StationID
               WHERE dst2.TripID = t.TripID
               FOR XML PATH(''), TYPE).value('.','NVARCHAR(MAX)'), 1, 1, '') as TargetStations
      FROM WMS_Trips t
      LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
      LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
      LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
      LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
      LEFT JOIN WMS_DataStation ds ON t.TripID = ds.TripID
      LEFT JOIN (SELECT DISTINCT TripID, 1 as HasRecord FROM WMS_LoadingRecord) lr_ex ON lr_ex.TripID = t.TripID
      LEFT JOIN (SELECT DISTINCT TripID, 1 as HasTargets FROM WMS_DataStationTargets) dst_ex ON dst_ex.TripID = t.TripID
      LEFT JOIN (
        SELECT lr.TripID, ls2.StationName,
          ROW_NUMBER() OVER (PARTITION BY lr.TripID ORDER BY lr.EntryTime DESC) as rn
        FROM WMS_LoadingRecord lr JOIN WMS_LoadingStations ls2 ON lr.StationID=ls2.StationID
        WHERE lr.ExitTime IS NULL
      ) cur ON cur.TripID = t.TripID AND cur.rn = 1
      WHERE t.Status NOT IN ('Complete','Cancelled')
      AND CAST(t.TripDate AS DATE) = CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
      ORDER BY t.CreatedAt DESC
    `);
    setCache('dashboard:live', result.recordset, 8000); // 8s cache
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
          t.TripID, t.LicensePlate, t.Status,
          c.CustomerName,
          vt.TypeName AS VehicleTypeName,
          wi.WeighDateTime AS WeighInTime,
          DATEDIFF(MINUTE, wi.WeighDateTime, DATEADD(HOUR,7,GETUTCDATE())) AS MinutesIn,
          CASE WHEN lr_cur.TripID IS NOT NULL THEN 1 ELSE 0 END AS IsLoading
        FROM WMS_DataStationTargets dst
        JOIN WMS_LoadingStations ls ON dst.StationID = ls.StationID
        JOIN WMS_Trips t ON dst.TripID = t.TripID
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
        LEFT JOIN WMS_LoadingRecord lr_done ON lr_done.TripID = t.TripID
          AND lr_done.StationID = ls.StationID AND lr_done.ExitTime IS NOT NULL
        LEFT JOIN WMS_LoadingRecord lr_cur ON lr_cur.TripID = t.TripID
          AND lr_cur.StationID = ls.StationID AND lr_cur.ExitTime IS NULL
        WHERE ls.StationName = @stationName
          AND t.Status NOT IN ('Complete','Cancelled','WeighOut','Checker')
          AND CAST(t.TripDate AS DATE) = CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
          AND lr_done.RecordID IS NULL
        ORDER BY t.CreatedAt
      `);
    res.json({ success: true, data: result.recordset, stationName });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
