const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard/summary
router.get('/summary', authenticate, async (req, res) => {
  try {
    const pool = getPool();

    const todayStats = await pool.request().query(`
      SELECT
        COUNT(*) as TotalTrips,
        SUM(CASE WHEN Status = 'Complete' THEN 1 ELSE 0 END) as Completed,
        SUM(CASE WHEN Status NOT IN ('Complete','Cancelled') THEN 1 ELSE 0 END) as InProgress,
        SUM(CASE WHEN Status = 'Cancelled' THEN 1 ELSE 0 END) as Cancelled
      FROM WMS_Trips
      WHERE CAST(TripDate AS DATE) = CAST(GETDATE() AS DATE)
    `);

    const weightStats = await pool.request().query(`
      SELECT
        SUM(wo.NetWeight) as TotalNetWeight,
        AVG(wo.NetWeight) as AvgNetWeight,
        MAX(wo.NetWeight) as MaxNetWeight,
        COUNT(*) as CompletedCount
      FROM WMS_WeighOut wo
      JOIN WMS_Trips t ON wo.TripID = t.TripID
      WHERE CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
    `);

    const statusFlow = await pool.request().query(`
      SELECT Status, COUNT(*) as Count
      FROM WMS_Trips
      WHERE CAST(TripDate AS DATE) = CAST(GETDATE() AS DATE)
      AND Status NOT IN ('Complete','Cancelled')
      GROUP BY Status
    `);

    const avgTime = await pool.request().query(`
      SELECT AVG(DATEDIFF(MINUTE, wi.WeighDateTime, wo.WeighDateTime)) as AvgMinutes
      FROM WMS_Trips t
      JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
      JOIN WMS_WeighOut wo ON t.TripID = wo.TripID
      WHERE CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
    `);

    const recentActivity = await pool.request().query(`
      SELECT TOP 10 t.TripID, t.LicensePlate, t.Status, t.CreatedAt,
             c.CustomerName, w.WarehouseName,
             vt.TypeName as VehicleType
      FROM WMS_Trips t
      LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
      LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
      LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
      WHERE CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
      ORDER BY t.CreatedAt DESC
    `);

    const stationLoad = await pool.request().query(`
      SELECT ls.StationName,
             COUNT(lr.RecordID) as ActiveTrucks
      FROM WMS_LoadingStations ls
      LEFT JOIN WMS_LoadingRecord lr ON ls.StationID = lr.StationID
        AND lr.ExitTime IS NULL
        AND EXISTS(SELECT 1 FROM WMS_Trips t WHERE t.TripID = lr.TripID
                   AND CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE))
      WHERE ls.IsActive = 1
      GROUP BY ls.StationID, ls.StationName, ls.SortOrder
      ORDER BY ls.SortOrder
    `);

    const weeklyTrend = await pool.request().query(`
      SELECT CAST(TripDate AS DATE) as TripDate,
             COUNT(*) as TotalTrips,
             SUM(CASE WHEN Status='Complete' THEN 1 ELSE 0 END) as Completed
      FROM WMS_Trips
      WHERE TripDate >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE))
      GROUP BY CAST(TripDate AS DATE)
      ORDER BY TripDate
    `);

    // Trip counts today/month/year
    const tripCounts = await pool.request().query(`
      SELECT
        SUM(CASE WHEN CAST(TripDate AS DATE)=CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as TodayTotal,
        SUM(CASE WHEN YEAR(TripDate)=YEAR(GETDATE()) AND MONTH(TripDate)=MONTH(GETDATE()) THEN 1 ELSE 0 END) as MonthTotal,
        SUM(CASE WHEN YEAR(TripDate)=YEAR(GETDATE()) THEN 1 ELSE 0 END) as YearTotal
      FROM WMS_Trips
    `);

    // Weight today and previous working day (Mon→Sat, others→yesterday)
    // ISO weekday: (DATEPART(WEEKDAY,d)+@@DATEFIRST-2)%7+1 where 1=Mon ... 7=Sun
    const weightHistory = await pool.request().query(`
      DECLARE @PrevWorkDay DATE =
        CASE WHEN ((DATEPART(WEEKDAY,GETDATE())+@@DATEFIRST-2)%7+1) = 1
          THEN CAST(DATEADD(DAY,-2,GETDATE()) AS DATE)
          ELSE CAST(DATEADD(DAY,-1,GETDATE()) AS DATE)
        END;
      SELECT
        SUM(CASE WHEN CAST(t.TripDate AS DATE)=CAST(GETDATE() AS DATE) THEN ISNULL(wo.NetWeight,0) ELSE 0 END) as TodayWeight,
        SUM(CASE WHEN CAST(t.TripDate AS DATE)=@PrevWorkDay THEN ISNULL(wo.NetWeight,0) ELSE 0 END) as YesterdayWeight
      FROM WMS_Trips t
      LEFT JOIN WMS_WeighOut wo ON wo.TripID = t.TripID
      WHERE CAST(t.TripDate AS DATE) >= CAST(DATEADD(DAY,-2,GETDATE()) AS DATE)
    `);

    // Vehicle type breakdown today
    const vehicleTypesToday = await pool.request().query(`
      SELECT vt.TypeName, COUNT(*) as Count
      FROM WMS_Trips t
      JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
      WHERE CAST(t.TripDate AS DATE)=CAST(GETDATE() AS DATE)
      GROUP BY vt.TypeName ORDER BY Count DESC
    `);

    // In-time (08:00-16:59) / overtime stats for today, month, year
    const onTimeStats = await pool.request().query(`
      SELECT
        SUM(CASE WHEN CAST(t.TripDate AS DATE)=CAST(GETDATE() AS DATE) AND DATEPART(HOUR,wi.WeighDateTime) BETWEEN 8 AND 16 THEN 1 ELSE 0 END) as TodayOnTime,
        SUM(CASE WHEN CAST(t.TripDate AS DATE)=CAST(GETDATE() AS DATE) AND (DATEPART(HOUR,wi.WeighDateTime)<8 OR DATEPART(HOUR,wi.WeighDateTime)>=17) THEN 1 ELSE 0 END) as TodayOvertime,
        SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETDATE()) AND MONTH(t.TripDate)=MONTH(GETDATE()) AND DATEPART(HOUR,wi.WeighDateTime) BETWEEN 8 AND 16 THEN 1 ELSE 0 END) as MonthOnTime,
        SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETDATE()) AND MONTH(t.TripDate)=MONTH(GETDATE()) AND (DATEPART(HOUR,wi.WeighDateTime)<8 OR DATEPART(HOUR,wi.WeighDateTime)>=17) THEN 1 ELSE 0 END) as MonthOvertime,
        SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETDATE()) AND DATEPART(HOUR,wi.WeighDateTime) BETWEEN 8 AND 16 THEN 1 ELSE 0 END) as YearOnTime,
        SUM(CASE WHEN YEAR(t.TripDate)=YEAR(GETDATE()) AND (DATEPART(HOUR,wi.WeighDateTime)<8 OR DATEPART(HOUR,wi.WeighDateTime)>=17) THEN 1 ELSE 0 END) as YearOvertime
      FROM WMS_Trips t JOIN WMS_WeighIn wi ON t.TripID=wi.TripID
    `);

    // Vehicle type breakdown this month
    const vtBreakdownMonth = await pool.request().query(`
      SELECT vt.TypeName, COUNT(*) as Count
      FROM WMS_Trips t JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
      WHERE YEAR(t.TripDate)=YEAR(GETDATE()) AND MONTH(t.TripDate)=MONTH(GETDATE())
      GROUP BY vt.TypeName ORDER BY Count DESC
    `);

    // Vehicle type breakdown this year
    const vtBreakdownYear = await pool.request().query(`
      SELECT vt.TypeName, COUNT(*) as Count
      FROM WMS_Trips t JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
      WHERE YEAR(t.TripDate)=YEAR(GETDATE())
      GROUP BY vt.TypeName ORDER BY Count DESC
    `);

    // Trucks in loading stations (incomplete loading)
    const incompleteLoading = await pool.request().query(`
      SELECT t.TripID, t.LicensePlate, ISNULL(vt.TypeName, '-') as TypeName,
             lr.EntryTime,
             DATEDIFF(HOUR, lr.EntryTime, GETDATE()) as HoursIn,
             CASE WHEN DATEPART(HOUR,lr.EntryTime)<8 OR DATEPART(HOUR,lr.EntryTime)>=17 THEN 1 ELSE 0 END as IsOvertime
      FROM WMS_LoadingRecord lr
      JOIN WMS_Trips t ON lr.TripID=t.TripID
      LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID=vt.TypeID
      WHERE lr.ExitTime IS NULL AND t.Status NOT IN ('Complete','Cancelled')
      ORDER BY lr.EntryTime
    `);

    // Completed trips today
    const completedToday = await pool.request().query(`
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
    `);

    res.json({
      success: true,
      data: {
        today: todayStats.recordset[0],
        weight: weightStats.recordset[0],
        statusFlow: statusFlow.recordset,
        avgProcessingMinutes: avgTime.recordset[0]?.AvgMinutes || 0,
        recentActivity: recentActivity.recordset,
        stationLoad: stationLoad.recordset,
        weeklyTrend: weeklyTrend.recordset,
        tripCounts: tripCounts.recordset[0],
        weightHistory: weightHistory.recordset[0],
        vehicleTypesToday: vehicleTypesToday.recordset,
        onTimeStats: onTimeStats.recordset[0],
        vtBreakdownMonth: vtBreakdownMonth.recordset,
        vtBreakdownYear: vtBreakdownYear.recordset,
        incompleteLoading: incompleteLoading.recordset,
        completedToday: completedToday.recordset
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
             DATEDIFF(MINUTE, t.CreatedAt, GETDATE()) as MinutesInWarehouse,
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

module.exports = router;
