const router = require('express').Router();
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const { getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

let _ready = false;

// Short session-level cache — large sessions (1000+ items) take 300-800ms to query
const _sc = new Map();
const scGet = k => { const e = _sc.get(k); return (e && Date.now() < e.exp) ? e.v : null; };
const scSet = (k, v, ms) => _sc.set(k, { v, exp: Date.now() + ms });
const scDel = k => _sc.delete(k);
async function ensureTables() {
  if (_ready) return;
  const pool = getPool();
  try {
    // Migrate: drop WMS_StockCountItems if SessionID column is missing (any old schema)
    await pool.request().query(`
      IF OBJECT_ID('WMS_StockCountItems','U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='SessionID'
        )
        BEGIN
          IF OBJECT_ID('WMS_StockCountEntries','U') IS NOT NULL DROP TABLE WMS_StockCountEntries;
          DROP TABLE WMS_StockCountItems;
        END
      END
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
        Thickness NVARCHAR(50),
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
    // Indexes for fast lookup by session/item
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_SCI_SessionID' AND object_id=OBJECT_ID('WMS_StockCountItems'))
        CREATE INDEX IX_SCI_SessionID ON WMS_StockCountItems(SessionID);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_SCE_ItemID' AND object_id=OBJECT_ID('WMS_StockCountEntries'))
        CREATE INDEX IX_SCE_ItemID ON WMS_StockCountEntries(ItemID);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_SCE_SessionID' AND object_id=OBJECT_ID('WMS_StockCountEntries'))
        CREATE INDEX IX_SCE_SessionID ON WMS_StockCountEntries(SessionID);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_SCI_Sess_Loc_Code' AND object_id=OBJECT_ID('WMS_StockCountItems'))
        CREATE INDEX IX_SCI_Sess_Loc_Code ON WMS_StockCountItems(SessionID, Location, ItemCode);
    `);
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
        ISNULL(c.ItemCount,0) AS ItemCount,
        ISNULL(c.LockedCount,0) AS LockedCount,
        ISNULL(c.RecountCount,0) AS RecountCount
      FROM WMS_StockCountSessions s WITH (NOLOCK)
      LEFT JOIN (
        SELECT SessionID,
          COUNT(*) AS ItemCount,
          SUM(CASE WHEN IsLocked=1 THEN 1 ELSE 0 END) AS LockedCount,
          SUM(CASE WHEN NeedsRecount=1 THEN 1 ELSE 0 END) AS RecountCount
        FROM WMS_StockCountItems WITH (NOLOCK) GROUP BY SessionID
      ) c ON c.SessionID=s.SessionID
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
  const cacheKey = `sc:${req.params.id}`;
  const hit = scGet(cacheKey);
  if (hit) return res.json({ success: true, data: hit });
  try {
    await ensureTables();
    const pool = getPool();
    const [sess, items] = await Promise.all([
      pool.request().input('ID', sql.Int, req.params.id)
        .query('SELECT * FROM WMS_StockCountSessions WITH (NOLOCK) WHERE SessionID=@ID AND IsActive=1'),
      pool.request().input('ID', sql.Int, req.params.id)
        .query(`SELECT i.*,
          ISNULL(e.TotalCounted,0) AS TotalCounted,
          ISNULL(e.EntryCount,0) AS EntryCount
          FROM WMS_StockCountItems i WITH (NOLOCK)
          LEFT JOIN (
            SELECT ItemID, SUM(CountedQty) AS TotalCounted, COUNT(*) AS EntryCount
            FROM WMS_StockCountEntries WITH (NOLOCK) WHERE SessionID=@ID GROUP BY ItemID
          ) e ON e.ItemID=i.ItemID
          WHERE i.SessionID=@ID ORDER BY i.Location,i.ItemCode`)
    ]);
    if (!sess.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบรอบ' });
    const data = { session: sess.recordset[0], items: items.recordset };
    scSet(cacheKey, data, 8000);
    res.json({ success: true, data });
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
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'กรุณาระบุรหัสผ่านเพื่อยืนยันการลบ' });

    const pool = getPool();

    // Verify caller's password
    const userRes = await pool.request()
      .input('UID', sql.Int, req.user.UserID)
      .query('SELECT Password FROM WMS_Users WITH (NOLOCK) WHERE UserID=@UID AND IsActive=1');
    if (!userRes.recordset.length)
      return res.status(401).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
    const match = await bcrypt.compare(password, userRes.recordset[0].Password);
    if (!match)
      return res.status(400).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });

    const check = await pool.request().input('ID', sql.Int, req.params.id)
      .query('SELECT SessionName FROM WMS_StockCountSessions WHERE SessionID=@ID');
    if (!check.recordset.length)
      return res.status(404).json({ success: false, message: 'ไม่พบรอบนับ' });

    // Delete entries → items → session (in dependency order)
    await pool.request().input('ID', sql.Int, req.params.id)
      .query(`DELETE FROM WMS_StockCountEntries WHERE ItemID IN
              (SELECT ItemID FROM WMS_StockCountItems WHERE SessionID=@ID)`);
    await pool.request().input('ID', sql.Int, req.params.id)
      .query('DELETE FROM WMS_StockCountItems WHERE SessionID=@ID');
    await pool.request().input('ID', sql.Int, req.params.id)
      .query('DELETE FROM WMS_StockCountSessions WHERE SessionID=@ID');

    res.json({ success: true, message: `ลบรอบ "${check.recordset[0].SessionName}" สำเร็จ` });
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

    const sessionId = parseInt(req.params.id);
    const esc = v => v == null ? 'NULL' : `N'${String(v).replace(/'/g, "''")}'`;
    const num = v => (v != null && !isNaN(parseFloat(v))) ? parseFloat(v) : 'NULL';
    const validRows = rows.filter(r => r['Itemcode'] || r['ItemCode'] || r['itemcode']);
    const valStrings = validRows.map(row => {
      const code = esc(String(row['Itemcode'] || row['ItemCode'] || row['itemcode'] || '').trim().substring(0, 50));
      return `(${sessionId},${esc(row['Warehouse'])},${esc(row['Location'])},${code},${esc(String(row['ItemName']||'').substring(0,300))},${esc(String(row['TypeSUK']||'').substring(0,50))},${esc(String(row['GategoryCode']||'').substring(0,20))},${esc(String(row['Gname']||'').substring(0,100))},${esc(row['SizeCode']!=null?String(row['SizeCode']).substring(0,100):null)},${esc(row['Thickness']!=null?String(row['Thickness']).substring(0,50):null)},${parseFloat(row['Quantity'])||0},${num(row['UnitNetWeight'])})`;
    });

    // Respond immediately — HTTP proxy may timeout if we wait for all INSERTs
    res.json({ success: true, message: `กำลังนำเข้า ${validRows.length} รายการ...`, importing: true });

    // Process in background (non-blocking)
    setImmediate(async () => {
      try {
        await pool.request().input('ID', sql.Int, sessionId)
          .query(`DELETE FROM WMS_StockCountEntries WHERE ItemID IN
                  (SELECT ItemID FROM WMS_StockCountItems WHERE SessionID=@ID)`);
        await pool.request().input('ID', sql.Int, sessionId)
          .query('DELETE FROM WMS_StockCountItems WHERE SessionID=@ID');
        const BATCH = 100;
        for (let b = 0; b < valStrings.length; b += BATCH) {
          await pool.request().query(
            `INSERT INTO WMS_StockCountItems (SessionID,Warehouse,Location,ItemCode,ItemName,TypeSKU,CategoryCode,CategoryName,SizeCode,Thickness,SystemQty,SystemWeight) VALUES ${valStrings.slice(b, b + BATCH).join(',')}`
          );
        }
      } catch (e) {
        console.error(`❌ Import session ${sessionId} background error:`, e.message);
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Count entries ─────────────────────────────────────────

router.post('/:id/count', authenticate, async (req, res) => {
  try {
    const { itemId, countedQty, notes } = req.body;
    if (countedQty == null) return res.status(400).json({ success: false, message: 'กรุณาระบุจำนวน' });
    const pool = getPool();
    const check = await pool.request().input('IID', sql.Int, itemId)
      .query(`SELECT i.IsLocked, ISNULL(MAX(e.Round),0) AS MaxRound
              FROM WMS_StockCountItems i
              LEFT JOIN WMS_StockCountEntries e ON e.ItemID=i.ItemID
              WHERE i.ItemID=@IID GROUP BY i.IsLocked`);
    if (!check.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบรายการ' });
    if (check.recordset[0].IsLocked) return res.status(400).json({ success: false, message: 'รายการนี้ถูก Lock แล้ว' });
    await pool.request()
      .input('IID',  sql.Int,          itemId)
      .input('SID',  sql.Int,          parseInt(req.params.id))
      .input('QTY',  sql.Decimal(12,2),parseFloat(countedQty))
      .input('BY',   sql.NVarChar,     req.user?.FullName || req.user?.Username || 'unknown')
      .input('RND',  sql.Int,          check.recordset[0].MaxRound + 1)
      .input('NT',   sql.NVarChar,     notes || null)
      .query(`INSERT INTO WMS_StockCountEntries (ItemID,SessionID,Round,CountedQty,CountedBy,Notes)
              VALUES(@IID,@SID,@RND,@QTY,@BY,@NT);
              UPDATE WMS_StockCountItems SET NeedsRecount=0 WHERE ItemID=@IID;`);
    scDel(`sc:${req.params.id}`);
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
    scDel(`sc:${req.params.id}`);
    res.json({ success: true, message: 'Lock สำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/items/:itemId/unlock', authenticate, async (req, res) => {
  try {
    await getPool().request().input('IID', sql.Int, req.params.itemId)
      .query('UPDATE WMS_StockCountItems SET IsLocked=0,LockedAt=NULL,LockedBy=NULL WHERE ItemID=@IID');
    scDel(`sc:${req.params.id}`);
    res.json({ success: true, message: 'Unlock สำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/items/:itemId/recount', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('IID', sql.Int, req.params.itemId)
      .query(`DELETE FROM WMS_StockCountEntries WHERE ItemID=@IID;
              UPDATE WMS_StockCountItems SET NeedsRecount=1,IsLocked=0 WHERE ItemID=@IID;`);
    scDel(`sc:${req.params.id}`);
    res.json({ success: true, message: 'ส่งกลับตรวจนับสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Lock all items with no diff
router.post('/:id/lock-correct', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const items = await pool.request().input('ID', sql.Int, req.params.id)
      .query(`SELECT i.ItemID, i.SystemQty, ISNULL(e.TotalCounted,0) AS TotalCounted
        FROM WMS_StockCountItems i
        LEFT JOIN (SELECT ItemID, SUM(CountedQty) AS TotalCounted FROM WMS_StockCountEntries WHERE SessionID=@ID GROUP BY ItemID) e ON e.ItemID=i.ItemID
        WHERE i.SessionID=@ID AND i.IsLocked=0`);
    const matchIds = items.recordset
      .filter(i => Math.abs(i.SystemQty - i.TotalCounted) < 0.001)
      .map(i => i.ItemID);
    if (matchIds.length > 0) {
      await pool.request()
        .input('BY', sql.NVarChar, req.user?.FullName || req.user?.Username)
        .query(`UPDATE WMS_StockCountItems SET IsLocked=1,NeedsRecount=0,LockedAt=GETDATE(),LockedBy=@BY WHERE ItemID IN (${matchIds.join(',')})`);
    }
    res.json({ success: true, message: `Lock ${matchIds.length} รายการที่ถูกต้องสำเร็จ` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Send back all items with diff for recount
router.post('/:id/recount-diff', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const items = await pool.request().input('ID', sql.Int, req.params.id)
      .query(`SELECT i.ItemID, i.SystemQty, ISNULL(e.TotalCounted,0) AS TotalCounted
        FROM WMS_StockCountItems i
        LEFT JOIN (SELECT ItemID, SUM(CountedQty) AS TotalCounted FROM WMS_StockCountEntries WHERE SessionID=@ID GROUP BY ItemID) e ON e.ItemID=i.ItemID
        WHERE i.SessionID=@ID AND i.IsLocked=0 AND i.NeedsRecount=0`);
    const diffIds = items.recordset
      .filter(i => Math.abs(i.SystemQty - i.TotalCounted) >= 0.001)
      .map(i => i.ItemID);
    if (diffIds.length > 0) {
      const idList = diffIds.join(',');
      await pool.request().query(`DELETE FROM WMS_StockCountEntries WHERE ItemID IN (${idList})`);
      await pool.request().query(`UPDATE WMS_StockCountItems SET NeedsRecount=1,IsLocked=0 WHERE ItemID IN (${idList})`);
    }
    res.json({ success: true, message: `ส่งกลับ ${diffIds.length} รายการที่มีผลต่างสำเร็จ` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Trim items (keep only selected, DRAFT only) ───────────

router.post('/:id/trim-items', authenticate, async (req, res) => {
  try {
    const { keepIds } = req.body;
    if (!Array.isArray(keepIds) || keepIds.length === 0)
      return res.status(400).json({ success: false, message: 'keepIds required' });
    const pool = getPool();
    const check = await pool.request().input('ID', sql.Int, req.params.id)
      .query('SELECT Status FROM WMS_StockCountSessions WHERE SessionID=@ID');
    if (!check.recordset.length || check.recordset[0].Status !== 'DRAFT')
      return res.status(400).json({ success: false, message: 'ตัดรายการได้เฉพาะรอบ DRAFT' });
    const ids = keepIds.map(Number).filter(n => Number.isInteger(n) && n > 0).join(',');
    if (!ids) return res.status(400).json({ success: false, message: 'keepIds ไม่ถูกต้อง' });
    await pool.request().input('ID', sql.Int, req.params.id).query(
      `DELETE FROM WMS_StockCountEntries WHERE ItemID IN (SELECT ItemID FROM WMS_StockCountItems WHERE SessionID=@ID AND ItemID NOT IN (${ids}))`
    );
    await pool.request().input('ID', sql.Int, req.params.id).query(
      `DELETE FROM WMS_StockCountItems WHERE SessionID=@ID AND ItemID NOT IN (${ids})`
    );
    res.json({ success: true, message: 'บันทึกรายการที่เลือกสำเร็จ' });
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
        ISNULL(e.TotalCounted,0) AS TotalCounted,
        e.CountedBy,
        e.LastCountedAt
        FROM WMS_StockCountItems i
        LEFT JOIN (
          SELECT ItemID, SUM(CountedQty) AS TotalCounted, MAX(CountedBy) AS CountedBy, MAX(CountedAt) AS LastCountedAt
          FROM WMS_StockCountEntries WHERE SessionID=@ID GROUP BY ItemID
        ) e ON e.ItemID=i.ItemID
        WHERE i.SessionID=@ID ORDER BY i.Location,i.ItemCode`);

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
