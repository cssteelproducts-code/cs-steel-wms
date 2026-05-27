const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ==================== WAREHOUSES ====================
router.get('/warehouses', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query('SELECT * FROM WMS_Warehouses WHERE IsActive = 1 ORDER BY WarehouseName ASC');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/warehouses', authenticate, requireAdmin, async (req, res) => {
  try {
    const { warehouseCode, warehouseName, location, gpsLat, gpsLng, radiusKm } = req.body;
    const pool = getPool();
    await pool.request()
      .input('WarehouseCode', sql.NVarChar, warehouseCode)
      .input('WarehouseName', sql.NVarChar, warehouseName)
      .input('Location', sql.NVarChar, location || '')
      .input('GpsLat', sql.Float, gpsLat || null)
      .input('GpsLng', sql.Float, gpsLng || null)
      .input('RadiusKm', sql.Float, parseFloat(radiusKm) || 5)
      .query(`INSERT INTO WMS_Warehouses (WarehouseCode, WarehouseName, Location, GpsLat, GpsLng, RadiusKm)
              VALUES (@WarehouseCode, @WarehouseName, @Location, @GpsLat, @GpsLng, @RadiusKm)`);
    res.json({ success: true, message: 'เพิ่มคลังสินค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/warehouses/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { warehouseCode, warehouseName, location, gpsLat, gpsLng, isActive, radiusKm } = req.body;
    const pool = getPool();
    await pool.request()
      .input('WarehouseID', sql.Int, req.params.id)
      .input('WarehouseCode', sql.NVarChar, warehouseCode)
      .input('WarehouseName', sql.NVarChar, warehouseName)
      .input('Location', sql.NVarChar, location || '')
      .input('GpsLat', sql.Float, gpsLat || null)
      .input('GpsLng', sql.Float, gpsLng || null)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .input('RadiusKm', sql.Float, parseFloat(radiusKm) || 5)
      .query(`UPDATE WMS_Warehouses SET WarehouseCode=@WarehouseCode, WarehouseName=@WarehouseName,
              Location=@Location, GpsLat=@GpsLat, GpsLng=@GpsLng, IsActive=@IsActive, RadiusKm=@RadiusKm
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
              ORDER BY CustomerCode ASC`);
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
      .query(`SELECT * FROM WMS_VehicleTypes WHERE IsActive = 1 ORDER BY
        CASE
          WHEN TypeName LIKE N'%4 ล้อ%'    THEN 1
          WHEN TypeName LIKE N'%6 ล้อ%'    THEN 2
          WHEN TypeName LIKE N'%10 ล้อ%'   THEN 3
          WHEN TypeName LIKE N'%12 ล้อ%'   THEN 4
          WHEN TypeName LIKE N'%18 ล้อ%'   THEN 5
          WHEN TypeName LIKE N'%พ่วง%'     THEN 6
          WHEN TypeName LIKE N'%เทรลเลอร์%' THEN 7
          ELSE 8
        END`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/vehicle-types', authenticate, requireAdmin, async (req, res) => {
  try {
    const { typeName, description, startHour, startMinute, cutoffHour, cutoffMinute } = req.body;
    const pool = getPool();
    await pool.request()
      .input('TypeName', sql.NVarChar, typeName)
      .input('Description', sql.NVarChar, description || '')
      .input('StartHour', sql.Int, startHour ?? 8)
      .input('StartMinute', sql.Int, startMinute ?? 0)
      .input('CutoffHour', sql.Int, cutoffHour ?? 16)
      .input('CutoffMinute', sql.Int, cutoffMinute ?? 0)
      .query(`INSERT INTO WMS_VehicleTypes (TypeName, Description, StartHour, StartMinute, CutoffHour, CutoffMinute)
              VALUES (@TypeName, @Description, @StartHour, @StartMinute, @CutoffHour, @CutoffMinute)`);
    res.json({ success: true, message: 'เพิ่มประเภทรถสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/vehicle-types/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { typeName, description, startHour, startMinute, cutoffHour, cutoffMinute, isActive } = req.body;
    const pool = getPool();
    await pool.request()
      .input('TypeID', sql.Int, req.params.id)
      .input('TypeName', sql.NVarChar, typeName)
      .input('Description', sql.NVarChar, description || '')
      .input('StartHour', sql.Int, startHour ?? 8)
      .input('StartMinute', sql.Int, startMinute ?? 0)
      .input('CutoffHour', sql.Int, cutoffHour ?? 16)
      .input('CutoffMinute', sql.Int, cutoffMinute ?? 0)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .query(`UPDATE WMS_VehicleTypes
              SET TypeName=@TypeName, Description=@Description,
                  StartHour=@StartHour, StartMinute=@StartMinute,
                  CutoffHour=@CutoffHour, CutoffMinute=@CutoffMinute,
                  IsActive=@IsActive
              WHERE TypeID=@TypeID`);
    res.json({ success: true, message: 'แก้ไขประเภทรถสำเร็จ' });
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

router.delete('/vehicle-types/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const inUse = await pool.request()
      .input('TypeID', sql.Int, req.params.id)
      .query('SELECT TOP 1 TripID FROM WMS_Trips WHERE VehicleTypeID = @TypeID');
    if (inUse.recordset.length > 0)
      return res.status(400).json({ success: false, message: 'ไม่สามารถลบได้ มีรถที่ใช้ประเภทนี้อยู่' });
    await pool.request()
      .input('TypeID', sql.Int, req.params.id)
      .query('DELETE FROM WMS_VehicleTypes WHERE TypeID = @TypeID');
    res.json({ success: true, message: 'ลบประเภทรถสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/warehouses/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('WarehouseID', sql.Int, req.params.id)
      .query('UPDATE WMS_Warehouses SET IsActive = 0 WHERE WarehouseID = @WarehouseID');
    res.json({ success: true, message: 'ลบคลังสินค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/customers/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('CustomerID', sql.Int, req.params.id)
      .query('UPDATE WMS_Customers SET IsActive = 0 WHERE CustomerID = @CustomerID');
    res.json({ success: true, message: 'ลบลูกค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== CUSTOMERS EXCEL IMPORT/EXPORT ====================
router.get('/customers/template', authenticate, (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['รหัสลูกค้า*', 'ชื่อลูกค้า*', 'โทรศัพท์', 'ที่อยู่'],
    ['C001', 'บริษัท ตัวอย่าง จำกัด', '02-123-4567', '123 ถนนตัวอย่าง กรุงเทพฯ'],
  ]);
  ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, 'ลูกค้า');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="customer_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

router.post('/customers/import', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'ไม่พบไฟล์' });
  try {
    const pool = getPool();
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Fetch all existing codes in one query
    const existingRes = await pool.request().query('SELECT CustomerCode FROM WMS_Customers');
    const existingCodes = new Set(existingRes.recordset.map(r => r.CustomerCode));

    // Filter to new rows only (in memory, no per-row DB queries)
    const newRows = [];
    let skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      const [code, name, phone, address] = rows[i];
      if (!code || !name) { skipped++; continue; }
      const c = String(code).trim();
      if (existingCodes.has(c)) { skipped++; continue; }
      newRows.push([c, String(name).trim(), phone ? String(phone).trim() : '', address ? String(address).trim() : '']);
      existingCodes.add(c); // prevent duplicates within the file itself
    }

    // Batch insert — 100 rows per batch (stays well under MSSQL 2100-param limit)
    const BATCH = 100;
    for (let b = 0; b < newRows.length; b += BATCH) {
      const batch = newRows.slice(b, b + BATCH);
      const req2 = pool.request();
      const vals = batch.map((row, idx) => {
        req2.input(`c${idx}`, sql.NVarChar, row[0]);
        req2.input(`n${idx}`, sql.NVarChar, row[1]);
        req2.input(`p${idx}`, sql.NVarChar, row[2]);
        req2.input(`a${idx}`, sql.NVarChar, row[3]);
        return `(@c${idx},@n${idx},@p${idx},@a${idx})`;
      });
      await req2.query(`INSERT INTO WMS_Customers (CustomerCode,CustomerName,Phone,Address) VALUES ${vals.join(',')}`);
    }

    res.json({ success: true, message: `นำเข้าสำเร็จ ${newRows.length} รายการ (ข้ามซ้ำ ${skipped} รายการ)` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
