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

// ===== STOCK COUNT =====

router.get('/count', async (req, res) => {
  try {
    const pool = getPool();
    const { warehouseId } = req.query;
    const r = pool.request();
    const cond = warehouseId ? 'AND c.WarehouseID = @wh' : '';
    if (warehouseId) r.input('wh', sql.Int, warehouseId);
    const result = await r.query(`
      SELECT TOP 50 c.CountID, c.CountCode, c.CountDate, c.Status, c.Remark, c.CreatedAt,
        w.WarehouseName, u.FullName AS OperatorName,
        (SELECT COUNT(*) FROM WMS_StockCountItems i WHERE i.CountID = c.CountID) AS ItemCount,
        (SELECT COUNT(*) FROM WMS_StockCountItems i WHERE i.CountID = c.CountID AND i.ActualQty IS NOT NULL) AS FilledCount
      FROM WMS_StockCount c
      JOIN WMS_Warehouses w ON c.WarehouseID = w.WarehouseID
      LEFT JOIN WMS_Users u ON c.OperatorID = u.UserID
      WHERE 1=1 ${cond}
      ORDER BY c.CreatedAt DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/count', async (req, res) => {
  try {
    const pool = getPool();
    const { warehouseId, countDate, remark } = req.body;
    const operatorId = req.user.UserID;
    const dateStr = (countDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');

    const seq = await pool.request()
      .input('prefix', sql.NVarChar, `CNT-${dateStr}-%`)
      .query('SELECT COUNT(*)+1 AS seq FROM WMS_StockCount WHERE CountCode LIKE @prefix');
    const countCode = `CNT-${dateStr}-${String(seq.recordset[0].seq).padStart(3, '0')}`;

    const stockItems = await pool.request()
      .input('wh', sql.Int, warehouseId)
      .query(`
        SELECT p.ProductID, ISNULL(s.Quantity, 0) AS SystemQty
        FROM WMS_Products p
        LEFT JOIN WMS_Stock s ON s.ProductID = p.ProductID AND s.WarehouseID = @wh
        WHERE p.IsActive = 1
      `);

    const result = await pool.request()
      .input('code', sql.NVarChar, countCode)
      .input('wh', sql.Int, warehouseId)
      .input('date', sql.Date, countDate || new Date())
      .input('rem', sql.NVarChar, remark || null)
      .input('op', sql.Int, operatorId)
      .query(`
        INSERT INTO WMS_StockCount (CountCode, WarehouseID, CountDate, Remark, OperatorID)
        OUTPUT INSERTED.CountID
        VALUES (@code, @wh, @date, @rem, @op)
      `);

    const countId = result.recordset[0].CountID;
    for (const item of stockItems.recordset) {
      await pool.request()
        .input('cid', sql.Int, countId)
        .input('pid', sql.Int, item.ProductID)
        .input('sysQty', sql.Decimal(12, 3), item.SystemQty)
        .query('INSERT INTO WMS_StockCountItems (CountID, ProductID, SystemQty) VALUES (@cid, @pid, @sysQty)');
    }

    res.json({ success: true, countId, countCode });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/count/:id', async (req, res) => {
  try {
    const pool = getPool();
    const header = await pool.request().input('id', sql.Int, req.params.id)
      .query(`
        SELECT c.*, w.WarehouseName, u.FullName AS OperatorName
        FROM WMS_StockCount c
        JOIN WMS_Warehouses w ON c.WarehouseID = w.WarehouseID
        LEFT JOIN WMS_Users u ON c.OperatorID = u.UserID
        WHERE c.CountID = @id
      `);
    const items = await pool.request().input('id', sql.Int, req.params.id)
      .query(`
        SELECT i.ItemID, i.ProductID, i.SystemQty, i.ActualQty, i.Remark,
          p.ProductCode, p.ProductName, p.Unit,
          CASE WHEN i.ActualQty IS NOT NULL THEN i.ActualQty - i.SystemQty ELSE NULL END AS Variance
        FROM WMS_StockCountItems i
        JOIN WMS_Products p ON i.ProductID = p.ProductID
        WHERE i.CountID = @id
        ORDER BY p.ProductCode
      `);
    res.json({ success: true, data: { ...header.recordset[0], items: items.recordset } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/count/:id/items', async (req, res) => {
  try {
    const pool = getPool();
    const { items } = req.body;
    for (const item of items) {
      await pool.request()
        .input('iid', sql.Int, item.itemId)
        .input('qty', sql.Decimal(12, 3), item.actualQty)
        .input('rem', sql.NVarChar, item.remark || null)
        .query('UPDATE WMS_StockCountItems SET ActualQty=@qty, Remark=@rem WHERE ItemID=@iid');
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/count/:id/confirm', async (req, res) => {
  try {
    const pool = getPool();
    const operatorId = req.user.UserID;

    const header = await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT * FROM WMS_StockCount WHERE CountID = @id');
    if (!header.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบรายการ' });
    if (header.recordset[0].Status !== 'DRAFT') return res.status(400).json({ success: false, message: 'ยืนยันแล้ว' });
    const count = header.recordset[0];

    const items = await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT * FROM WMS_StockCountItems WHERE CountID = @id AND ActualQty IS NOT NULL');

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      for (const item of items.recordset) {
        const variance = item.ActualQty - item.SystemQty;
        if (variance === 0) continue;

        await transaction.request()
          .input('wh', sql.Int, count.WarehouseID).input('pid', sql.Int, item.ProductID)
          .input('qty', sql.Decimal(12, 3), variance).input('ref', sql.NVarChar, count.CountCode)
          .input('rem', sql.NVarChar, `ปรับจากนับสต็อก ${count.CountCode}`).input('op', sql.Int, operatorId)
          .query(`
            INSERT INTO WMS_StockTransactions (WarehouseID, ProductID, TxType, Quantity, RefDocNo, Remark, OperatorID)
            VALUES (@wh, @pid, 'COUNT', @qty, @ref, @rem, @op)
          `);

        const se = await transaction.request()
          .input('wh', sql.Int, count.WarehouseID).input('pid', sql.Int, item.ProductID)
          .query('SELECT StockID FROM WMS_Stock WHERE WarehouseID = @wh AND ProductID = @pid');

        if (se.recordset.length > 0) {
          await transaction.request()
            .input('wh', sql.Int, count.WarehouseID).input('pid', sql.Int, item.ProductID)
            .input('qty', sql.Decimal(12, 3), variance)
            .query('UPDATE WMS_Stock SET Quantity = Quantity + @qty, LastUpdated = GETDATE() WHERE WarehouseID = @wh AND ProductID = @pid');
        } else {
          await transaction.request()
            .input('wh', sql.Int, count.WarehouseID).input('pid', sql.Int, item.ProductID)
            .input('qty', sql.Decimal(12, 3), item.ActualQty)
            .query('INSERT INTO WMS_Stock (WarehouseID, ProductID, Quantity) VALUES (@wh, @pid, @qty)');
        }
      }

      await transaction.request().input('id', sql.Int, req.params.id).input('op', sql.Int, operatorId)
        .query("UPDATE WMS_StockCount SET Status='CONFIRMED', ConfirmedBy=@op, ConfirmedAt=GETDATE() WHERE CountID=@id");

      await transaction.commit();
      res.json({ success: true, message: 'ยืนยันการนับสต็อกสำเร็จ' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/count/:id/cancel', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('id', sql.Int, req.params.id)
      .query("UPDATE WMS_StockCount SET Status='CANCELLED' WHERE CountID=@id AND Status='DRAFT'");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
