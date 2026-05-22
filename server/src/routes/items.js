const router = require('express').Router();
const { query, execute } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

function rowToItem(r) {
  return {
    itemCode:       r.ItemCode       || '',
    itemName:       r.ItemName       || '',
    weightKgPerUnit:parseFloat(r.WeightKgPerUnit) || 0,
    lengthM:        parseFloat(r.LengthM)         || 0,
    widthM:         parseFloat(r.WidthM)          || 0,
    heightM:        parseFloat(r.HeightM)         || 0,
    productType:    r.ProductType    || '',
    remark:         r.Remark         || '',
    weightPerPiece: parseFloat(r.WeightPerPiece)  || 0,
    piecesPerBundle:parseFloat(r.PiecesPerBundle) || 0,
  };
}

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.Items ORDER BY [ItemCode]');
    return res.json({ success: true, items: rows.map(rowToItem) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.get('/:code', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.Items WHERE [ItemCode]=@c', { c: req.params.code });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบสินค้า' });
    return res.json({ success: true, item: rowToItem(rows[0]) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/add', async (req, res) => {
  try {
    const p = req.body;
    const code = (p.itemCode || '').toUpperCase();
    if (!code) return res.json({ success: false, message: 'ระบุรหัสสินค้า' });
    await execute(
      `INSERT INTO dbo.Items ([ItemCode],[ItemName],[WeightKgPerUnit],[LengthM],[WidthM],[HeightM],
       [ProductType],[Remark],[WeightPerPiece],[PiecesPerBundle])
       VALUES (@c,@nm,@wt,@len,@wid,@hgt,@pt,@rm,@wp,@pb)`,
      { c:code, nm:p.itemName||'', wt:parseFloat(p.weightKgPerUnit)||0,
        len:parseFloat(p.lengthM)||0, wid:parseFloat(p.widthM)||0, hgt:parseFloat(p.heightM)||0,
        pt:p.productType||'', rm:p.remark||'',
        wp:parseFloat(p.weightPerPiece)||0, pb:parseFloat(p.piecesPerBundle)||0 }
    );
    return res.json({ success: true, itemCode: code, message: 'เพิ่มสินค้าสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/update', async (req, res) => {
  try {
    const { itemCode, ...p } = req.body;
    await execute(
      `UPDATE dbo.Items SET [ItemName]=@nm,[WeightKgPerUnit]=@wt,[LengthM]=@len,[WidthM]=@wid,
       [HeightM]=@hgt,[ProductType]=@pt,[Remark]=@rm,[WeightPerPiece]=@wp,[PiecesPerBundle]=@pb
       WHERE [ItemCode]=@c`,
      { c:(itemCode||'').toUpperCase(), nm:p.itemName||'',
        wt:parseFloat(p.weightKgPerUnit)||0, len:parseFloat(p.lengthM)||0,
        wid:parseFloat(p.widthM)||0, hgt:parseFloat(p.heightM)||0,
        pt:p.productType||'', rm:p.remark||'',
        wp:parseFloat(p.weightPerPiece)||0, pb:parseFloat(p.piecesPerBundle)||0 }
    );
    return res.json({ success: true, message: 'อัปเดตสินค้าสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/delete', async (req, res) => {
  try {
    await execute('DELETE FROM dbo.Items WHERE [ItemCode]=@c', { c: (req.body.itemCode||'').toUpperCase() });
    return res.json({ success: true, message: 'ลบสินค้าสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

module.exports = router;
