const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// POST /api/weigh-out - Record weigh-out and complete trip
router.post('/', authenticate, async (req, res) => {
  try {
    const { tripId, grossWeight, notes } = req.body;

    if (!tripId || !grossWeight) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    }

    const pool = getPool();

    // Get trip info and tare weight from weigh-in
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
    const tareWeight = trip.TareWeight || 0;
    const netWeight = parseFloat(grossWeight) - parseFloat(tareWeight);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
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
        .query(`UPDATE WMS_Trips SET Status='Complete', CompletedAt=GETDATE() WHERE TripID=@TripID`);

      await transaction.commit();

      res.json({
        success: true,
        message: `ชั่งออกสำเร็จ | ทะเบียน: ${trip.LicensePlate} | น้ำหนักสุทธิ: ${netWeight.toFixed(2)} กก.`,
        data: {
          tripId,
          grossWeight,
          tareWeight,
          netWeight: parseFloat(netWeight.toFixed(2))
        }
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

// GET /api/weigh-out/pending - Get trips waiting for weigh-out
router.get('/pending', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query(`
        SELECT t.TripID, t.LicensePlate, t.Status, t.CreatedAt,
               vt.TypeName as VehicleType,
               w.WarehouseName,
               c.CustomerName,
               wi.TareWeight, wi.WeighDateTime as WeighInTime,
               ds.PickDocumentNo,
               DATEDIFF(MINUTE, t.CreatedAt, GETDATE()) as MinutesInWarehouse
        FROM WMS_Trips t
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_WeighIn wi ON t.TripID = wi.TripID
        LEFT JOIN WMS_DataStation ds ON t.TripID = ds.TripID
        WHERE t.Status = 'WeighOut'
        AND CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY t.CreatedAt ASC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/weigh-out/today - Today's completed trips
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
        WHERE CAST(t.TripDate AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY wo.WeighDateTime DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
