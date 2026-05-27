const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/trips - List trips with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { date, status, warehouseId, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const request = pool.request();

    if (date) {
      whereClause += ' AND CAST(t.TripDate AS DATE) = @Date';
      request.input('Date', sql.Date, date);
    } else {
      whereClause += ' AND CAST(t.TripDate AS DATE) >= CAST(DATEADD(DAY,-1,GETDATE()) AS DATE)';
    }

    if (status) {
      whereClause += ' AND t.Status = @Status';
      request.input('Status', sql.NVarChar, status);
    }

    if (warehouseId) {
      whereClause += ' AND t.WarehouseID = @WarehouseID';
      request.input('WarehouseID', sql.Int, warehouseId);
    }

    if (search) {
      whereClause += ' AND (t.LicensePlate LIKE @Search OR c.CustomerName LIKE @Search)';
      request.input('Search', sql.NVarChar, `%${search}%`);
    }

    const countResult = await request.query(`
      SELECT COUNT(*) as Total
      FROM WMS_Trips t
      LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
      ${whereClause}
    `);

    const request2 = pool.request();
    if (date) request2.input('Date', sql.Date, date);
    if (status) request2.input('Status', sql.NVarChar, status);
    if (warehouseId) request2.input('WarehouseID', sql.Int, warehouseId);
    if (search) request2.input('Search', sql.NVarChar, `%${search}%`);
    request2.input('Offset', sql.Int, offset);
    request2.input('Limit', sql.Int, parseInt(limit));

    const result = await request2.query(`
      SELECT t.TripID, t.TripDate, t.LicensePlate, t.Status, t.CreatedAt, t.CompletedAt,
             vt.TypeName as VehicleType,
             w.WarehouseName,
             c.CustomerName,
             wi.TareWeight, wi.WeighDateTime as WeighInTime,
             wo.NetWeight, wo.WeighDateTime as WeighOutTime,
             DATEDIFF(MINUTE, t.CreatedAt, ISNULL(t.CompletedAt, GETUTCDATE())) as DurationMinutes
      FROM WMS_Trips t
      LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
      LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
      LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
      LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
      LEFT JOIN WMS_WeighOut wo ON t.TripID = wo.TripID
      ${whereClause}
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
    console.error('Get trips error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trips/active - Get active trips (in warehouse)
router.get('/active', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query(`
        SELECT t.TripID, t.LicensePlate, t.Status, t.CreatedAt,
               t.DeliveryType, t.Priority,
               vt.TypeName as VehicleType,
               w.WarehouseName,
               c.CustomerName,
               wi.TareWeight, wi.WeighDateTime as WeighInTime,
               ds.DataStationID, ds.PickDocumentNo, ds.TargetStationID,
               ls_target.StationName as TargetStation,
               (SELECT COUNT(*) FROM WMS_DataStationTargets dst2
                WHERE dst2.TripID = t.TripID
                AND NOT EXISTS (
                  SELECT 1 FROM WMS_LoadingRecord lr2
                  WHERE lr2.TripID = dst2.TripID AND lr2.StationID = dst2.StationID
                  AND lr2.ExitTime IS NOT NULL
                )) as RemainingStations,
               DATEDIFF(MINUTE, t.CreatedAt, GETUTCDATE()) as MinutesInWarehouse,
               (SELECT TOP 1 StationName FROM WMS_LoadingStations ls
                JOIN WMS_LoadingRecord lr ON ls.StationID = lr.StationID
                WHERE lr.TripID = t.TripID AND lr.ExitTime IS NULL) as CurrentStation
        FROM WMS_Trips t
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
        LEFT JOIN WMS_DataStation ds ON t.TripID = ds.TripID
        LEFT JOIN WMS_LoadingStations ls_target ON ds.TargetStationID = ls_target.StationID
        WHERE t.Status NOT IN ('Complete', 'Cancelled')
        AND CAST(t.TripDate AS DATE) >= CAST(DATEADD(DAY,-1,GETDATE()) AS DATE)
        ORDER BY t.CreatedAt DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trips/:id - Get trip detail
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();

    const trip = await pool.request()
      .input('TripID', sql.Int, req.params.id)
      .query(`
        SELECT t.*, vt.TypeName as VehicleType, w.WarehouseName,
               c.CustomerName, c.CustomerCode,
               u.FullName as CreatedByName
        FROM WMS_Trips t
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_Users u ON t.CreatedBy = u.UserID
        WHERE t.TripID = @TripID
      `);

    if (trip.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล Trip' });
    }

    const tid = parseInt(req.params.id);
    const [weighIn, dataStation, loadingRecords, checker, weighOut] = await Promise.all([
      pool.request().input('TripID', sql.Int, tid)
        .query(`SELECT wi.*, u.FullName as OperatorName FROM WMS_WeighIn wi
                LEFT JOIN WMS_Users u ON wi.OperatorID = u.UserID
                WHERE wi.TripID = @TripID`),
      pool.request().input('TripID', sql.Int, tid)
        .query(`SELECT ds.*, ls.StationName as TargetStation, u.FullName as OperatorName
                FROM WMS_DataStation ds
                LEFT JOIN WMS_LoadingStations ls ON ds.TargetStationID = ls.StationID
                LEFT JOIN WMS_Users u ON ds.OperatorID = u.UserID
                WHERE ds.TripID = @TripID`),
      pool.request().input('TripID', sql.Int, tid)
        .query(`SELECT lr.*, ls.StationName, ls.StationCode, u.FullName as OperatorName
                FROM WMS_LoadingRecord lr
                JOIN WMS_LoadingStations ls ON lr.StationID = ls.StationID
                LEFT JOIN WMS_Users u ON lr.OperatorID = u.UserID
                WHERE lr.TripID = @TripID
                ORDER BY lr.EntryTime`),
      pool.request().input('TripID', sql.Int, tid)
        .query(`SELECT cr.*, u.FullName as OperatorName FROM WMS_CheckerRecord cr
                LEFT JOIN WMS_Users u ON cr.OperatorID = u.UserID
                WHERE cr.TripID = @TripID`),
      pool.request().input('TripID', sql.Int, tid)
        .query(`SELECT wo.*, u.FullName as OperatorName FROM WMS_WeighOut wo
                LEFT JOIN WMS_Users u ON wo.OperatorID = u.UserID
                WHERE wo.TripID = @TripID`),
    ]);

    res.json({
      success: true,
      data: {
        trip: trip.recordset[0],
        weighIn: weighIn.recordset[0] || null,
        dataStation: dataStation.recordset[0] || null,
        loadingRecords: loadingRecords.recordset,
        checker: checker.recordset[0] || null,
        weighOut: weighOut.recordset[0] || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/trips/:id/cancel
router.put('/:id/cancel', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('TripID', sql.Int, req.params.id)
      .query(`UPDATE WMS_Trips SET Status = 'Cancelled' WHERE TripID = @TripID`);
    res.json({ success: true, message: 'ยกเลิก Trip สำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
