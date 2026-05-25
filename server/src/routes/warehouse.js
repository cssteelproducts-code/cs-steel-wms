const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query, execute } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// ==================== Locations ====================
router.get('/locations', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.Locations ORDER BY [Zone],[Rack],[Shelf]');
    return res.json({ success: true, locations: rows.map(r => ({
      locationId:   r.LocationID   || '',
      zone:         r.Zone         || '',
      rack:         r.Rack         || '',
      shelf:        r.Shelf        || '',
      description:  r.Description  || '',
      maxWeightKg:  parseFloat(r.MaxWeightKg) || 0,
      status:       r.Status       || 'ว่าง',
      createdAt:    r.CreatedAt    || '',
      updatedAt:    r.UpdatedAt    || '',
    })) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/locations/add', async (req, res) => {
  try {
    const p = req.body;
    const locationId = 'LOC-' + uuidv4().slice(0, 8).toUpperCase();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO dbo.Locations ([LocationID],[Zone],[Rack],[Shelf],[Description],[MaxWeightKg],[Status],[CreatedAt],[UpdatedAt])
       VALUES (@id,@z,@rk,@sh,@desc,@mw,@st,@ca,@ua)`,
      { id: locationId, z: p.zone || '', rk: p.rack || '', sh: p.shelf || '',
        desc: p.description || '', mw: parseFloat(p.maxWeightKg) || 0,
        st: p.status || 'ว่าง', ca: now, ua: now }
    );
    return res.json({ success: true, locationId, message: 'เพิ่มตำแหน่งสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/locations/update', async (req, res) => {
  try {
    const { locationId, ...p } = req.body;
    await execute(
      'UPDATE dbo.Locations SET [Zone]=@z,[Rack]=@rk,[Shelf]=@sh,[Description]=@desc,[MaxWeightKg]=@mw,[Status]=@st,[UpdatedAt]=@ua WHERE [LocationID]=@id',
      { id: locationId, z: p.zone || '', rk: p.rack || '', sh: p.shelf || '',
        desc: p.description || '', mw: parseFloat(p.maxWeightKg) || 0,
        st: p.status || 'ว่าง', ua: new Date().toISOString() }
    );
    return res.json({ success: true, message: 'อัปเดตตำแหน่งสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/locations/delete', async (req, res) => {
  try {
    await execute('DELETE FROM dbo.Locations WHERE [LocationID]=@id', { id: req.body.locationId });
    return res.json({ success: true, message: 'ลบตำแหน่งสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// ==================== TypeSKU ====================
router.get('/skus', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.TypeSKU ORDER BY [SkuCode]');
    return res.json({ success: true, skus: rows.map(r => ({
      skuCode:   r.SkuCode   || '',
      skuName:   r.SkuName   || '',
      category:  r.Category  || '',
      unit:      r.Unit      || '',
      remark:    r.Remark    || '',
      createdAt: r.CreatedAt || '',
      updatedAt: r.UpdatedAt || '',
    })) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/skus/add', async (req, res) => {
  try {
    const p = req.body;
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO dbo.TypeSKU ([SkuCode],[SkuName],[Category],[Unit],[Remark],[CreatedAt],[UpdatedAt])
       VALUES (@c,@nm,@cat,@un,@rm,@ca,@ua)`,
      { c: (p.skuCode || '').toUpperCase(), nm: p.skuName || '', cat: p.category || '',
        un: p.unit || '', rm: p.remark || '', ca: now, ua: now }
    );
    return res.json({ success: true, skuCode: (p.skuCode || '').toUpperCase(), message: 'เพิ่ม SKU สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/skus/update', async (req, res) => {
  try {
    const { skuCode, ...p } = req.body;
    await execute(
      'UPDATE dbo.TypeSKU SET [SkuName]=@nm,[Category]=@cat,[Unit]=@un,[Remark]=@rm,[UpdatedAt]=@ua WHERE [SkuCode]=@c',
      { c: (skuCode || '').toUpperCase(), nm: p.skuName || '', cat: p.category || '',
        un: p.unit || '', rm: p.remark || '', ua: new Date().toISOString() }
    );
    return res.json({ success: true, message: 'อัปเดต SKU สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/skus/delete', async (req, res) => {
  try {
    await execute('DELETE FROM dbo.TypeSKU WHERE [SkuCode]=@c', { c: (req.body.skuCode || '').toUpperCase() });
    return res.json({ success: true, message: 'ลบ SKU สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// ==================== Inventory / Stock ====================
router.get('/inventory', async (req, res) => {
  try {
    let sql = 'SELECT * FROM dbo.Inventory WHERE 1=1';
    const inputs = {};
    if (req.query.locationId) { sql += ' AND [LocationID]=@lid'; inputs.lid = req.query.locationId; }
    if (req.query.skuCode)    { sql += ' AND [SkuCode]=@sku'; inputs.sku = req.query.skuCode; }
    sql += ' ORDER BY [LocationID],[SkuCode]';
    const rows = await query(sql, inputs);
    return res.json({ success: true, inventory: rows.map(r => ({
      recordId:   r.RecordID   || '',
      locationId: r.LocationID || '',
      skuCode:    r.SkuCode    || '',
      skuName:    r.SkuName    || '',
      quantity:   parseFloat(r.Quantity) || 0,
      updatedAt:  r.UpdatedAt  || '',
      updatedBy:  r.UpdatedBy  || '',
    })) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/inventory/update', async (req, res) => {
  try {
    const { locationId, skuCode, quantity, skuName } = req.body;
    const now = new Date().toISOString();
    const existing = await query(
      'SELECT [RecordID] FROM dbo.Inventory WHERE [LocationID]=@lid AND [SkuCode]=@sku',
      { lid: locationId, sku: skuCode }
    );
    if (existing.length) {
      await execute(
        'UPDATE dbo.Inventory SET [Quantity]=@qty,[SkuName]=@nm,[UpdatedAt]=@ua,[UpdatedBy]=@ub WHERE [LocationID]=@lid AND [SkuCode]=@sku',
        { lid: locationId, sku: skuCode, qty: parseFloat(quantity) || 0,
          nm: skuName || '', ua: now, ub: req.user.username }
      );
    } else {
      await execute(
        `INSERT INTO dbo.Inventory ([RecordID],[LocationID],[SkuCode],[SkuName],[Quantity],[UpdatedAt],[UpdatedBy])
         VALUES (@rid,@lid,@sku,@nm,@qty,@ua,@ub)`,
        { rid: 'INV-' + uuidv4().slice(0, 8).toUpperCase(),
          lid: locationId, sku: skuCode, nm: skuName || '',
          qty: parseFloat(quantity) || 0, ua: now, ub: req.user.username }
      );
    }
    return res.json({ success: true, message: 'อัปเดต Stock สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// ==================== Audit Log ====================
router.get('/audit', async (req, res) => {
  try {
    let sql = 'SELECT TOP 500 * FROM dbo.AuditLog WHERE 1=1';
    const inputs = {};
    if (req.query.locationId) { sql += ' AND [LocationID]=@lid'; inputs.lid = req.query.locationId; }
    if (req.query.skuCode)    { sql += ' AND [SkuCode]=@sku'; inputs.sku = req.query.skuCode; }
    if (req.query.date)       { sql += ' AND CAST([AuditDate] AS DATE)=@dt'; inputs.dt = req.query.date; }
    sql += ' ORDER BY [AuditDate] DESC';
    const rows = await query(sql, inputs);
    return res.json({ success: true, logs: rows.map(r => ({
      auditId:    r.AuditID    || '',
      locationId: r.LocationID || '',
      skuCode:    r.SkuCode    || '',
      beforeQty:  parseFloat(r.BeforeQty)  || 0,
      afterQty:   parseFloat(r.AfterQty)   || 0,
      reason:     r.Reason     || '',
      auditDate:  r.AuditDate  || '',
      auditBy:    r.AuditBy    || '',
    })) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/audit/add', async (req, res) => {
  try {
    const p = req.body;
    const auditId = 'AUD-' + uuidv4().slice(0, 8).toUpperCase();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO dbo.AuditLog ([AuditID],[LocationID],[SkuCode],[BeforeQty],[AfterQty],[Reason],[AuditDate],[AuditBy])
       VALUES (@aid,@lid,@sku,@bq,@aq,@rsn,@dt,@ab)`,
      { aid: auditId, lid: p.locationId || '', sku: p.skuCode || '',
        bq: parseFloat(p.beforeQty) || 0, aq: parseFloat(p.afterQty) || 0,
        rsn: p.reason || '', dt: now, ab: req.user.username }
    );
    await execute(
      'UPDATE dbo.Inventory SET [Quantity]=@qty,[UpdatedAt]=@ua,[UpdatedBy]=@ub WHERE [LocationID]=@lid AND [SkuCode]=@sku',
      { qty: parseFloat(p.afterQty) || 0, ua: now, ub: req.user.username,
        lid: p.locationId, sku: p.skuCode }
    );
    return res.json({ success: true, auditId, message: 'บันทึก Audit สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// ==================== Stock Count ====================
router.get('/stock-count', async (req, res) => {
  try {
    const rows = await query(`
      SELECT i.*, l.Zone, l.Rack, l.Shelf, s.Category, s.Unit
      FROM dbo.Inventory i
      LEFT JOIN dbo.Locations l ON i.LocationID = l.LocationID
      LEFT JOIN dbo.TypeSKU s ON i.SkuCode = s.SkuCode
      ORDER BY l.Zone, l.Rack, l.Shelf, i.SkuCode
    `);
    return res.json({ success: true, stock: rows.map(r => ({
      recordId:   r.RecordID   || '',
      locationId: r.LocationID || '',
      zone:       r.Zone       || '',
      rack:       r.Rack       || '',
      shelf:      r.Shelf      || '',
      skuCode:    r.SkuCode    || '',
      skuName:    r.SkuName    || '',
      category:   r.Category   || '',
      unit:       r.Unit       || '',
      quantity:   parseFloat(r.Quantity) || 0,
      updatedAt:  r.UpdatedAt  || '',
      updatedBy:  r.UpdatedBy  || '',
    })) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/warehouse/master  (locations + skus ในครั้งเดียว)
router.get('/master', async (req, res) => {
  try {
    const [locRows, skuRows] = await Promise.all([
      query('SELECT * FROM dbo.WarehouseLocations ORDER BY [LocationID]').catch(() => []),
      query('SELECT * FROM dbo.TypeSKUMaster ORDER BY [TypeSKU]').catch(() => []),
    ]);
    return res.json({ success: true, locations: locRows, skus: skuRows });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/warehouse/audit/progress  (นับ % progress ของ audit)
router.get('/audit/progress', async (req, res) => {
  try {
    const [locRows, auditRows] = await Promise.all([
      query("SELECT COUNT(*) AS total FROM dbo.WarehouseLocations WHERE [Status]=N'active'").catch(() => []),
      query("SELECT COUNT(DISTINCT [LocationID]) AS done FROM dbo.AuditLogs WHERE CONVERT(date,[AuditDate])=CONVERT(date,GETDATE())").catch(() => []),
    ]);
    const total = locRows.length ? (parseInt(locRows[0].total) || 0) : 0;
    const done  = auditRows.length ? (parseInt(auditRows[0].done) || 0) : 0;
    return res.json({ success: true, total, done, pct: total > 0 ? Math.round(done / total * 100) : 0 });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/warehouse/audit/report?month=MM/YYYY
router.get('/audit/report', async (req, res) => {
  try {
    const month = (req.query.month || '').toString();
    let sql = 'SELECT * FROM dbo.AuditLogs WHERE 1=1';
    const inputs = {};
    if (month) { sql += ' AND [AuditDate] LIKE @pat'; inputs.pat = '%/' + month + '%'; }
    sql += ' ORDER BY [AuditDate] DESC';
    const rows = await query(sql, inputs);
    return res.json({ success: true, logs: rows });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/warehouse/stock  (SystemStock — stub)
router.get('/stock', async (req, res) => {
  return res.json({ success: true, items: [], message: 'SystemStock ยังไม่ implement' });
});

// GET /api/warehouse/stock/import-dates  (stub)
router.get('/stock/import-dates', async (req, res) => {
  return res.json({ success: true, dates: [] });
});

// POST /api/warehouse/stock/import  (stub)
router.post('/stock/import', async (req, res) => {
  return res.json({ success: false, message: 'SystemStock import ยังไม่ implement' });
});

// POST /api/warehouse/stock/clear  (stub)
router.post('/stock/clear', async (req, res) => {
  return res.json({ success: false, message: 'SystemStock clear ยังไม่ implement' });
});

// GET /api/warehouse/count?date=
router.get('/count', async (req, res) => {
  return res.json({ success: true, entries: [], message: 'StockCount ยังไม่ implement' });
});

// POST /api/warehouse/count/add  (stub)
router.post('/count/add', async (req, res) => {
  return res.json({ success: false, message: 'StockCount add ยังไม่ implement' });
});

// POST /api/warehouse/count/delete  (stub)
router.post('/count/delete', async (req, res) => {
  return res.json({ success: false, message: 'StockCount delete ยังไม่ implement' });
});

// POST /api/warehouse/count/process  (stub)
router.post('/count/process', async (req, res) => {
  return res.json({ success: false, message: 'StockCount process ยังไม่ implement' });
});

// GET /api/warehouse/count/result
router.get('/count/result', async (req, res) => {
  return res.json({ success: true, rows: [] });
});

// POST /api/warehouse/count/result/update  (stub)
router.post('/count/result/update', async (req, res) => {
  return res.json({ success: false, message: 'StockCount result update ยังไม่ implement' });
});

// POST /api/warehouse/count/result/delete  (stub)
router.post('/count/result/delete', async (req, res) => {
  return res.json({ success: false, message: 'StockCount result delete ยังไม่ implement' });
});

module.exports = router;
