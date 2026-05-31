const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ===== PRODUCTS =====

router.get('/products', async (req, res) => {
  try {
    const pool = getPool();
    const { search } = req.query;
    const r = pool.request();
    let where = 'WHERE IsActive = 1';
    if (search) { r.input('search', sql.NVarChar, `%${search}%`); where += ' AND (ProductCode LIKE @search OR ProductName LIKE @search)'; }
    const result = await r.query(`SELECT * FROM WMS_Products ${where} ORDER BY ProductCode`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/products', async (req, res) => {
  try {
    const pool = getPool();
    const { productCode, productName, unit, category, description } = req.body;
    const result = await pool.request()
      .input('code', sql.NVarChar, productCode)
      .input('name', sql.NVarChar, productName)
      .input('unit', sql.NVarChar, unit || 'ตัน')
      .input('category', sql.NVarChar, category || null)
      .input('desc', sql.NVarChar, description || null)
      .query(`
        INSERT INTO WMS_Products (ProductCode, ProductName, Unit, Category, Description)
        OUTPUT INSERTED.ProductID
        VALUES (@code, @name, @unit, @category, @desc)
      `);
    res.json({ success: true, productId: result.recordset[0].ProductID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { productName, unit, category, description, isActive } = req.body;
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, productName)
      .input('unit', sql.NVarChar, unit || 'ตัน')
      .input('category', sql.NVarChar, category || null)
      .input('desc', sql.NVarChar, description || null)
      .input('active', sql.Bit, isActive !== false ? 1 : 0)
      .query('UPDATE WMS_Products SET ProductName=@name, Unit=@unit, Category=@category, Description=@desc, IsActive=@active WHERE ProductID=@id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== STOCK BALANCE =====

router.get('/balance', async (req, res) => {
  try {
    const pool = getPool();
    const { warehouseId } = req.query;
    const r = pool.request();
    let cond = warehouseId ? 'AND s.WarehouseID = @warehouseId' : '';
    if (warehouseId) r.input('warehouseId', sql.Int, warehouseId);
    const result = await r.query(`
      SELECT s.StockID, s.WarehouseID, s.ProductID, s.Quantity, s.LastUpdated,
        w.WarehouseName, p.ProductCode, p.ProductName, p.Unit, p.Category
      FROM WMS_Stock s
      JOIN WMS_Warehouses w ON s.WarehouseID = w.WarehouseID
      JOIN WMS_Products p ON s.ProductID = p.ProductID
      WHERE p.IsActive = 1 ${cond}
      ORDER BY w.WarehouseName, p.ProductCode
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== TRANSACTIONS =====

router.get('/transactions', async (req, res) => {
  try {
    const pool = getPool();
    const { warehouseId, productId, txType, limit = 200 } = req.query;
    const r = pool.request().input('limit', sql.Int, parseInt(limit));
    const conds = [];
    if (warehouseId) { r.input('wh', sql.Int, warehouseId); conds.push('t.WarehouseID = @wh'); }
    if (productId) { r.input('pid', sql.Int, productId); conds.push('t.ProductID = @pid'); }
    if (txType) { r.input('tt', sql.NVarChar, txType); conds.push('t.TxType = @tt'); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const result = await r.query(`
      SELECT TOP (@limit)
        t.TxID, t.TxType, t.Quantity, t.RefDocNo, t.TripID, t.Remark, t.TxDate,
        w.WarehouseName, p.ProductCode, p.ProductName, p.Unit,
        u.FullName AS OperatorName
      FROM WMS_StockTransactions t
      JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
      JOIN WMS_Products p ON t.ProductID = p.ProductID
      LEFT JOIN WMS_Users u ON t.OperatorID = u.UserID
      ${where}
      ORDER BY t.TxDate DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/transaction', async (req, res) => {
  try {
    const pool = getPool();
    const { warehouseId, productId, txType, quantity, refDocNo, remark } = req.body;
    const operatorId = req.user.UserID;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction.request()
        .input('wh', sql.Int, warehouseId)
        .input('pid', sql.Int, productId)
        .input('txType', sql.NVarChar, txType)
        .input('qty', sql.Decimal(12, 3), parseFloat(quantity))
        .input('ref', sql.NVarChar, refDocNo || null)
        .input('rem', sql.NVarChar, remark || null)
        .input('op', sql.Int, operatorId)
        .query(`
          INSERT INTO WMS_StockTransactions (WarehouseID, ProductID, TxType, Quantity, RefDocNo, Remark, OperatorID)
          VALUES (@wh, @pid, @txType, @qty, @ref, @rem, @op)
        `);

      const qtyChange = txType === 'OUT' ? -Math.abs(parseFloat(quantity)) : Math.abs(parseFloat(quantity));
      const exists = await transaction.request()
        .input('wh', sql.Int, warehouseId).input('pid', sql.Int, productId)
        .query('SELECT StockID FROM WMS_Stock WHERE WarehouseID = @wh AND ProductID = @pid');

      if (exists.recordset.length > 0) {
        await transaction.request()
          .input('wh', sql.Int, warehouseId).input('pid', sql.Int, productId)
          .input('qty', sql.Decimal(12, 3), qtyChange)
          .query('UPDATE WMS_Stock SET Quantity = Quantity + @qty, LastUpdated = GETDATE() WHERE WarehouseID = @wh AND ProductID = @pid');
      } else {
        await transaction.request()
          .input('wh', sql.Int, warehouseId).input('pid', sql.Int, productId)
          .input('qty', sql.Decimal(12, 3), qtyChange)
          .query('INSERT INTO WMS_Stock (WarehouseID, ProductID, Quantity) VALUES (@wh, @pid, @qty)');
      }
      await transaction.commit();
      res.json({ success: true });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== STOCK COUNT (REDESIGNED) =====
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

let _countSchemaReady = false;
async function ensureCountSchema() {
  if (_countSchemaReady) return;
  const pool = getPool();
  try { await pool.request().query(`IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCount') AND name='WarehouseID' AND is_nullable=0) ALTER TABLE WMS_StockCount ALTER COLUMN WarehouseID INT NULL`); } catch(e) {}
  for (const stmt of [
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCount') AND name='CountName') ALTER TABLE WMS_StockCount ADD CountName NVARCHAR(100) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='ItemCode') ALTER TABLE WMS_StockCountItems ADD ItemCode NVARCHAR(50) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='ExternalName') ALTER TABLE WMS_StockCountItems ADD ExternalName NVARCHAR(200) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='Location') ALTER TABLE WMS_StockCountItems ADD Location NVARCHAR(50) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='WarehouseCode') ALTER TABLE WMS_StockCountItems ADD WarehouseCode NVARCHAR(20) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='TypeSKU') ALTER TABLE WMS_StockCountItems ADD TypeSKU NVARCHAR(50) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='IsClosed') ALTER TABLE WMS_StockCountItems ADD IsClosed BIT DEFAULT 0`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='ClosedBy') ALTER TABLE WMS_StockCountItems ADD ClosedBy INT NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='ClosedAt') ALTER TABLE WMS_StockCountItems ADD ClosedAt DATETIME NULL`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_StockCountEntries' AND xtype='U') CREATE TABLE WMS_StockCountEntries (EntryID INT IDENTITY(1,1) PRIMARY KEY, ItemID INT NOT NULL, CountedQty DECIMAL(12,3) NOT NULL, Note NVARCHAR(200) NULL, CountedBy INT NULL, CountedAt DATETIME DEFAULT GETDATE())`,
  ]) { await pool.request().query(stmt); }
  _countSchemaReady = true;
}

router.get('/count', async (req, res) => {
  try {
    await ensureCountSchema();
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT TOP 50 c.CountID, c.CountCode, c.CountName, c.CountDate, c.Status, c.Remark, c.CreatedAt,
        ISNULL(w.WarehouseName,'') AS WarehouseName, u.FullName AS OperatorName,
        (SELECT COUNT(*) FROM WMS_StockCountItems i WHERE i.CountID=c.CountID) AS ItemCount,
        (SELECT COUNT(*) FROM WMS_StockCountItems i WHERE i.CountID=c.CountID AND i.IsClosed=1) AS ClosedCount
      FROM WMS_StockCount c
      LEFT JOIN WMS_Warehouses w ON c.WarehouseID=w.WarehouseID
      LEFT JOIN WMS_Users u ON c.OperatorID=u.UserID
      ORDER BY c.CreatedAt DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/count', async (req, res) => {
  try {
    await ensureCountSchema();
    const pool = getPool();
    const { countName, countDate, remark } = req.body;
    if (!countName) return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อรายการนับ' });
    const operatorId = req.user.UserID;
    const dateStr = (countDate || new Date(Date.now()+7*3600000).toISOString().slice(0,10)).replace(/-/g,'');
    const seq = await pool.request().input('prefix', sql.NVarChar, `CNT-${dateStr}-%`)
      .query('SELECT COUNT(*)+1 AS seq FROM WMS_StockCount WHERE CountCode LIKE @prefix');
    const countCode = `CNT-${dateStr}-${String(seq.recordset[0].seq).padStart(3,'0')}`;
    const result = await pool.request()
      .input('code', sql.NVarChar, countCode).input('name', sql.NVarChar, countName)
      .input('date', sql.Date, countDate || new Date(Date.now()+7*3600000).toISOString().slice(0,10))
      .input('rem', sql.NVarChar, remark || null).input('op', sql.Int, operatorId)
      .query(`INSERT INTO WMS_StockCount (CountCode, CountName, CountDate, Status, Remark, OperatorID) OUTPUT INSERTED.CountID VALUES (@code,@name,@date,'DRAFT',@rem,@op)`);
    res.json({ success: true, countId: result.recordset[0].CountID, countCode });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/count/:id/import-excel', upload.single('file'), async (req, res) => {
  try {
    await ensureCountSchema();
    const pool = getPool();
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาอัปโหลดไฟล์' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headers = rows[0] || [];
    const col = (name) => headers.indexOf(name);
    const dataRows = rows.slice(1).filter(r => r.length > 0 && r[col('Itemcode')]);
    if (!dataRows.length) return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลในไฟล์' });

    await pool.request().input('cid', sql.Int, req.params.id)
      .query('DELETE FROM WMS_StockCountEntries WHERE ItemID IN (SELECT ItemID FROM WMS_StockCountItems WHERE CountID=@cid)');
    await pool.request().input('cid', sql.Int, req.params.id)
      .query('DELETE FROM WMS_StockCountItems WHERE CountID=@cid');

    const validRows = dataRows.filter(row => String(row[col('Itemcode')] || '').trim());
    const BATCH = 30;
    for (let i = 0; i < validRows.length; i += BATCH) {
      await Promise.all(validRows.slice(i, i + BATCH).map(row =>
        pool.request()
          .input('cid', sql.Int, parseInt(req.params.id))
          .input('ic', sql.NVarChar, String(row[col('Itemcode')] || '').trim())
          .input('en', sql.NVarChar, String(row[col('ItemName')] || '').trim())
          .input('loc', sql.NVarChar, String(row[col('Location')] || '').trim() || null)
          .input('wc', sql.NVarChar, String(row[col('Warehouse')] || '').trim() || null)
          .input('sku', sql.NVarChar, String(row[col('TypeSUK')] || '').trim() || null)
          .input('sq', sql.Decimal(12,3), parseFloat(row[col('Quantity')]) || 0)
          .query(`INSERT INTO WMS_StockCountItems (CountID,ItemCode,ExternalName,Location,WarehouseCode,TypeSKU,SystemQty,IsClosed) VALUES (@cid,@ic,@en,@loc,@wc,@sku,@sq,0)`)
      ));
    }
    const inserted = validRows.length;
    await pool.request().input('id', sql.Int, parseInt(req.params.id))
      .query("UPDATE WMS_StockCount SET Status='OPEN' WHERE CountID=@id");
    res.json({ success: true, message: `นำเข้าสำเร็จ ${inserted} รายการ`, imported: inserted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/count/:id', async (req, res) => {
  try {
    await ensureCountSchema();
    const pool = getPool();
    const header = await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT c.*, ISNULL(w.WarehouseName,'') AS WarehouseName, u.FullName AS OperatorName
      FROM WMS_StockCount c LEFT JOIN WMS_Warehouses w ON c.WarehouseID=w.WarehouseID LEFT JOIN WMS_Users u ON c.OperatorID=u.UserID
      WHERE c.CountID=@id
    `);
    if (!header.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบรายการ' });
    const items = await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT i.*,
        (SELECT TOP 1 e.CountedQty FROM WMS_StockCountEntries e WHERE e.ItemID=i.ItemID ORDER BY e.CountedAt DESC) AS LatestCount,
        (SELECT COUNT(*) FROM WMS_StockCountEntries e WHERE e.ItemID=i.ItemID) AS EntryCount,
        cu.FullName AS ClosedByName
      FROM WMS_StockCountItems i LEFT JOIN WMS_Users cu ON i.ClosedBy=cu.UserID
      WHERE i.CountID=@id ORDER BY i.IsClosed, i.Location, i.ExternalName
    `);
    res.json({ success: true, data: { ...header.recordset[0], items: items.recordset } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/count/:id/entries', async (req, res) => {
  try {
    await ensureCountSchema();
    const pool = getPool();
    const { itemId, countedQty, note } = req.body;
    if (itemId == null || countedQty == null) return res.status(400).json({ success: false, message: 'กรุณาระบุ itemId และ countedQty' });
    await pool.request()
      .input('iid', sql.Int, itemId).input('qty', sql.Decimal(12,3), parseFloat(countedQty))
      .input('note', sql.NVarChar, note || null).input('by', sql.Int, req.user.UserID)
      .query('INSERT INTO WMS_StockCountEntries (ItemID,CountedQty,Note,CountedBy) VALUES (@iid,@qty,@note,@by)');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/count/:id/entries/:itemId', async (req, res) => {
  try {
    await ensureCountSchema();
    const pool = getPool();
    const result = await pool.request().input('iid', sql.Int, req.params.itemId).query(`
      SELECT e.*, u.FullName AS CountedByName FROM WMS_StockCountEntries e
      LEFT JOIN WMS_Users u ON e.CountedBy=u.UserID WHERE e.ItemID=@iid ORDER BY e.CountedAt DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/count/:id/close-items', async (req, res) => {
  try {
    await ensureCountSchema();
    const pool = getPool();
    const { itemIds, all } = req.body;
    const by = req.user.UserID;
    if (all) {
      await pool.request().input('cid', sql.Int, req.params.id).input('by', sql.Int, by)
        .query('UPDATE WMS_StockCountItems SET IsClosed=1,ClosedBy=@by,ClosedAt=GETDATE() WHERE CountID=@cid AND IsClosed=0');
    } else if (itemIds?.length) {
      const safeIds = itemIds.map(id => parseInt(id)).filter(n => Number.isInteger(n) && n > 0).join(',');
      if (safeIds) {
        await pool.request().input('by', sql.Int, by)
          .query(`UPDATE WMS_StockCountItems SET IsClosed=1,ClosedBy=@by,ClosedAt=GETDATE() WHERE ItemID IN (${safeIds})`);
      }
    }
    const rem = await pool.request().input('cid', sql.Int, req.params.id)
      .query('SELECT COUNT(*) AS cnt FROM WMS_StockCountItems WHERE CountID=@cid AND IsClosed=0');
    if (rem.recordset[0].cnt === 0)
      await pool.request().input('cid', sql.Int, req.params.id)
        .query("UPDATE WMS_StockCount SET Status='CLOSED' WHERE CountID=@cid AND Status='OPEN'");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/count/:id/reopen-items', async (req, res) => {
  try {
    await ensureCountSchema();
    const pool = getPool();
    const { itemIds } = req.body;
    if (itemIds?.length) {
      const safeIds = itemIds.map(id => parseInt(id)).filter(n => Number.isInteger(n) && n > 0).join(',');
      if (safeIds) {
        await pool.request()
          .query(`UPDATE WMS_StockCountItems SET IsClosed=0,ClosedBy=NULL,ClosedAt=NULL WHERE ItemID IN (${safeIds})`);
      }
      await pool.request().input('cid', sql.Int, req.params.id)
        .query("UPDATE WMS_StockCount SET Status='OPEN' WHERE CountID=@cid AND Status='CLOSED'");
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



router.put('/count/:id/cancel', async (req, res) => {
  try {
    await ensureCountSchema();
    const pool = getPool();
    await pool.request().input('id', sql.Int, req.params.id)
      .query("UPDATE WMS_StockCount SET Status='CANCELLED' WHERE CountID=@id AND Status IN ('DRAFT','OPEN')");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
