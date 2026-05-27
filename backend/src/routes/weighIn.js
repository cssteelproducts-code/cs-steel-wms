const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// POST /api/weigh-in - Create new trip + weigh-in record
router.post('/', authenticate, async (req, res) => {
  try {
    const { licensePlate, vehicleTypeId, warehouseId, customerId, deliveryType, priority, tareWeight, notes } = req.body;

    if (!licensePlate || !vehicleTypeId || !warehouseId) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    }

    const pool = getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const tripResult = await transaction.request()
        .input('LicensePlate', sql.NVarChar, licensePlate.toUpperCase().trim())
        .input('VehicleTypeID', sql.Int, vehicleTypeId)
        .input('WarehouseID', sql.Int, warehouseId)
        .input('CustomerID', sql.Int, customerId || null)
        .input('DeliveryType', sql.NVarChar, deliveryType || null)
        .input('Priority', sql.NVarChar, priority || 'ปกติ')
        .input('Status', sql.NVarChar, 'Data')
        .input('CreatedBy', sql.Int, req.user.UserID)
        .query(`
          INSERT INTO WMS_Trips (TripDate, LicensePlate, VehicleTypeID, WarehouseID, CustomerID, DeliveryType, Priority, Status, CreatedBy)
          OUTPUT INSERTED.TripID
          VALUES (CAST(GETDATE() AS DATE), @LicensePlate, @VehicleTypeID, @WarehouseID, @CustomerID, @DeliveryType, @Priority, @Status, @CreatedBy)
        `);

      const tripId = tripResult.recordset[0].TripID;

      await transaction.request()
        .input('TripID', sql.Int, tripId)
        .input('WeighDateTime', sql.DateTime, new Date())
        .input('TareWeight', sql.Decimal(10, 2), tareWeight || null)
        .input('Notes', sql.NVarChar, notes || '')
        .input('OperatorID', sql.Int, req.user.UserID)
        .query(`
          INSERT INTO WMS_WeighIn (TripID, WeighDateTime, TareWeight, Notes, OperatorID)
          VALUES (@TripID, @WeighDateTime, @TareWeight, @Notes, @OperatorID)
        `);

      await transaction.commit();

      res.json({ success: true, tripId, message: `บันทึกชั่งเข้าสำเร็จ | Trip #${tripId} | ทะเบียน: ${licensePlate}` });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('WeighIn error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
  }
});

// GET /api/weigh-in/today - Get today's weigh-in list
router.get('/today', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query(`
        SELECT t.TripID, t.LicensePlate, t.TripDate, t.Status,
               t.VehicleTypeID, t.WarehouseID, t.CustomerID, t.DeliveryType,
               vt.TypeName as VehicleType,
               w.WarehouseName,
               c.CustomerName, c.ARCode as CustomerARCode,
               wi.TareWeight, wi.WeighDateTime, wi.Notes,
               u.FullName as OperatorName
        FROM WMS_WeighIn wi
        JOIN WMS_Trips t ON wi.TripID = t.TripID
        LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
        LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
        LEFT JOIN WMS_Users u ON wi.OperatorID = u.UserID
        WHERE CAST(t.TripDate AS DATE) = CAST(GETUTCDATE() AS DATE)
        ORDER BY wi.WeighDateTime DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/weigh-in/:tripId - Edit existing trip + weigh-in record
router.put('/:tripId', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { vehicleTypeId, warehouseId, customerId, deliveryType, tareWeight, notes } = req.body;
    const pool = getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction.request()
        .input('TripID', sql.Int, tripId)
        .input('VehicleTypeID', sql.Int, vehicleTypeId || null)
        .input('WarehouseID', sql.Int, warehouseId || null)
        .input('CustomerID', sql.Int, customerId || null)
        .input('DeliveryType', sql.NVarChar, deliveryType || null)
        .query(`UPDATE WMS_Trips SET VehicleTypeID=@VehicleTypeID, WarehouseID=@WarehouseID,
                CustomerID=@CustomerID, DeliveryType=@DeliveryType WHERE TripID=@TripID`);
      await transaction.request()
        .input('TripID', sql.Int, tripId)
        .input('TareWeight', sql.Decimal(10, 2), tareWeight || null)
        .input('Notes', sql.NVarChar, notes || '')
        .query(`UPDATE WMS_WeighIn SET TareWeight=@TareWeight, Notes=@Notes WHERE TripID=@TripID`);
      await transaction.commit();
      res.json({ success: true, message: 'แก้ไขข้อมูลสำเร็จ' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/weigh-in/check/:licensePlate - Check if vehicle already in yard
router.get('/check/:licensePlate', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('LicensePlate', sql.NVarChar, req.params.licensePlate.toUpperCase())
      .query(`
        SELECT TripID, LicensePlate, Status, CreatedAt
        FROM WMS_Trips
        WHERE LicensePlate = @LicensePlate
        AND Status NOT IN ('Complete', 'Cancelled')
        AND CAST(TripDate AS DATE) = CAST(GETUTCDATE() AS DATE)
      `);

    res.json({
      success: true,
      inYard: result.recordset.length > 0,
      trip: result.recordset[0] || null
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
