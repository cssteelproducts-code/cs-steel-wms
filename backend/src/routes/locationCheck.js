const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

let _ready = false;
async function ensureTables() {
  if (_ready) return;
  const pool = getPool();
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('WMS_LocationTypes') AND name = 'AllowedSKUType'
    )
      ALTER TABLE WMS_LocationTypes ADD AllowedSKUType NVARCHAR(100) NULL
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_LocationChecks' AND xtype='U')
    CREATE TABLE WMS_LocationChecks (
      CheckID       INT IDENTITY(1,1) PRIMARY KEY,
      CheckMonth    NVARCHAR(7)  NOT NULL,
      CheckDate     DATE         NOT NULL,
      WarehouseID   INT          NULL,
      Status        NVARCHAR(20) DEFAULT 'Draft',
      Remark        NVARCHAR(500),
      TotalLocations INT DEFAULT 0,
      TotalMatch    INT DEFAULT 0,
      TotalMismatch INT DEFAULT 0,
      CreatedBy     INT NULL,
      CreatedAt     DATETIME2 DEFAULT GETUTCDATE()
    )
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_LocationCheckItems' AND xtype='U')
    CREATE TABLE WMS_LocationCheckItems (
      ItemID           INT IDENTITY(1,1) PRIMARY KEY,
      CheckID          INT NOT NULL,
      LocationID       INT NULL,
      LocationCode     NVARCHAR(50),
      LocationName     NVARCHAR(100),
      LocationTypeID   INT NULL,
      LocationTypeName NVARCHAR(100),
      ExpectedSKUType  NVARCHAR(100),
      ActualSKUType    NVARCHAR(100),
      IsMatch          BIT DEFAULT 0,
      Notes            NVARCHAR(500)
    )
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_LocationCheckItems') AND name='ProductCode')
      ALTER TABLE WMS_LocationCheckItems ADD ProductCode NVARCHAR(50) NULL
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_LocationCheckItems') AND name='ProductFoundName')
      ALTER TABLE WMS_LocationCheckItems ADD ProductFoundName NVARCHAR(200) NULL
  `);
  _ready = true;
}

// GET /api/location-check  – list checks for a year
router.get('/', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const year = req.query.year || new Date().getFullYear();
    const result = await pool.request()
      .input('Year', sql.NVarChar, String(year))
      .query(`
        SELECT c.*, w.WarehouseName, u.FullName as CreatedByName
        FROM WMS_LocationChecks c
        LEFT JOIN WMS_Warehouses w ON c.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Users u ON c.CreatedBy = u.UserID
        WHERE c.CheckMonth LIKE @Year + '%'
        ORDER BY c.CheckMonth DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/location-check/report – annual report
router.get('/report', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const year = req.query.year || new Date().getFullYear();
    const monthly = await pool.request()
      .input('Year', sql.NVarChar, String(year))
      .query(`
        SELECT c.CheckID, c.CheckMonth, c.CheckDate, c.Status, c.WarehouseID,
               c.TotalLocations, c.TotalMatch, c.TotalMismatch,
               CASE WHEN c.TotalLocations > 0
                    THEN CAST(c.TotalMatch * 100.0 / c.TotalLocations AS DECIMAL(5,1))
                    ELSE NULL END as MatchPct,
               w.WarehouseName
        FROM WMS_LocationChecks c
        LEFT JOIN WMS_Warehouses w ON c.WarehouseID = w.WarehouseID
        WHERE c.CheckMonth LIKE @Year + '%'
        ORDER BY c.CheckMonth
      `);
    const problems = await pool.request()
      .input('Year', sql.NVarChar, String(year))
      .query(`
        SELECT i.LocationCode, i.LocationName, i.LocationTypeName, i.ExpectedSKUType,
               COUNT(*) as TotalChecks,
               SUM(CASE WHEN i.IsMatch=0 AND i.ActualSKUType IS NOT NULL AND i.ActualSKUType!='' THEN 1 ELSE 0 END) as Mismatches
        FROM WMS_LocationCheckItems i
        JOIN WMS_LocationChecks c ON i.CheckID = c.CheckID
        WHERE c.CheckMonth LIKE @Year + '%' AND c.Status='Submitted'
        GROUP BY i.LocationCode, i.LocationName, i.LocationTypeName, i.ExpectedSKUType
        HAVING SUM(CASE WHEN i.IsMatch=0 AND i.ActualSKUType IS NOT NULL AND i.ActualSKUType!='' THEN 1 ELSE 0 END) > 0
        ORDER BY Mismatches DESC
      `);
    const submitted = monthly.recordset.filter(m => m.Status === 'Submitted');
    const yearSummary = {
      totalChecks: submitted.length,
      avgMatchPct: submitted.length > 0
        ? Math.round(submitted.reduce((s, m) => s + parseFloat(m.MatchPct || 0), 0) / submitted.length)
        : null,
      totalLocationsChecked: submitted.reduce((s, m) => s + (m.TotalLocations || 0), 0),
      totalMismatch: submitted.reduce((s, m) => s + (m.TotalMismatch || 0), 0),
    };
    res.json({ success: true, monthly: monthly.recordset, problems: problems.recordset, yearSummary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/location-check/lookup – look up location for quick scan (no save)
router.get('/lookup', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const { code } = req.query;
    if (!code) return res.status(400).json({ success: false, message: 'กรุณาระบุรหัส Location' });
    const result = await pool.request()
      .input('Code', sql.NVarChar, code.trim())
      .query(`
        SELECT l.LocationID, l.LocationCode, l.LocationName,
               l.LocationTypeID, ISNULL(lt.TypeName,'') as LocationTypeName,
               lt.AllowedSKUType
        FROM WMS_Locations l
        LEFT JOIN WMS_LocationTypes lt ON l.LocationTypeID = lt.TypeID
        WHERE l.LocationCode = @Code AND l.IsActive = 1
      `);
    if (!result.recordset.length)
      return res.status(404).json({ success: false, message: `ไม่พบ Location "${code}"` });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/location-check/today – today's quick-scan log
router.get('/today', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const checkMonth = new Date().toISOString().slice(0, 7);
    const result = await pool.request()
      .input('CheckMonth', sql.NVarChar, checkMonth)
      .query(`
        SELECT i.ItemID, i.LocationCode, i.LocationName, i.LocationTypeName,
               i.ExpectedSKUType, i.ActualSKUType, i.IsMatch, i.ProductFoundName
        FROM WMS_LocationCheckItems i
        JOIN WMS_LocationChecks c ON i.CheckID = c.CheckID
        WHERE c.CheckMonth = @CheckMonth AND c.Status = 'Draft'
        ORDER BY i.ItemID DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/location-check/quick – scan one location and save immediately
router.post('/quick', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const { locationCode, actualSKUType, productCode, productFoundName } = req.body;
    if (!locationCode || !actualSKUType)
      return res.status(400).json({ success: false, message: 'กรุณาระบุ LocationCode และ ActualSKUType' });

    const locResult = await pool.request()
      .input('Code', sql.NVarChar, locationCode.trim())
      .query(`
        SELECT l.LocationID, l.LocationCode, l.LocationName,
               l.LocationTypeID, ISNULL(lt.TypeName,'') as LocationTypeName,
               lt.AllowedSKUType
        FROM WMS_Locations l
        LEFT JOIN WMS_LocationTypes lt ON l.LocationTypeID = lt.TypeID
        WHERE l.LocationCode = @Code AND l.IsActive = 1
      `);
    if (!locResult.recordset.length)
      return res.status(404).json({ success: false, message: `ไม่พบ Location "${locationCode}"` });

    const loc = locResult.recordset[0];
    const expectedSKUType = loc.AllowedSKUType || '';
    const isMatch = expectedSKUType && actualSKUType
      ? (actualSKUType.trim() === expectedSKUType.trim() ? 1 : 0) : 0;

    const today = new Date();
    const checkMonth = today.toISOString().slice(0, 7);
    const checkDate = today.toISOString().slice(0, 10);

    let checkId;
    const sessionResult = await pool.request()
      .input('CheckMonth', sql.NVarChar, checkMonth)
      .query(`SELECT CheckID FROM WMS_LocationChecks WHERE CheckMonth = @CheckMonth AND Status = 'Draft'`);

    if (sessionResult.recordset.length > 0) {
      checkId = sessionResult.recordset[0].CheckID;
    } else {
      const insSession = await pool.request()
        .input('CheckMonth', sql.NVarChar, checkMonth)
        .input('CheckDate', sql.Date, checkDate)
        .input('CreatedBy', sql.Int, req.user.UserID)
        .query(`
          INSERT INTO WMS_LocationChecks (CheckMonth, CheckDate, Status, TotalLocations, CreatedBy)
          OUTPUT INSERTED.CheckID
          VALUES (@CheckMonth, @CheckDate, 'Draft', 0, @CreatedBy)
        `);
      checkId = insSession.recordset[0].CheckID;
    }

    const existItem = await pool.request()
      .input('CheckID', sql.Int, checkId)
      .input('LocationID', sql.Int, loc.LocationID)
      .query(`SELECT ItemID FROM WMS_LocationCheckItems WHERE CheckID = @CheckID AND LocationID = @LocationID`);

    if (existItem.recordset.length > 0) {
      await pool.request()
        .input('ItemID', sql.Int, existItem.recordset[0].ItemID)
        .input('Actual', sql.NVarChar, actualSKUType)
        .input('IsMatch', sql.Bit, isMatch)
        .input('PC', sql.NVarChar, productCode || null)
        .input('PFN', sql.NVarChar, productFoundName || null)
        .query(`UPDATE WMS_LocationCheckItems SET ActualSKUType=@Actual, IsMatch=@IsMatch, ProductCode=@PC, ProductFoundName=@PFN WHERE ItemID=@ItemID`);
    } else {
      await pool.request()
        .input('CheckID', sql.Int, checkId)
        .input('LocationID', sql.Int, loc.LocationID)
        .input('LC', sql.NVarChar, loc.LocationCode)
        .input('LN', sql.NVarChar, loc.LocationName || '')
        .input('LTID', sql.Int, loc.LocationTypeID || null)
        .input('LTN', sql.NVarChar, loc.LocationTypeName)
        .input('EST', sql.NVarChar, expectedSKUType)
        .input('AST', sql.NVarChar, actualSKUType)
        .input('IsMatch', sql.Bit, isMatch)
        .input('PC', sql.NVarChar, productCode || null)
        .input('PFN', sql.NVarChar, productFoundName || null)
        .query(`
          INSERT INTO WMS_LocationCheckItems
          (CheckID,LocationID,LocationCode,LocationName,LocationTypeID,LocationTypeName,ExpectedSKUType,ActualSKUType,IsMatch,ProductCode,ProductFoundName)
          VALUES (@CheckID,@LocationID,@LC,@LN,@LTID,@LTN,@EST,@AST,@IsMatch,@PC,@PFN)
        `);
    }

    await pool.request()
      .input('CheckID', sql.Int, checkId)
      .query(`
        UPDATE WMS_LocationChecks SET
          TotalLocations = (SELECT COUNT(*) FROM WMS_LocationCheckItems WHERE CheckID=@CheckID),
          TotalMatch     = (SELECT COUNT(*) FROM WMS_LocationCheckItems WHERE CheckID=@CheckID AND IsMatch=1),
          TotalMismatch  = (SELECT COUNT(*) FROM WMS_LocationCheckItems WHERE CheckID=@CheckID AND IsMatch=0 AND ActualSKUType IS NOT NULL AND ActualSKUType!='')
        WHERE CheckID = @CheckID
      `);

    res.json({
      success: true,
      isMatch: isMatch === 1,
      locationCode: loc.LocationCode,
      locationName: loc.LocationName,
      locationTypeName: loc.LocationTypeName,
      expectedSKUType,
      actualSKUType,
      checkId
    });
  } catch (err) {
    console.error('LocationCheck quick:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/location-check/products/search?category=&size=&thickness= – search products for field workers
router.get('/products/search', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { category, size, thickness } = req.query;

    const hasFilter = [category, size, thickness].some(v => v && v.trim().length >= 1);
    if (!hasFilter) return res.json({ success: true, data: [] });

    const req2 = pool.request();
    const where = [];

    if (category && category.trim()) {
      req2.input('Cat', sql.NVarChar, `%${category.trim()}%`);
      where.push(`(CategoryName LIKE @Cat OR ProductName LIKE @Cat)`);
    }
    if (size && size.trim()) {
      req2.input('Sz', sql.NVarChar, `%${size.trim()}%`);
      where.push(`(SizeCode LIKE @Sz OR ProductName LIKE @Sz)`);
    }
    if (thickness && thickness.trim()) {
      req2.input('Th', sql.NVarChar, `%${thickness.trim()}%`);
      where.push(`(CAST(Thickness AS NVARCHAR(20)) LIKE @Th OR ProductName LIKE @Th)`);
    }

    const result = await req2.query(`
      SELECT TOP 20 ProductCode, ProductName, CategoryName, SizeCode, Thickness, SKUType
      FROM WMS_Products
      WHERE IsActive = 1 AND ${where.join(' AND ')}
      ORDER BY CategoryName, SizeCode, Thickness
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/location-check/:id – check detail with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const check = await pool.request()
      .input('CheckID', sql.Int, req.params.id)
      .query(`
        SELECT c.*, w.WarehouseName, u.FullName as CreatedByName
        FROM WMS_LocationChecks c
        LEFT JOIN WMS_Warehouses w ON c.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Users u ON c.CreatedBy = u.UserID
        WHERE c.CheckID = @CheckID
      `);
    if (!check.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล' });
    const items = await pool.request()
      .input('CheckID', sql.Int, req.params.id)
      .query(`SELECT * FROM WMS_LocationCheckItems WHERE CheckID=@CheckID ORDER BY LocationTypeName, LocationCode`);
    res.json({ success: true, check: check.recordset[0], items: items.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/location-check – create new check session
router.post('/', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const { checkMonth, checkDate, warehouseId, remark } = req.body;
    if (!checkMonth || !checkDate) return res.status(400).json({ success: false, message: 'กรุณาระบุเดือนและวันที่' });

    const dup = await pool.request()
      .input('CheckMonth', sql.NVarChar, checkMonth)
      .input('WarehouseID', sql.Int, warehouseId || null)
      .query(`SELECT CheckID FROM WMS_LocationChecks WHERE CheckMonth=@CheckMonth AND (WarehouseID=@WarehouseID OR (@WarehouseID IS NULL AND WarehouseID IS NULL))`);
    if (dup.recordset.length > 0) return res.status(400).json({ success: false, message: `มีการตรวจสอบเดือน ${checkMonth} อยู่แล้ว` });

    const locsReq = pool.request();
    let whereWh = '';
    if (warehouseId) { locsReq.input('WID', sql.Int, warehouseId); whereWh = ' AND l.WarehouseID=@WID'; }
    const locs = await locsReq.query(`
      SELECT l.LocationID, l.LocationCode, l.LocationName, l.LocationTypeID,
             ISNULL(lt.TypeName,'') as LocationTypeName, lt.AllowedSKUType
      FROM WMS_Locations l
      LEFT JOIN WMS_LocationTypes lt ON l.LocationTypeID=lt.TypeID
      WHERE l.IsActive=1 ${whereWh}
      ORDER BY lt.SortOrder, l.LocationCode
    `);

    const ins = await pool.request()
      .input('CheckMonth', sql.NVarChar, checkMonth)
      .input('CheckDate', sql.Date, checkDate)
      .input('WarehouseID', sql.Int, warehouseId || null)
      .input('Remark', sql.NVarChar, remark || '')
      .input('TotalLocations', sql.Int, locs.recordset.length)
      .input('CreatedBy', sql.Int, req.user.UserID)
      .query(`
        INSERT INTO WMS_LocationChecks (CheckMonth,CheckDate,WarehouseID,Remark,TotalLocations,CreatedBy)
        OUTPUT INSERTED.CheckID
        VALUES (@CheckMonth,@CheckDate,@WarehouseID,@Remark,@TotalLocations,@CreatedBy)
      `);
    const checkId = ins.recordset[0].CheckID;

    for (const loc of locs.recordset) {
      await pool.request()
        .input('CID', sql.Int, checkId)
        .input('LID', sql.Int, loc.LocationID)
        .input('LC', sql.NVarChar, loc.LocationCode)
        .input('LN', sql.NVarChar, loc.LocationName)
        .input('LTID', sql.Int, loc.LocationTypeID || null)
        .input('LTN', sql.NVarChar, loc.LocationTypeName)
        .input('EST', sql.NVarChar, loc.AllowedSKUType || '')
        .query(`INSERT INTO WMS_LocationCheckItems (CheckID,LocationID,LocationCode,LocationName,LocationTypeID,LocationTypeName,ExpectedSKUType) VALUES (@CID,@LID,@LC,@LN,@LTID,@LTN,@EST)`);
    }

    res.json({ success: true, message: `สร้างการตรวจสอบสำเร็จ (${locs.recordset.length} location)`, checkId });
  } catch (err) {
    console.error('LocationCheck create:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/location-check/:id/items – save results
router.put('/:id/items', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, message: 'items ต้องเป็น array' });

    for (const item of items) {
      const isMatch = item.actualSKUType && item.expectedSKUType
        ? (item.actualSKUType.trim() === item.expectedSKUType.trim() ? 1 : 0) : 0;
      await pool.request()
        .input('ItemID', sql.Int, item.itemId)
        .input('Actual', sql.NVarChar, item.actualSKUType || '')
        .input('IsMatch', sql.Bit, isMatch)
        .input('Notes', sql.NVarChar, item.notes || '')
        .query(`UPDATE WMS_LocationCheckItems SET ActualSKUType=@Actual,IsMatch=@IsMatch,Notes=@Notes WHERE ItemID=@ItemID`);
    }

    // Recalculate totals
    await pool.request()
      .input('CheckID', sql.Int, req.params.id)
      .query(`
        UPDATE WMS_LocationChecks SET
          TotalMatch    = (SELECT COUNT(*) FROM WMS_LocationCheckItems WHERE CheckID=@CheckID AND IsMatch=1),
          TotalMismatch = (SELECT COUNT(*) FROM WMS_LocationCheckItems WHERE CheckID=@CheckID AND IsMatch=0 AND ActualSKUType IS NOT NULL AND ActualSKUType!='')
        WHERE CheckID=@CheckID
      `);
    res.json({ success: true, message: 'บันทึกสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/location-check/:id/submit – finalize
router.put('/:id/submit', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    await pool.request()
      .input('CheckID', sql.Int, req.params.id)
      .query(`UPDATE WMS_LocationChecks SET Status='Submitted' WHERE CheckID=@CheckID AND Status='Draft'`);
    res.json({ success: true, message: 'ส่งรายงานสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/location-check/:id – delete draft only
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const chk = await pool.request()
      .input('CheckID', sql.Int, req.params.id)
      .query(`SELECT Status FROM WMS_LocationChecks WHERE CheckID=@CheckID`);
    if (!chk.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล' });
    if (chk.recordset[0].Status === 'Submitted') return res.status(400).json({ success: false, message: 'ไม่สามารถลบรายการที่ส่งแล้ว' });
    await pool.request().input('CheckID', sql.Int, req.params.id).query(`DELETE FROM WMS_LocationCheckItems WHERE CheckID=@CheckID`);
    await pool.request().input('CheckID', sql.Int, req.params.id).query(`DELETE FROM WMS_LocationChecks WHERE CheckID=@CheckID`);
    res.json({ success: true, message: 'ลบสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
