const router = require('express').Router();
const sql = require('mssql');
const { getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

let _ready = false;
async function ensureTables() {
  if (_ready) return;
  const pool = getPool();
  try {
    // Migrate: drop WMS_StockCountItems if it has the old schema (CountID column)
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='CountID')
        DROP TABLE WMS_StockCountItems;
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_StockCountSessions' AND xtype='U')
      CREATE TABLE WMS_StockCountSessions (
        SessionID INT IDENTITY(1,1) PRIMARY KEY,
        SessionName NVARCHAR(200) NOT NULL,
        WarehouseCode NVARCHAR(20),
        Status NVARCHAR(20) DEFAULT 'DRAFT',
        Notes NVARCHAR(500),
        CreatedBy NVARCHAR(100),
        CreatedAt DATETIME DEFAULT GETDATE(),
        OpenedAt DATETIME,
        CompletedAt DATETIME,
        IsActive BIT DEFAULT 1
      );`);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_StockCountItems' AND xtype='U')
      CREATE TABLE WMS_StockCountItems (
        ItemID INT IDENTITY(1,1) PRIMARY KEY,
        SessionID INT NOT NULL,
        Warehouse NVARCHAR(20),
        Location NVARCHAR(50),
        ItemCode NVARCHAR(50),
        ItemName NVARCHAR(300),
        TypeSKU NVARCHAR(50),
        CategoryCode NVARCHAR(20),
        CategoryName NVARCHAR(100),
        SizeCode NVARCHAR(100),
        SystemQty DECIMAL(12,2) DEFAULT 0,
        SystemWeight DECIMAL(12,2),
        IsLocked BIT DEFAULT 0,
        NeedsRecount BIT DEFAULT 0,
        LockedAt DATETIME,
        LockedBy NVARCHAR(100)
      );`);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_StockCountEntries' AND xtype='U')
      CREATE TABLE WMS_StockCountEntries (
        EntryID INT IDENTITY(1,1) PRIMARY KEY,
        ItemID INT NOT NULL,
        SessionID INT NOT NULL,
        Round INT DEFAULT 1,
        CountedQty DECIMAL(12,2) NOT NULL,
        CountedBy NVARCHAR(100),
        CountedAt DATETIME DEFAULT GETDATE(),
        Notes NVARCHAR(300)
      );`);
    _ready = true;
  } catch (e) {
    console.error('StockCount ensureTables:', e.message);
  }
}

// ── Sessions ──────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const result = await getPool().request().query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM WMS_StockCountItems WHERE SessionID=s.SessionID) AS ItemCount,
        (SELECT COUNT(*) FROM WMS_StockCountItems WHERE SessionID=s.SessionID AND IsLocked=1) AS LockedCount,
        (SELECT COUNT(*) FROM WMS_StockCountItems WHERE SessionID=s.SessionID AND NeedsRecount=1) AS RecountCount
      FROM WMS_StockCountSessions s
      WHERE s.IsActive=1 ORDER BY s.CreatedAt DESC`);
    res.json({ success: true, data: result.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const { sessionName, warehouseCode, notes } = req.body;
    if (!sessionName) return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อรอบ' });
    const r = await getPool().request()
      .input('N', sql.NVarChar, sessionName)
      .input('W', sql.NVarChar, warehouseCode || null)
      .input('NT', sql.NVarChar, notes || null)
      .input('B', sql.NVarChar, req.user?.FullName || req.user?.Username || 'system')
      .query(`INSERT INTO WMS_StockCountSessions (SessionName,WarehouseCode,Notes,CreatedBy)
              OUTPUT INSERTED.SessionID VALUES(@N,@W,@NT,@B)`);
    res.json({ success: true, message: 'สร้างรอบตรวจนับสำเร็จ', data: { sessionId: r.recordset[0].SessionID } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const sess = await pool.request().input('ID', sql.Int, req.params.id)
      .query('SELECT * FROM WMS_StockCountSessions WHERE SessionID=@ID AND IsActive=1');
    if (!sess.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบรอบ' });
    const items = await pool.request().input('ID', sql.Int, req.params.id)
      .query(`SELECT i.*,
        ISNULL((SELECT SUM(e.CountedQty) FROM WMS_StockCountEntries e WHERE e.ItemID=i.ItemID),0) AS TotalCounted,
        (SELECT COUNT(*) FROM WMS_StockCountEntries e WHERE e.ItemID=i.ItemID) AS EntryCount
        FROM WMS_StockCountItems i WHERE i.SessionID=@ID ORDER BY i.Location,i.ItemCode`);
    res.json({ success: true, data: { session: sess.recordset[0], items: items.recordset } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['DRAFT','OPEN','COMPLETED'].includes(status)) return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });
    const pool = getPool();
    let extra = status === 'OPEN' ? ',OpenedAt=GETDATE()' : status === 'COMPLETED' ? ',CompletedAt=GETDATE()' : '';
    await pool.request().input('ID', sql.Int, req.params.id).input('S', sql.NVarChar, status)
      .query(`UPDATE WMS_StockCountSessions SET Status=@S${extra} WHERE SessionID=@ID`);
    res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const check = await pool.request().input('ID', sql.Int, req.params.id)
      .query('SELECT Status FROM WMS_StockCountSessions WHERE SessionID=@ID');
    if (!check.recordset.length || check.recordset[0].Status !== 'DRAFT')
      return res.status(400).json({ success: false, message: 'ลบได้เฉพาะรอบ DRAFT' });
    await pool.request().input('ID', sql.Int, req.params.id)
      .query('UPDATE WMS_StockCountSessions SET IsActive=0 WHERE SessionID=@ID');
    res.json({ success: true, message: 'ลบรอบสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Import Excel ──────────────────────────────────────────

router.post('/:id/import', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'ไม่พบไฟล์' });
  try {
    await ensureTables();
    const pool = getPool();
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);
    if (!rows.length) return res.status(400).json({ success: false, message: 'ไม่พบข้อมูล' });

    // Clear previous import for this session
    await pool.request().input('ID', sql.Int, req.params.id)
      .query('DELETE FROM WMS_StockCountEntries WHERE SessionID=@ID');
    await pool.request().input('ID', sql.Int, req.params.id)
      .query('DELETE FROM WMS_StockCountItems WHERE SessionID=@ID');

    let imported = 0;
    for (const row of rows) {
      const code = row['Itemcode'] || row['ItemCode'] || row['itemcode'] || '';
      if (!code) continue;
      await pool.request()
        .input('SID', sql.Int, req.params.id)
        .input('WH',  sql.NVarChar, row['Warehouse'] || null)
        .input('LOC', sql.NVarChar, row['Location']  || null)
        .input('CODE',sql.NVarChar, String(code).trim())
        .input('NAME',sql.NVarChar, row['ItemName']  || null)
        .input('SKU', sql.NVarChar, row['TypeSUK']   || null)
        .input('CC',  sql.NVarChar, row['GategoryCode'] || null)
        .input('CN',  sql.NVarChar, row['Gname']     || null)
        .input('SZ',  sql.NVarChar, row['SizeCode'] != null ? String(row['SizeCode']) : null)
        .input('QTY', sql.Decimal(12,2), parseFloat(row['Quantity']) || 0)
        .input('WGT', sql.Decimal(12,2), row['UnitNetWeight'] != null ? parseFloat(row['UnitNetWeight']) : null)
        .query(`INSERT INTO WMS_StockCountItems
          (SessionID,Warehouse,Location,ItemCode,ItemName,TypeSKU,CategoryCode,CategoryName,SizeCode,SystemQty,SystemWeight)
          VALUES(@SID,@WH,@LOC,@CODE,@NAME,@SKU,@CC,@CN,@SZ,@QTY,@WGT)`);
      imported++;
    }
    res.json({ success: true, message: `นำเข้า ${imported} รายการสำเร็จ` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Count entries ─────────────────────────────────────────

router.post('/:id/count', authenticate, async (req, res) => {
  try {
    const { itemId, countedQty, notes } = req.body;
    if (countedQty == null) return res.status(400).json({ success: false, message: 'กรุณาระบุจำนวน' });
    const pool = getPool();
    const item = await pool.request().input('IID', sql.Int, itemId)
      .query('SELECT IsLocked FROM WMS_StockCountItems WHERE ItemID=@IID');
    if (!item.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบรายการ' });
    if (item.recordset[0].IsLocked) return res.status(400).json({ success: false, message: 'รายการนี้ถูก Lock แล้ว' });
    const rnd = await pool.request().input('IID', sql.Int, itemId)
      .query('SELECT ISNULL(MAX(Round),0) AS R FROM WMS_StockCountEntries WHERE ItemID=@IID');
    await pool.request()
      .input('IID',  sql.Int,          itemId)
      .input('SID',  sql.Int,          req.params.id)
      .input('QTY',  sql.Decimal(12,2),parseFloat(countedQty))
      .input('BY',   sql.NVarChar,     req.user?.FullName || req.user?.Username || 'unknown')
      .input('RND',  sql.Int,          (rnd.recordset[0].R || 0) + 1)
      .input('NT',   sql.NVarChar,     notes || null)
      .query(`INSERT INTO WMS_StockCountEntries (ItemID,SessionID,Round,CountedQty,CountedBy,Notes)
              VALUES(@IID,@SID,@RND,@QTY,@BY,@NT)`);
    await pool.request().input('IID', sql.Int, itemId)
      .query('UPDATE WMS_StockCountItems SET NeedsRecount=0 WHERE ItemID=@IID');
    res.json({ success: true, message: 'บันทึกยอดนับสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id/items/:itemId/entries', authenticate, async (req, res) => {
  try {
    const r = await getPool().request().input('IID', sql.Int, req.params.itemId)
      .query('SELECT * FROM WMS_StockCountEntries WHERE ItemID=@IID ORDER BY Round,CountedAt');
    res.json({ success: true, data: r.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Lock / Recount ────────────────────────────────────────

router.put('/:id/items/:itemId/lock', authenticate, async (req, res) => {
  try {
    await getPool().request()
      .input('IID', sql.Int, req.params.itemId)
      .input('BY',  sql.NVarChar, req.user?.FullName || req.user?.Username)
      .query(`UPDATE WMS_StockCountItems SET IsLocked=1,NeedsRecount=0,LockedAt=GETDATE(),LockedBy=@BY WHERE ItemID=@IID`);
    res.json({ success: true, message: 'Lock สำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/items/:itemId/unlock', authenticate, async (req, res) => {
  try {
    await getPool().request().input('IID', sql.Int, req.params.itemId)
      .query('UPDATE WMS_StockCountItems SET IsLocked=0,LockedAt=NULL,LockedBy=NULL WHERE ItemID=@IID');
    res.json({ success: true, message: 'Unlock สำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/items/:itemId/recount', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    // Clear previous entries so field can recount fresh
    await pool.request().input('IID', sql.Int, req.params.itemId)
      .query('DELETE FROM WMS_StockCountEntries WHERE ItemID=@IID');
    await pool.request().input('IID', sql.Int, req.params.itemId)
      .query('UPDATE WMS_StockCountItems SET NeedsRecount=1,IsLocked=0 WHERE ItemID=@IID');
    res.json({ success: true, message: 'ส่งกลับตรวจนับสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Lock all items with no diff
router.post('/:id/lock-correct', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const items = await pool.request().input('ID', sql.Int, req.params.id)
      .query(`SELECT i.ItemID, i.SystemQty,
        ISNULL((SELECT SUM(e.CountedQty) FROM WMS_StockCountEntries e WHERE e.ItemID=i.ItemID),0) AS TotalCounted
        FROM WMS_StockCountItems i WHERE i.SessionID=@ID AND i.IsLocked=0`);
    let count = 0;
    for (const item of items.recordset) {
      if (Math.abs(item.SystemQty - item.TotalCounted) < 0.001) {
        await pool.request()
          .input('IID', sql.Int, item.ItemID)
          .input('BY', sql.NVarChar, req.user?.FullName || req.user?.Username)
          .query(`UPDATE WMS_StockCountItems SET IsLocked=1,NeedsRecount=0,LockedAt=GETDATE(),LockedBy=@BY WHERE ItemID=@IID`);
        count++;
      }
    }
    res.json({ success: true, message: `Lock ${count} รายการที่ถูกต้องสำเร็จ` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Send back all items with diff for recount
router.post('/:id/recount-diff', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const items = await pool.request().input('ID', sql.Int, req.params.id)
      .query(`SELECT i.ItemID, i.SystemQty,
        ISNULL((SELECT SUM(e.CountedQty) FROM WMS_StockCountEntries e WHERE e.ItemID=i.ItemID),0) AS TotalCounted
        FROM WMS_StockCountItems i WHERE i.SessionID=@ID AND i.IsLocked=0 AND i.NeedsRecount=0`);
    let count = 0;
    for (const item of items.recordset) {
      if (Math.abs(item.SystemQty - item.TotalCounted) >= 0.001) {
        await pool.request().input('IID', sql.Int, item.ItemID)
          .query('DELETE FROM WMS_StockCountEntries WHERE ItemID=@IID');
        await pool.request().input('IID', sql.Int, item.ItemID)
          .query('UPDATE WMS_StockCountItems SET NeedsRecount=1,IsLocked=0 WHERE ItemID=@IID');
        count++;
      }
    }
    res.json({ success: true, message: `ส่งกลับ ${count} รายการที่มีผลต่างสำเร็จ` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Report ────────────────────────────────────────────────

router.get('/:id/report', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const sess = await pool.request().input('ID', sql.Int, req.params.id)
      .query('SELECT * FROM WMS_StockCountSessions WHERE SessionID=@ID');
    if (!sess.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบรอบ' });
    const s = sess.recordset[0];
    const items = await pool.request().input('ID', sql.Int, req.params.id)
      .query(`SELECT i.*,
        ISNULL((SELECT SUM(e.CountedQty) FROM WMS_StockCountEntries e WHERE e.ItemID=i.ItemID),0) AS TotalCounted,
        (SELECT MAX(e.CountedBy) FROM WMS_StockCountEntries e WHERE e.ItemID=i.ItemID) AS CountedBy,
        (SELECT MAX(e.CountedAt) FROM WMS_StockCountEntries e WHERE e.ItemID=i.ItemID) AS LastCountedAt
        FROM WMS_StockCountItems i WHERE i.SessionID=@ID ORDER BY i.Location,i.ItemCode`);

    const wb = XLSX.utils.book_new();
    const hdr = ['Warehouse','Location','รหัสสินค้า','ชื่อสินค้า','ประเภท SKU','หมวดหมู่','ยอดระบบ','ยอดนับได้','ผลต่าง','สถานะ','ผู้นับ','เวลานับล่าสุด'];
    const data = [hdr, ...items.recordset.map(i => {
      const diff = Number(i.TotalCounted) - Number(i.SystemQty);
      return [
        i.Warehouse, i.Location, i.ItemCode, i.ItemName, i.TypeSKU || '', i.CategoryName || '',
        i.SystemQty, i.TotalCounted, diff.toFixed(2),
        i.IsLocked ? 'Lock' : i.NeedsRecount ? 'ตรวจนับซ้ำ' : i.EntryCount > 0 ? 'นับแล้ว' : 'รอนับ',
        i.CountedBy || '', i.LastCountedAt ? new Date(i.LastCountedAt).toLocaleString('th-TH') : ''
      ];
    })];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [10,14,20,40,14,16,12,12,12,14,16,20].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'ผลการตรวจนับ');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fname = `stock_count_${s.SessionName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
