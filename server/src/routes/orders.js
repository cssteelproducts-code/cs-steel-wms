const router         = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query, execute } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
const { getTodayStr } = require('./utils');
router.use(authMiddleware);

function rowToOrder(r) {
  return {
    orderId:       r.OrderID       || '',
    orderDate:     r.OrderDate     || '',
    arcode:        r.Arcode        || '',
    arname:        r.Arname        || '',
    deliveryZone:  r.DeliveryZone  || '',
    productType:   r.ProductType   || '',
    weightKg:      parseFloat(r.WeightKg)      || 0,
    lengthM:       parseFloat(r.LengthM)       || 0,
    widthM:        parseFloat(r.WidthM)        || 0,
    heightM:       parseFloat(r.HeightM)       || 0,
    quantityPieces:parseFloat(r.QuantityPieces)|| 0,
    deadlineDate:  r.DeadlineDate  || '',
    planDate:      r.PlanDate      || '',
    priority:      parseInt(r.Priority) || 2,
    status:        r.Status        || '',
    assignedPlanId:r.AssignedPlanID|| '',
    remark:        r.Remark        || '',
    lat:           parseFloat(r.Lat) || null,
    lng:           parseFloat(r.Lng) || null,
    itemsDetail:   r.ItemsDetail   || '',
    requiresHiab:  r.RequiresHiab === true || r.RequiresHiab === 1 || r.RequiresHiab === '1',
    isLongDistance:r.IsLongDistance === true || r.IsLongDistance === 1 || r.IsLongDistance === '1',
  };
}

// GET /api/orders?status=&zone=&from=&to=
router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM dbo.DeliveryOrders WHERE 1=1';
    const inputs = {};
    if (req.query.status) { sql += ' AND [Status]=@st'; inputs.st = req.query.status; }
    if (req.query.zone)   { sql += ' AND [DeliveryZone] LIKE @z'; inputs.z = '%' + req.query.zone + '%'; }
    if (req.query.from)   { sql += ' AND [PlanDate]>=@fd'; inputs.fd = req.query.from; }
    if (req.query.to)     { sql += ' AND [PlanDate]<=@td'; inputs.td = req.query.to; }
    sql += ' ORDER BY [Priority],[DeadlineDate]';
    const rows = await query(sql, inputs);
    const orders = rows.map(rowToOrder);
    const summary = {
      total:         orders.length,
      pendingCount:  orders.filter(o => o.status === 'รอมอบหมาย').length,
      assignedCount: orders.filter(o => o.status === 'มอบหมายแล้ว').length,
      deliveredCount:orders.filter(o => o.status === 'จัดส่งแล้ว').length,
    };
    return res.json({ success: true, orders, summary });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/orders/unassigned
router.get('/unassigned', async (req, res) => {
  try {
    const rows = await query("SELECT * FROM dbo.DeliveryOrders WHERE [Status]=N'รอมอบหมาย' ORDER BY [Priority],[DeadlineDate]");
    return res.json({ success: true, orders: rows.map(rowToOrder) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/orders/suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const cRows = await query('SELECT DISTINCT [Arcode],[Arname] FROM dbo.Customers ORDER BY [Arname]');
    const zRows = await query('SELECT DISTINCT [DeliveryZone] FROM dbo.DeliveryOrders WHERE [DeliveryZone] IS NOT NULL ORDER BY [DeliveryZone]');
    return res.json({ success: true, customers: cRows, zones: zRows.map(r => r.DeliveryZone) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/orders/add
router.post('/add', async (req, res) => {
  try {
    const p = req.body;
    const orderId = p.orderId || ('ORD-' + uuidv4().slice(0,8).toUpperCase());
    await execute(
      `INSERT INTO dbo.DeliveryOrders ([OrderID],[OrderDate],[Arcode],[Arname],[DeliveryZone],[ProductType],
       [WeightKg],[LengthM],[WidthM],[HeightM],[QuantityPieces],[DeadlineDate],[Priority],[Status],
       [AssignedPlanID],[Remark],[Lat],[Lng],[ItemsDetail],[PlanDate],[RequiresHiab],[IsLongDistance])
       VALUES (@oid,@od,@arc,@arn,@dz,@pt,@wt,@len,@wid,@hgt,@qty,@dl,@pri,N'รอมอบหมาย',N'',@rm,@lat,@lng,@itd,@pd,@hiab,@ld)`,
      { oid:orderId, od:p.orderDate||getTodayStr(), arc:(p.arcode||'').toUpperCase(),
        arn:p.arname||'', dz:p.deliveryZone||'', pt:p.productType||'',
        wt:parseFloat(p.weightKg)||0, len:parseFloat(p.lengthM)||0,
        wid:parseFloat(p.widthM)||0, hgt:parseFloat(p.heightM)||0,
        qty:parseFloat(p.quantityPieces)||0, dl:p.deadlineDate||'',
        pri:parseInt(p.priority)||2, rm:p.remark||'',
        lat:parseFloat(p.lat)||null, lng:parseFloat(p.lng)||null,
        itd:p.itemsDetail||'', pd:p.planDate||'',
        hiab:p.requiresHiab?1:0, ld:p.isLongDistance?1:0 }
    );
    return res.json({ success: true, orderId, message: 'สร้าง Order สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/orders/update
router.post('/update', async (req, res) => {
  try {
    const { orderId, ...p } = req.body;
    await execute(
      `UPDATE dbo.DeliveryOrders SET [Arcode]=@arc,[Arname]=@arn,[DeliveryZone]=@dz,[ProductType]=@pt,
       [WeightKg]=@wt,[LengthM]=@len,[WidthM]=@wid,[HeightM]=@hgt,[QuantityPieces]=@qty,
       [DeadlineDate]=@dl,[Priority]=@pri,[Remark]=@rm,[Lat]=@lat,[Lng]=@lng,
       [ItemsDetail]=@itd,[PlanDate]=@pd,[RequiresHiab]=@hiab,[IsLongDistance]=@ld
       WHERE [OrderID]=@oid`,
      { oid:orderId, arc:(p.arcode||'').toUpperCase(), arn:p.arname||'',
        dz:p.deliveryZone||'', pt:p.productType||'',
        wt:parseFloat(p.weightKg)||0, len:parseFloat(p.lengthM)||0,
        wid:parseFloat(p.widthM)||0, hgt:parseFloat(p.heightM)||0,
        qty:parseFloat(p.quantityPieces)||0, dl:p.deadlineDate||'',
        pri:parseInt(p.priority)||2, rm:p.remark||'',
        lat:parseFloat(p.lat)||null, lng:parseFloat(p.lng)||null,
        itd:p.itemsDetail||'', pd:p.planDate||'',
        hiab:p.requiresHiab?1:0, ld:p.isLongDistance?1:0 }
    );
    return res.json({ success: true, message: 'อัปเดต Order สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/orders/cancel
router.post('/cancel', async (req, res) => {
  try {
    const { orderId } = req.body;
    await execute("UPDATE dbo.DeliveryOrders SET [Status]=N'ยกเลิก',[AssignedPlanID]=N'' WHERE [OrderID]=@oid", { oid: orderId });
    return res.json({ success: true, message: 'ยกเลิก Order สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/orders/delete
router.post('/delete', async (req, res) => {
  try {
    await execute('DELETE FROM dbo.DeliveryOrders WHERE [OrderID]=@oid', { oid: req.body.orderId });
    return res.json({ success: true, message: 'ลบ Order สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/orders/bulk
router.post('/bulk', async (req, res) => {
  try {
    const { orders } = req.body;
    let ok = 0, fail = 0;
    for (const p of orders) {
      try {
        const orderId = 'ORD-' + uuidv4().slice(0,8).toUpperCase();
        await execute(
          `INSERT INTO dbo.DeliveryOrders ([OrderID],[OrderDate],[Arcode],[Arname],[DeliveryZone],[ProductType],
           [WeightKg],[LengthM],[WidthM],[HeightM],[QuantityPieces],[DeadlineDate],[Priority],[Status],
           [AssignedPlanID],[Remark],[Lat],[Lng],[ItemsDetail],[PlanDate],[RequiresHiab],[IsLongDistance])
           VALUES (@oid,@od,@arc,@arn,@dz,@pt,@wt,@len,@wid,@hgt,@qty,@dl,@pri,N'รอมอบหมาย',N'',@rm,@lat,@lng,@itd,@pd,@hiab,@ld)`,
          { oid:orderId, od:p.orderDate||getTodayStr(), arc:(p.arcode||'').toUpperCase(),
            arn:p.arname||'', dz:p.deliveryZone||'', pt:p.productType||'',
            wt:parseFloat(p.weightKg)||0, len:parseFloat(p.lengthM)||0,
            wid:parseFloat(p.widthM)||0, hgt:parseFloat(p.heightM)||0,
            qty:parseFloat(p.quantityPieces)||0, dl:p.deadlineDate||'',
            pri:parseInt(p.priority)||2, rm:p.remark||'',
            lat:parseFloat(p.lat)||null, lng:parseFloat(p.lng)||null,
            itd:p.itemsDetail||'', pd:p.planDate||'',
            hiab:p.requiresHiab?1:0, ld:p.isLongDistance?1:0 }
        );
        ok++;
      } catch { fail++; }
    }
    return res.json({ success: true, successCount: ok, failCount: fail, message: `นำเข้า ${ok} รายการสำเร็จ` });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

module.exports = router;
