const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const cache = require('../utils/cache');

const ACTIVE_KEY = 'trips:active';

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

    request.input('Offset', sql.Int, offset);
    request.input('Limit', sql.Int, parseInt(limit));

    const result = await request.query(`
      SELECT t.TripID, t.TripDate, t.LicensePlate, t.Status, t.CreatedAt, t.CompletedAt,
             vt.TypeName as VehicleType,
             w.WarehouseName,
             c.CustomerName,
             wi.TareWeight, wi.WeighDateTime as WeighInTime,
             wo.NetWeight, wo.WeighDateTime as WeighOutTime,
             DATEDIFF(MINUTE, t.CreatedAt, ISNULL(t.CompletedAt, DATEADD(HOUR,7,GETUTCDATE()))) as DurationMinutes,
             COUNT(*) OVER() AS TotalRows
      FROM WMS_Trips t WITH (NOLOCK)
      LEFT JOIN WMS_VehicleTypes vt WITH (NOLOCK) ON t.VehicleTypeID = vt.TypeID
      LEFT JOIN WMS_Warehouses w WITH (NOLOCK) ON t.WarehouseID = w.WarehouseID
      LEFT JOIN WMS_Customers c WITH (NOLOCK) ON t.CustomerID = c.CustomerID
      LEFT JOIN WMS_WeighIn wi WITH (NOLOCK) ON t.TripID = wi.TripID
      LEFT JOIN WMS_WeighOut wo WITH (NOLOCK) ON t.TripID = wo.TripID
      ${whereClause}
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
    console.error('Get trips error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trips/active - Get active trips (in warehouse)
router.get('/active', authenticate, async (req, res) => {
  try {
    const data = await cache.wrap(ACTIVE_KEY, async () => {
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
                 ISNULL(rem.RemainingStations, 0) as RemainingStations,
                 DATEDIFF(MINUTE, t.CreatedAt, DATEADD(HOUR,7,GETUTCDATE())) as MinutesInWarehouse,
                 cur.StationName as CurrentStation
          FROM WMS_Trips t WITH (NOLOCK)
          LEFT JOIN WMS_VehicleTypes vt WITH (NOLOCK) ON t.VehicleTypeID = vt.TypeID
          LEFT JOIN WMS_Warehouses w WITH (NOLOCK) ON t.WarehouseID = w.WarehouseID
          LEFT JOIN WMS_Customers c WITH (NOLOCK) ON t.CustomerID = c.CustomerID
          LEFT JOIN WMS_WeighIn wi WITH (NOLOCK) ON t.TripID = wi.TripID
          LEFT JOIN WMS_DataStation ds WITH (NOLOCK) ON t.TripID = ds.TripID
          LEFT JOIN WMS_LoadingStations ls_target WITH (NOLOCK) ON ds.TargetStationID = ls_target.StationID
          LEFT JOIN (
            SELECT dst.TripID,
              SUM(CASE WHEN lrc.RecordID IS NULL THEN 1 ELSE 0 END) as RemainingStations
            FROM WMS_DataStationTargets dst WITH (NOLOCK)
            LEFT JOIN WMS_LoadingRecord lrc WITH (NOLOCK) ON lrc.TripID = dst.TripID
              AND lrc.StationID = dst.StationID AND lrc.ExitTime IS NOT NULL
            GROUP BY dst.TripID
          ) rem ON rem.TripID = t.TripID
          LEFT JOIN (
            SELECT lr.TripID, ls.StationName,
              ROW_NUMBER() OVER (PARTITION BY lr.TripID ORDER BY lr.EntryTime DESC) as rn
            FROM WMS_LoadingRecord lr WITH (NOLOCK)
            JOIN WMS_LoadingStations ls WITH (NOLOCK) ON lr.StationID = ls.StationID
            WHERE lr.ExitTime IS NULL
          ) cur ON cur.TripID = t.TripID AND cur.rn = 1
          WHERE t.Status NOT IN ('Complete', 'Cancelled')
          AND t.TripDate >= DATEADD(DAY, -1, CAST(GETUTCDATE() AS DATE))
          ORDER BY t.CreatedAt DESC
        `);
      return result.recordset;
    }, 20_000);
    res.json({ success: true, data });
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
        FROM WMS_Trips t WITH (NOLOCK)
        LEFT JOIN WMS_VehicleTypes vt WITH (NOLOCK) ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_Warehouses w WITH (NOLOCK) ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Customers c WITH (NOLOCK) ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_Users u WITH (NOLOCK) ON t.CreatedBy = u.UserID
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
    cache.del(ACTIVE_KEY);
    res.json({ success: true, message: 'ยกเลิก Trip สำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
