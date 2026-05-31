const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// TTL cache for static master data — these tables change rarely.
const _mc = new Map();
const mcGet = k => { const e = _mc.get(k); return (e && Date.now() < e.exp) ? e.v : null; };
const mcSet = (k, v, ms) => _mc.set(k, { v, exp: Date.now() + ms });
const mcDel = (...keys) => keys.forEach(k => _mc.delete(k));
const TTL_LONG = 5 * 60000;   // 5 min — vehicle types, warehouses, loading stations
const TTL_MED  = 2 * 60000;   // 2 min — customers (larger set, updated more often)

// ==================== WAREHOUSES ====================
router.get('/warehouses', authenticate, async (req, res) => {
  try {
    const hit = mcGet('warehouses');
    if (hit) return res.json({ success: true, data: hit });
    const pool = getPool();
    const result = await pool.request()
      .query('SELECT * FROM WMS_Warehouses WHERE IsActive = 1 ORDER BY WarehouseName ASC');
    mcSet('warehouses', result.recordset, TTL_LONG);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/warehouses', authenticate, requireAdmin, async (req, res) => { mcDel('warehouses');
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

router.put('/warehouses/:id', authenticate, requireAdmin, async (req, res) => { mcDel('warehouses');
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
    const search = req.query.search || '';
    // Only cache the unfiltered list (used by WeighIn page on load)
    if (!search) {
      const hit = mcGet('customers');
      if (hit) return res.json({ success: true, data: hit });
    }
    const pool = getPool();
    const result = await pool.request()
      .input('Search', sql.NVarChar, `%${search}%`)
      .query(`SELECT CustomerID, CustomerCode, ARCode, CustomerName, Phone, Address
              FROM WMS_Customers
              WHERE IsActive = 1 AND (CustomerName LIKE @Search OR CustomerCode LIKE @Search OR ARCode LIKE @Search)
              ORDER BY CustomerCode ASC`);
    if (!search) mcSet('customers', result.recordset, TTL_MED);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/customers', authenticate, requireAdmin, async (req, res) => { mcDel('customers');
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

router.put('/customers/:id', authenticate, requireAdmin, async (req, res) => { mcDel('customers');
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
    const hit = mcGet('vehicle-types');
    if (hit) return res.json({ success: true, data: hit });
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
    mcSet('vehicle-types', result.recordset, TTL_LONG);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/vehicle-types', authenticate, requireAdmin, async (req, res) => { mcDel('vehicle-types');
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

router.put('/vehicle-types/:id', authenticate, requireAdmin, async (req, res) => { mcDel('vehicle-types');
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
    const warehouseId = req.query.warehouseId;
    const cacheKey = warehouseId ? `loading-stations:${warehouseId}` : 'loading-stations';
    const hit = mcGet(cacheKey);
    if (hit) return res.json({ success: true, data: hit });
    const pool = getPool();
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
    mcSet(cacheKey, result.recordset, TTL_LONG);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/loading-stations', authenticate, requireAdmin, async (req, res) => { mcDel('loading-stations');
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

router.put('/loading-stations/:id', authenticate, requireAdmin, async (req, res) => { mcDel('loading-stations');
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

router.delete('/loading-stations/:id', authenticate, requireAdmin, async (req, res) => { mcDel('loading-stations');
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

router.delete('/vehicle-types/:id', authenticate, requireAdmin, async (req, res) => { mcDel('vehicle-types');
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

router.delete('/warehouses/:id', authenticate, requireAdmin, async (req, res) => { mcDel('warehouses');
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

router.delete('/customers/:id', authenticate, requireAdmin, async (req, res) => { mcDel('customers');
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

    mcDel('customers');
    res.json({ success: true, message: `นำเข้าสำเร็จ ${newRows.length} รายการ (ข้ามซ้ำ ${skipped} รายการ)` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== LOCATION TYPES ====================
router.get('/location-types', authenticate, async (req, res) => {
  try {
    const result = await getPool().request()
      .query('SELECT * FROM WMS_LocationTypes WHERE IsActive=1 ORDER BY SortOrder, TypeName');
    res.json({ success: true, data: result.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/location-types', authenticate, requireAdmin, async (req, res) => {
  try {
    const { typeCode, typeName, sortOrder } = req.body;
    if (!typeCode || !typeName) return res.status(400).json({ success: false, message: 'กรุณาระบุรหัสและชื่อประเภท' });
    await getPool().request()
      .input('TypeCode', sql.NVarChar, typeCode.trim())
      .input('TypeName', sql.NVarChar, typeName.trim())
      .input('SortOrder', sql.Int, parseInt(sortOrder) || 0)
      .query('INSERT INTO WMS_LocationTypes (TypeCode,TypeName,SortOrder) VALUES (@TypeCode,@TypeName,@SortOrder)');
    res.json({ success: true, message: `เพิ่มประเภท "${typeName}" สำเร็จ` });
  } catch (err) {
    if (err.number === 2627) return res.status(400).json({ success: false, message: 'รหัสประเภทนี้มีในระบบแล้ว' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/location-types/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { typeName, sortOrder, isActive } = req.body;
    await getPool().request()
      .input('TypeID', sql.Int, req.params.id)
      .input('TypeName', sql.NVarChar, typeName)
      .input('SortOrder', sql.Int, parseInt(sortOrder) || 0)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .query('UPDATE WMS_LocationTypes SET TypeName=@TypeName,SortOrder=@SortOrder,IsActive=@IsActive WHERE TypeID=@TypeID');
    res.json({ success: true, message: 'แก้ไขสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/location-types/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const inUse = await getPool().request().input('TypeID', sql.Int, req.params.id)
      .query('SELECT TOP 1 LocationID FROM WMS_Locations WHERE LocationTypeID=@TypeID AND IsActive=1');
    if (inUse.recordset.length > 0) return res.status(400).json({ success: false, message: 'ไม่สามารถลบได้ — มี Location ที่ใช้ประเภทนี้อยู่' });
    await getPool().request().input('TypeID', sql.Int, req.params.id)
      .query('UPDATE WMS_LocationTypes SET IsActive=0 WHERE TypeID=@TypeID');
    res.json({ success: true, message: 'ลบสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ==================== LOCATIONS ====================
router.get('/locations', authenticate, async (req, res) => {
  try {
    const { warehouseId } = req.query;
    const request = getPool().request();
    let where = 'WHERE l.IsActive=1';
    if (warehouseId) { where += ' AND l.WarehouseID=@wid'; request.input('wid', sql.Int, warehouseId); }
    const result = await request.query(`
      SELECT l.*, w.WarehouseName, lt.TypeName as LocationTypeName, lt.TypeCode as LocationTypeCode
      FROM WMS_Locations l
      LEFT JOIN WMS_Warehouses w ON l.WarehouseID=w.WarehouseID
      LEFT JOIN WMS_LocationTypes lt ON l.LocationTypeID=lt.TypeID
      ${where} ORDER BY l.LocationCode`);
    res.json({ success: true, data: result.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/locations', authenticate, requireAdmin, async (req, res) => {
  try {
    const { locationCode, locationName, warehouseId, locationTypeId } = req.body;
    if (!locationCode || !locationName) return res.status(400).json({ success: false, message: 'กรุณาระบุรหัสและชื่อ Location' });
    await getPool().request()
      .input('LocationCode', sql.NVarChar, locationCode.trim())
      .input('LocationName', sql.NVarChar, locationName.trim())
      .input('WarehouseID', sql.Int, warehouseId || null)
      .input('LocationTypeID', sql.Int, locationTypeId || null)
      .query('INSERT INTO WMS_Locations (LocationCode,LocationName,WarehouseID,LocationTypeID) VALUES (@LocationCode,@LocationName,@WarehouseID,@LocationTypeID)');
    res.json({ success: true, message: `เพิ่ม Location "${locationCode}" สำเร็จ` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/locations/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { locationName, warehouseId, locationTypeId, isActive } = req.body;
    await getPool().request()
      .input('LocationID', sql.Int, req.params.id)
      .input('LocationName', sql.NVarChar, locationName)
      .input('WarehouseID', sql.Int, warehouseId || null)
      .input('LocationTypeID', sql.Int, locationTypeId || null)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .query('UPDATE WMS_Locations SET LocationName=@LocationName,WarehouseID=@WarehouseID,LocationTypeID=@LocationTypeID,IsActive=@IsActive WHERE LocationID=@LocationID');
    res.json({ success: true, message: 'แก้ไขสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/locations/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await getPool().request().input('LocationID', sql.Int, req.params.id)
      .query('UPDATE WMS_Locations SET IsActive=0 WHERE LocationID=@LocationID');
    res.json({ success: true, message: 'ลบสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ==================== LOCATIONS EXCEL IMPORT/EXPORT ====================
router.get('/locations/template', authenticate, (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['รหัส Location*', 'ชื่อ Location*', 'รหัสคลังสินค้า', 'รหัสประเภท Location'],
    ['A-01-01', 'ชั้น A แถว 1 ช่อง 1', 'WH01', 'TYPE01'],
    ['A-01-02', 'ชั้น A แถว 1 ช่อง 2', 'WH01', ''],
    ['B-02-01', 'ชั้น B แถว 2 ช่อง 1', '', ''],
  ]);
  ws['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Location');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="location_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

router.post('/locations/import', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'ไม่พบไฟล์' });
  try {
    const pool = getPool();
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

    // Pre-load lookup maps
    const whRes = await pool.request().query('SELECT WarehouseCode, WarehouseID FROM WMS_Warehouses WHERE IsActive=1');
    const whMap = Object.fromEntries(whRes.recordset.map(r => [r.WarehouseCode.trim().toUpperCase(), r.WarehouseID]));

    const ltRes = await pool.request().query('SELECT TypeCode, TypeID FROM WMS_LocationTypes WHERE IsActive=1');
    const ltMap = Object.fromEntries(ltRes.recordset.map(r => [r.TypeCode.trim().toUpperCase(), r.TypeID]));

    const existRes = await pool.request().query('SELECT LocationCode FROM WMS_Locations');
    const existCodes = new Set(existRes.recordset.map(r => r.LocationCode.trim().toUpperCase()));

    const newRows = [];
    let skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      const [code, name, whCode, ltCode] = rows[i];
      if (!code || !name) { skipped++; continue; }
      const c = String(code).trim();
      if (existCodes.has(c.toUpperCase())) { skipped++; continue; }
      const warehouseId = whCode ? (whMap[String(whCode).trim().toUpperCase()] || null) : null;
      const locationTypeId = ltCode ? (ltMap[String(ltCode).trim().toUpperCase()] || null) : null;
      newRows.push([c, String(name).trim(), warehouseId, locationTypeId]);
      existCodes.add(c.toUpperCase());
    }

    const BATCH = 100;
    for (let b = 0; b < newRows.length; b += BATCH) {
      const batch = newRows.slice(b, b + BATCH);
      const r2 = pool.request();
      const vals = batch.map((row, idx) => {
        r2.input(`c${idx}`, sql.NVarChar, row[0]);
        r2.input(`n${idx}`, sql.NVarChar, row[1]);
        r2.input(`w${idx}`, sql.Int, row[2]);
        r2.input(`t${idx}`, sql.Int, row[3]);
        return `(@c${idx},@n${idx},@w${idx},@t${idx})`;
      });
      await r2.query(`INSERT INTO WMS_Locations (LocationCode,LocationName,WarehouseID,LocationTypeID) VALUES ${vals.join(',')}`);
    }

    res.json({ success: true, message: `นำเข้าสำเร็จ ${newRows.length} รายการ (ข้าม ${skipped} รายการ)` });
  } catch (err) {
    console.error('Locations import error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== PRODUCTS ====================
router.get('/products', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { search, skuType, categoryCode } = req.query;
    let where = 'WHERE IsActive = 1';
    const request = pool.request();
    if (search) { where += ' AND (ProductCode LIKE @s OR ProductName LIKE @s OR CategoryName LIKE @s)'; request.input('s', sql.NVarChar, `%${search}%`); }
    if (skuType) { where += ' AND SKUType = @skuType'; request.input('skuType', sql.NVarChar, skuType); }
    if (categoryCode) { where += ' AND CategoryCode = @catCode'; request.input('catCode', sql.NVarChar, categoryCode); }
    const result = await request.query(`SELECT * FROM WMS_Products ${where} ORDER BY ProductCode`);
    res.json({ success: true, data: result.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/products', authenticate, requireAdmin, async (req, res) => {
  try {
    const { productCode, productName, skuType, categoryCode, categoryName, materialType, formCode, sizeCode, thickness, targetGroup, unitNetWeight } = req.body;
    if (!productCode || !productName) return res.status(400).json({ success: false, message: 'กรุณาระบุรหัสและชื่อสินค้า' });
    const pool = getPool();
    await pool.request()
      .input('ProductCode', sql.NVarChar, productCode.trim())
      .input('ProductName', sql.NVarChar, productName.trim())
      .input('SKUType', sql.NVarChar, skuType || null)
      .input('CategoryCode', sql.NVarChar, categoryCode || null)
      .input('CategoryName', sql.NVarChar, categoryName || null)
      .input('MaterialType', sql.NVarChar, materialType || null)
      .input('FormCode', sql.NVarChar, formCode || null)
      .input('SizeCode', sql.NVarChar, sizeCode || null)
      .input('Thickness', sql.Decimal(8, 2), thickness ? parseFloat(thickness) : null)
      .input('TargetGroup', sql.NVarChar, targetGroup || null)
      .input('UnitNetWeight', sql.Decimal(10, 3), unitNetWeight ? parseFloat(unitNetWeight) : null)
      .query(`INSERT INTO WMS_Products (ProductCode,ProductName,SKUType,CategoryCode,CategoryName,MaterialType,FormCode,SizeCode,Thickness,TargetGroup,UnitNetWeight)
              VALUES (@ProductCode,@ProductName,@SKUType,@CategoryCode,@CategoryName,@MaterialType,@FormCode,@SizeCode,@Thickness,@TargetGroup,@UnitNetWeight)`);
    res.json({ success: true, message: `เพิ่มสินค้า "${productCode}" สำเร็จ` });
  } catch (err) {
    if (err.number === 2627) return res.status(400).json({ success: false, message: 'รหัสสินค้านี้มีในระบบแล้ว' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/products/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { productName, skuType, categoryCode, categoryName, materialType, formCode, sizeCode, thickness, targetGroup, unitNetWeight, isActive } = req.body;
    const pool = getPool();
    await pool.request()
      .input('ProductID', sql.Int, req.params.id)
      .input('ProductName', sql.NVarChar, productName)
      .input('SKUType', sql.NVarChar, skuType || null)
      .input('CategoryCode', sql.NVarChar, categoryCode || null)
      .input('CategoryName', sql.NVarChar, categoryName || null)
      .input('MaterialType', sql.NVarChar, materialType || null)
      .input('FormCode', sql.NVarChar, formCode || null)
      .input('SizeCode', sql.NVarChar, sizeCode || null)
      .input('Thickness', sql.Decimal(8, 2), thickness ? parseFloat(thickness) : null)
      .input('TargetGroup', sql.NVarChar, targetGroup || null)
      .input('UnitNetWeight', sql.Decimal(10, 3), unitNetWeight ? parseFloat(unitNetWeight) : null)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .query(`UPDATE WMS_Products SET ProductName=@ProductName,SKUType=@SKUType,CategoryCode=@CategoryCode,
              CategoryName=@CategoryName,MaterialType=@MaterialType,FormCode=@FormCode,SizeCode=@SizeCode,
              Thickness=@Thickness,TargetGroup=@TargetGroup,UnitNetWeight=@UnitNetWeight,IsActive=@IsActive,
              UpdatedAt=GETDATE() WHERE ProductID=@ProductID`);
    res.json({ success: true, message: 'แก้ไขสินค้าสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/products/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('ProductID', sql.Int, req.params.id)
      .query('UPDATE WMS_Products SET IsActive=0 WHERE ProductID=@ProductID');
    res.json({ success: true, message: 'ลบสินค้าสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/products/template', authenticate, (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Itemcode*', 'ItemName*', 'TypeSKU', 'GategoryCode', 'Gname', 'TypeCode', 'FormCode', 'SizeCode', 'Thickness', 'TargetName', 'UnitNetWeight'],
    ['06-GQ0190190100CSS', 'ท่อเหลี่ยม GQ 19x19 (1.00mm.) CSS', 'ขายดี', '06', 'แป๊ปเหลี่ยม', 'GQ', 'CSS', '19X19', '1.00', 'ท่อขนาดเล็ก', '3.49'],
  ]);
  ws['!cols'] = [16,30,20,10,15,10,10,15,8,20,12].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'สินค้า');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="product_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

router.post('/products/import', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'ไม่พบไฟล์' });
  try {
    const pool = getPool();
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    const existing = await pool.request().query('SELECT ProductCode FROM WMS_Products');
    const existingCodes = new Set(existing.recordset.map(r => r.ProductCode));
    const toInsert = [], toUpdate = [];
    for (let i = 1; i < rows.length; i++) {
      const [code, name, skuType, catCode, catName, matType, formCode, sizeCode, thickness, target, weight] = rows[i];
      if (!code || !name) continue;
      const c = String(code).trim();
      const row = { c, name: String(name).trim(), skuType: skuType || null, catCode: catCode ? String(catCode).trim() : null, catName: catName ? String(catName).trim() : null, matType: matType ? String(matType).trim() : null, formCode: formCode ? String(formCode).trim() : null, sizeCode: sizeCode ? String(sizeCode).trim() : null, thickness: thickness ? parseFloat(thickness) : null, target: target ? String(target).trim() : null, weight: weight ? parseFloat(weight) : null };
      if (existingCodes.has(c)) toUpdate.push(row); else { toInsert.push(row); existingCodes.add(c); }
    }
    const BATCH = 50;
    for (let b = 0; b < toInsert.length; b += BATCH) {
      const batch = toInsert.slice(b, b + BATCH);
      const r2 = pool.request();
      const vals = batch.map((row, idx) => {
        r2.input(`c${idx}`,sql.NVarChar,row.c); r2.input(`n${idx}`,sql.NVarChar,row.name);
        r2.input(`s${idx}`,sql.NVarChar,row.skuType); r2.input(`cc${idx}`,sql.NVarChar,row.catCode);
        r2.input(`cn${idx}`,sql.NVarChar,row.catName); r2.input(`m${idx}`,sql.NVarChar,row.matType);
        r2.input(`f${idx}`,sql.NVarChar,row.formCode); r2.input(`sz${idx}`,sql.NVarChar,row.sizeCode);
        r2.input(`t${idx}`,sql.Decimal(8,2),row.thickness); r2.input(`tg${idx}`,sql.NVarChar,row.target);
        r2.input(`w${idx}`,sql.Decimal(10,3),row.weight);
        return `(@c${idx},@n${idx},@s${idx},@cc${idx},@cn${idx},@m${idx},@f${idx},@sz${idx},@t${idx},@tg${idx},@w${idx})`;
      });
      await r2.query(`INSERT INTO WMS_Products (ProductCode,ProductName,SKUType,CategoryCode,CategoryName,MaterialType,FormCode,SizeCode,Thickness,TargetGroup,UnitNetWeight) VALUES ${vals.join(',')}`);
    }
    for (const row of toUpdate) {
      await pool.request()
        .input('c',sql.NVarChar,row.c).input('n',sql.NVarChar,row.name).input('s',sql.NVarChar,row.skuType)
        .input('cc',sql.NVarChar,row.catCode).input('cn',sql.NVarChar,row.catName).input('m',sql.NVarChar,row.matType)
        .input('f',sql.NVarChar,row.formCode).input('sz',sql.NVarChar,row.sizeCode).input('t',sql.Decimal(8,2),row.thickness)
        .input('tg',sql.NVarChar,row.target).input('w',sql.Decimal(10,3),row.weight)
        .query(`UPDATE WMS_Products SET ProductName=@n,SKUType=@s,CategoryCode=@cc,CategoryName=@cn,MaterialType=@m,FormCode=@f,SizeCode=@sz,Thickness=@t,TargetGroup=@tg,UnitNetWeight=@w,UpdatedAt=GETDATE() WHERE ProductCode=@c`);
    }
    res.json({ success: true, message: `นำเข้าสำเร็จ: เพิ่ม ${toInsert.length} รายการ, อัปเดต ${toUpdate.length} รายการ` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ==================== INTERNAL VEHICLES (รถขนส่งภายใน) ====================
let _ivTableReady = false;
async function ensureIVTable() {
  if (_ivTableReady) return;
  const pool = getPool();
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_InternalVehicles' AND xtype='U')
      CREATE TABLE WMS_InternalVehicles (
        VehicleID INT IDENTITY(1,1) PRIMARY KEY,
        LicensePlate NVARCHAR(20) NOT NULL,
        VehicleName NVARCHAR(100),
        VehicleCategory NVARCHAR(50),
        ActExpiry DATE,
        InsuranceExpiry DATE,
        InspectionExpiry DATE,
        OtherDocName NVARCHAR(100),
        OtherDocExpiry DATE,
        VehicleStatus NVARCHAR(20) DEFAULT N'พร้อมใช้',
        Symptoms NVARCHAR(500),
        RepairEntryDate DATE,
        EstimatedCompletionDate DATE,
        Notes NVARCHAR(500),
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME
      )
    `);
    await pool.request().query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('WMS_InternalVehicles') AND name='InsuranceCompany') ALTER TABLE WMS_InternalVehicles ADD InsuranceCompany NVARCHAR(200)`);
    await pool.request().query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('WMS_InternalVehicles') AND name='InsuranceType') ALTER TABLE WMS_InternalVehicles ADD InsuranceType NVARCHAR(100)`);
    await pool.request().query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('WMS_InternalVehicles') AND name='ActCompany') ALTER TABLE WMS_InternalVehicles ADD ActCompany NVARCHAR(200)`);
    await pool.request().query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('WMS_InternalVehicles') AND name='TaxExpiry') ALTER TABLE WMS_InternalVehicles ADD TaxExpiry DATE`);
    await pool.request().query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('WMS_InternalVehicles') AND name='BedWidth') ALTER TABLE WMS_InternalVehicles ADD BedWidth DECIMAL(8,2)`);
    await pool.request().query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('WMS_InternalVehicles') AND name='BedLength') ALTER TABLE WMS_InternalVehicles ADD BedLength DECIMAL(8,2)`);
    await pool.request().query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('WMS_InternalVehicles') AND name='BedHeight') ALTER TABLE WMS_InternalVehicles ADD BedHeight DECIMAL(8,2)`);
    await pool.request().query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('WMS_InternalVehicles') AND name='PayloadKg') ALTER TABLE WMS_InternalVehicles ADD PayloadKg DECIMAL(10,2)`);
  } catch (_) {}
  _ivTableReady = true;
}

router.get('/internal-vehicles', authenticate, async (req, res) => {
  try {
    await ensureIVTable();
    const result = await getPool().request()
      .query('SELECT * FROM WMS_InternalVehicles WHERE IsActive=1 ORDER BY LicensePlate');
    res.json({ success: true, data: result.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/internal-vehicles', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureIVTable();
    const { licensePlate, vehicleName, vehicleCategory, actExpiry, insuranceExpiry, inspectionExpiry,
            otherDocName, otherDocExpiry, vehicleStatus, symptoms, repairEntryDate, estimatedCompletionDate, notes,
            insuranceCompany, actCompany, taxExpiry, bedWidth, bedLength, bedHeight, payloadKg, insuranceType } = req.body;
    if (!licensePlate) return res.status(400).json({ success: false, message: 'กรุณาระบุทะเบียนรถ' });
    await getPool().request()
      .input('LP', sql.NVarChar, licensePlate.trim())
      .input('VN', sql.NVarChar, vehicleName || null)
      .input('VC', sql.NVarChar, vehicleCategory || null)
      .input('AE', sql.Date, actExpiry || null)
      .input('IE', sql.Date, insuranceExpiry || null)
      .input('IPE', sql.Date, inspectionExpiry || null)
      .input('ODN', sql.NVarChar, otherDocName || null)
      .input('ODE', sql.Date, otherDocExpiry || null)
      .input('VS', sql.NVarChar, vehicleStatus || 'พร้อมใช้')
      .input('SY', sql.NVarChar, symptoms || null)
      .input('RED', sql.Date, repairEntryDate || null)
      .input('ECD', sql.Date, estimatedCompletionDate || null)
      .input('NT', sql.NVarChar, notes || null)
      .input('IC', sql.NVarChar, insuranceCompany || null)
      .input('IT', sql.NVarChar, insuranceType || null)
      .input('AC', sql.NVarChar, actCompany || null)
      .input('TE', sql.Date, taxExpiry || null)
      .input('BW', sql.Decimal(8,2), bedWidth || null)
      .input('BL', sql.Decimal(8,2), bedLength || null)
      .input('BH', sql.Decimal(8,2), bedHeight || null)
      .input('PK', sql.Decimal(10,2), payloadKg || null)
      .query(`INSERT INTO WMS_InternalVehicles
        (LicensePlate,VehicleName,VehicleCategory,ActExpiry,InsuranceExpiry,InspectionExpiry,
         OtherDocName,OtherDocExpiry,VehicleStatus,Symptoms,RepairEntryDate,EstimatedCompletionDate,Notes,
         InsuranceCompany,InsuranceType,ActCompany,TaxExpiry,BedWidth,BedLength,BedHeight,PayloadKg)
        VALUES(@LP,@VN,@VC,@AE,@IE,@IPE,@ODN,@ODE,@VS,@SY,@RED,@ECD,@NT,@IC,@IT,@AC,@TE,@BW,@BL,@BH,@PK)`);
    res.json({ success: true, message: `เพิ่มรถ "${licensePlate}" สำเร็จ` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/internal-vehicles/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureIVTable();
    const { licensePlate, vehicleName, vehicleCategory, actExpiry, insuranceExpiry, inspectionExpiry,
            otherDocName, otherDocExpiry, vehicleStatus, symptoms, repairEntryDate, estimatedCompletionDate, notes, isActive,
            insuranceCompany, actCompany, taxExpiry, bedWidth, bedLength, bedHeight, payloadKg, insuranceType } = req.body;
    await getPool().request()
      .input('ID', sql.Int, req.params.id)
      .input('LP', sql.NVarChar, licensePlate)
      .input('VN', sql.NVarChar, vehicleName || null)
      .input('VC', sql.NVarChar, vehicleCategory || null)
      .input('AE', sql.Date, actExpiry || null)
      .input('IE', sql.Date, insuranceExpiry || null)
      .input('IPE', sql.Date, inspectionExpiry || null)
      .input('ODN', sql.NVarChar, otherDocName || null)
      .input('ODE', sql.Date, otherDocExpiry || null)
      .input('VS', sql.NVarChar, vehicleStatus || 'พร้อมใช้')
      .input('SY', sql.NVarChar, symptoms || null)
      .input('RED', sql.Date, repairEntryDate || null)
      .input('ECD', sql.Date, estimatedCompletionDate || null)
      .input('NT', sql.NVarChar, notes || null)
      .input('IA', sql.Bit, isActive !== undefined ? isActive : 1)
      .input('IC', sql.NVarChar, insuranceCompany || null)
      .input('IT', sql.NVarChar, insuranceType || null)
      .input('AC', sql.NVarChar, actCompany || null)
      .input('TE', sql.Date, taxExpiry || null)
      .input('BW', sql.Decimal(8,2), bedWidth || null)
      .input('BL', sql.Decimal(8,2), bedLength || null)
      .input('BH', sql.Decimal(8,2), bedHeight || null)
      .input('PK', sql.Decimal(10,2), payloadKg || null)
      .query(`UPDATE WMS_InternalVehicles SET
        LicensePlate=@LP,VehicleName=@VN,VehicleCategory=@VC,
        ActExpiry=@AE,InsuranceExpiry=@IE,InspectionExpiry=@IPE,
        OtherDocName=@ODN,OtherDocExpiry=@ODE,VehicleStatus=@VS,
        Symptoms=@SY,RepairEntryDate=@RED,EstimatedCompletionDate=@ECD,
        Notes=@NT,IsActive=@IA,InsuranceCompany=@IC,InsuranceType=@IT,ActCompany=@AC,TaxExpiry=@TE,
        BedWidth=@BW,BedLength=@BL,BedHeight=@BH,PayloadKg=@PK,UpdatedAt=GETDATE()
        WHERE VehicleID=@ID`);
    res.json({ success: true, message: 'แก้ไขข้อมูลรถสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/internal-vehicles/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await getPool().request().input('ID', sql.Int, req.params.id)
      .query('UPDATE WMS_InternalVehicles SET IsActive=0 WHERE VehicleID=@ID');
    res.json({ success: true, message: 'ลบสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ==================== INTERNAL VEHICLES EXCEL IMPORT/EXPORT ====================
router.get('/internal-vehicles/template', authenticate, (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['ทะเบียนรถ*', 'ชื่อ/รุ่นรถ', 'ประเภทรถ', 'บริษัท ประกันภัย', 'ประเภทประกัน', 'ประกันภัย สิ้นอายุ (YYYY-MM-DD)', 'บริษัท พรบ.', 'พ.ร.บ. สิ้นอายุ (YYYY-MM-DD)', 'ภาษีรถ ต่อภาษี (YYYY-MM-DD)', 'กว้างกะบะ (ม.)', 'ยาวกะบะ (ม.)', 'สูงกะบะ (ม.)', 'น้ำหนักบรรทุก (กก.)'],
    ['กก-1234', 'ISUZU NPR 130', 'รถยก', 'วิริยะประกันภัย', 'ชั้น 1', '2025-06-30', 'เมืองไทยประกันภัย', '2025-12-31', '2025-12-31', 2.0, 4.5, 1.8, 5000],
    ['ขข-5678', 'HINO 300', 'รถลาก', 'ทิพยประกันภัย', 'ชั้น 2', '2026-03-31', 'กรุงไทยพานิชประกันภัย', '2026-03-31', '2026-03-31', 2.3, 6.0, 2.0, 8000],
  ]);
  ws['!cols'] = [14, 20, 14, 22, 14, 28, 22, 28, 28, 16, 14, 14, 20].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'รถขนส่งภายใน');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="internal_vehicles_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

function parseExcelDate(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) return isNaN(val) ? null : val.toISOString().split('T')[0];
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Excel serial number → date
  if (/^\d+(\.\d+)?$/.test(s)) {
    const parsed = XLSX.SSF.parse_date_code(parseFloat(s));
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2,'0')}-${String(parsed.d).padStart(2,'0')}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

router.post('/internal-vehicles/import', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'ไม่พบไฟล์' });
  try {
    await ensureIVTable();
    const pool = getPool();
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

    const existingRes = await pool.request().query('SELECT LicensePlate FROM WMS_InternalVehicles');
    const existingPlates = new Set(existingRes.recordset.map(r => r.LicensePlate));

    const newRows = [];
    let skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      const [plate, name, category, insuranceCompany, insuranceType, insuranceExpiry, actCompany, actExpiry, taxExpiry, bedWidth, bedLength, bedHeight, payloadKg] = rows[i];
      if (!plate) { skipped++; continue; }
      const p = String(plate).trim();
      if (existingPlates.has(p)) { skipped++; continue; }
      const toNum = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
      newRows.push({
        plate: p,
        name: name ? String(name).trim() : null,
        category: category ? String(category).trim() : null,
        insuranceCompany: insuranceCompany ? String(insuranceCompany).trim() : null,
        insuranceType: insuranceType ? String(insuranceType).trim() : null,
        insuranceExpiry: parseExcelDate(insuranceExpiry),
        actCompany: actCompany ? String(actCompany).trim() : null,
        actExpiry: parseExcelDate(actExpiry),
        taxExpiry: parseExcelDate(taxExpiry),
        bedWidth: toNum(bedWidth),
        bedLength: toNum(bedLength),
        bedHeight: toNum(bedHeight),
        payloadKg: toNum(payloadKg),
      });
      existingPlates.add(p);
    }

    for (const row of newRows) {
      await pool.request()
        .input('LicensePlate', sql.NVarChar, row.plate)
        .input('VehicleName', sql.NVarChar, row.name)
        .input('VehicleCategory', sql.NVarChar, row.category)
        .input('InsuranceCompany', sql.NVarChar, row.insuranceCompany)
        .input('InsuranceType', sql.NVarChar, row.insuranceType)
        .input('InsuranceExpiry', sql.Date, row.insuranceExpiry || null)
        .input('ActCompany', sql.NVarChar, row.actCompany)
        .input('ActExpiry', sql.Date, row.actExpiry || null)
        .input('TaxExpiry', sql.Date, row.taxExpiry || null)
        .input('BedWidth', sql.Decimal(8,2), row.bedWidth)
        .input('BedLength', sql.Decimal(8,2), row.bedLength)
        .input('BedHeight', sql.Decimal(8,2), row.bedHeight)
        .input('PayloadKg', sql.Decimal(10,2), row.payloadKg)
        .query(`INSERT INTO WMS_InternalVehicles
          (LicensePlate,VehicleName,VehicleCategory,InsuranceCompany,InsuranceType,InsuranceExpiry,ActCompany,ActExpiry,TaxExpiry,
           BedWidth,BedLength,BedHeight,PayloadKg,VehicleStatus,IsActive)
          VALUES (@LicensePlate,@VehicleName,@VehicleCategory,@InsuranceCompany,@InsuranceType,@InsuranceExpiry,@ActCompany,@ActExpiry,@TaxExpiry,
           @BedWidth,@BedLength,@BedHeight,@PayloadKg,N'พร้อมใช้',1)`);
    }

    res.json({ success: true, message: `นำเข้าสำเร็จ ${newRows.length} รายการ (ข้ามซ้ำ ${skipped} รายการ)` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
