const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ==================== WAREHOUSES ====================
router.get('/warehouses', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query('SELECT * FROM WMS_Warehouses WHERE IsActive = 1 ORDER BY WarehouseName');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/warehouses', authenticate, requireAdmin, async (req, res) => {
  try {
    const { warehouseCode, warehouseName, location, gpsLat, gpsLng } = req.body;
    const pool = getPool();
    await pool.request()
      .input('WarehouseCode', sql.NVarChar, warehouseCode)
      .input('WarehouseName', sql.NVarChar, warehouseName)
      .input('Location', sql.NVarChar, location || '')
      .input('GpsLat', sql.Float, gpsLat || null)
      .input('GpsLng', sql.Float, gpsLng || null)
      .query(`INSERT INTO WMS_Warehouses (WarehouseCode, WarehouseName, Location, GpsLat, GpsLng)
              VALUES (@WarehouseCode, @WarehouseName, @Location, @GpsLat, @GpsLng)`);
    res.json({ success: true, message: 'เพิ่มคลังสินค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/warehouses/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { warehouseCode, warehouseName, location, gpsLat, gpsLng, isActive } = req.body;
    const pool = getPool();
    await pool.request()
      .input('WarehouseID', sql.Int, req.params.id)
      .input('WarehouseCode', sql.NVarChar, warehouseCode)
      .input('WarehouseName', sql.NVarChar, warehouseName)
      .input('Location', sql.NVarChar, location || '')
      .input('GpsLat', sql.Float, gpsLat || null)
      .input('GpsLng', sql.Float, gpsLng || null)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .query(`UPDATE WMS_Warehouses SET WarehouseCode=@WarehouseCode, WarehouseName=@WarehouseName,
              Location=@Location, GpsLat=@GpsLat, GpsLng=@GpsLng, IsActive=@IsActive
              WHERE WarehouseID=@WarehouseID`);
    res.json({ success: true, message: 'แก้ไขคลังสินค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== CUSTOMERS ====================
router.get('/customers', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const search = req.query.search || '';
    const result = await pool.request()
      .input('Search', sql.NVarChar, `%${search}%`)
      .query(`SELECT * FROM WMS_Customers
              WHERE IsActive = 1 AND (CustomerName LIKE @Search OR CustomerCode LIKE @Search)
              ORDER BY CustomerName`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/customers', authenticate, requireAdmin, async (req, res) => {
  try {
    const { customerCode, customerName, phone, address } = req.body;
    const pool = getPool();
    await pool.request()
      .input('CustomerCode', sql.NVarChar, customerCode)
      .input('CustomerName', sql.NVarChar, customerName)
      .input('Phone', sql.NVarChar, phone || '')
      .input('Address', sql.NVarChar, address || '')
      .query(`INSERT INTO WMS_Customers (CustomerCode, CustomerName, Phone, Address)
              VALUES (@CustomerCode, @CustomerName, @Phone, @Address)`);
    res.json({ success: true, message: 'เพิ่มลูกค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/customers/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { customerCode, customerName, phone, address, isActive } = req.body;
    const pool = getPool();
    await pool.request()
      .input('CustomerID', sql.Int, req.params.id)
      .input('CustomerCode', sql.NVarChar, customerCode)
      .input('CustomerName', sql.NVarChar, customerName)
      .input('Phone', sql.NVarChar, phone || '')
      .input('Address', sql.NVarChar, address || '')
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .query(`UPDATE WMS_Customers SET CustomerCode=@CustomerCode, CustomerName=@CustomerName,
              Phone=@Phone, Address=@Address, IsActive=@IsActive
              WHERE CustomerID=@CustomerID`);
    res.json({ success: true, message: 'แก้ไขลูกค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== VEHICLE TYPES ====================
router.get('/vehicle-types', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query('SELECT * FROM WMS_VehicleTypes WHERE IsActive = 1 ORDER BY TypeName');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/vehicle-types', authenticate, requireAdmin, async (req, res) => {
  try {
    const { typeName, description } = req.body;
    const pool = getPool();
    await pool.request()
      .input('TypeName', sql.NVarChar, typeName)
      .input('Description', sql.NVarChar, description || '')
      .query('INSERT INTO WMS_VehicleTypes (TypeName, Description) VALUES (@TypeName, @Description)');
    res.json({ success: true, message: 'เพิ่มประเภทรถสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== LOADING STATIONS ====================
router.get('/loading-stations', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const warehouseId = req.query.warehouseId;
    let query = `SELECT ls.*, w.WarehouseName FROM WMS_LoadingStations ls
                 LEFT JOIN WMS_Warehouses w ON ls.WarehouseID = w.WarehouseID
                 WHERE ls.IsActive = 1`;
    const request = pool.request();
    if (warehouseId) {
      query += ' AND ls.WarehouseID = @WarehouseID';
      request.input('WarehouseID', sql.Int, warehouseId);
    }
    query += ' ORDER BY ls.SortOrder, ls.StationName';
    const result = await request.query(query);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/loading-stations', authenticate, requireAdmin, async (req, res) => {
  try {
    const { stationCode, stationName, warehouseId, sortOrder } = req.body;
    const pool = getPool();
    await pool.request()
      .input('StationCode', sql.NVarChar, stationCode)
      .input('StationName', sql.NVarChar, stationName)
      .input('WarehouseID', sql.Int, warehouseId || null)
      .input('SortOrder', sql.Int, sortOrder || 0)
      .query(`INSERT INTO WMS_LoadingStations (StationCode, StationName, WarehouseID, SortOrder)
              VALUES (@StationCode, @StationName, @WarehouseID, @SortOrder)`);
    res.json({ success: true, message: 'เพิ่มสถานีขึ้นสินค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/loading-stations/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { stationCode, stationName, warehouseId, sortOrder, isActive } = req.body;
    const pool = getPool();
    await pool.request()
      .input('StationID', sql.Int, req.params.id)
      .input('StationCode', sql.NVarChar, stationCode)
      .input('StationName', sql.NVarChar, stationName)
      .input('WarehouseID', sql.Int, warehouseId || null)
      .input('SortOrder', sql.Int, sortOrder || 0)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .query(`UPDATE WMS_LoadingStations SET StationCode=@StationCode, StationName=@StationName,
              WarehouseID=@WarehouseID, SortOrder=@SortOrder, IsActive=@IsActive
              WHERE StationID=@StationID`);
    res.json({ success: true, message: 'แก้ไขสถานีสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/loading-stations/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('StationID', sql.Int, req.params.id)
      .query('UPDATE WMS_LoadingStations SET IsActive = 0 WHERE StationID = @StationID');
    res.json({ success: true, message: 'ลบสถานีสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
