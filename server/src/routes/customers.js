const router = require('express').Router();
const { query, execute } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.Customers ORDER BY [Arcode]');
    return res.json({ success: true, customers: rows.map(r => ({
      arcode:    r.Arcode    || '',
      arname:    r.Arname    || '',
      remark:    r.Remark    || '',
      createdAt: r.CreatedAt || '',
      updatedAt: r.UpdatedAt || '',
    })) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.get('/:arcode', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.Customers WHERE [Arcode]=@c', { c: req.params.arcode });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบลูกค้า' });
    const r = rows[0];
    return res.json({ success: true, customer: { arcode:r.Arcode||'', arname:r.Arname||'', remark:r.Remark||'' } });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/add', async (req, res) => {
  try {
    const p = req.body;
    const now = new Date().toISOString();
    await execute(
      'INSERT INTO dbo.Customers ([Arcode],[Arname],[Remark],[CreatedAt],[UpdatedAt]) VALUES (@c,@n,@r,@ca,@ua)',
      { c:(p.arcode||'').toUpperCase(), n:p.arname||'', r:p.remark||'', ca:now, ua:now }
    );
    return res.json({ success: true, arcode: (p.arcode||'').toUpperCase(), message: 'เพิ่มลูกค้าสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/update', async (req, res) => {
  try {
    const { arcode, arname, remark } = req.body;
    await execute('UPDATE dbo.Customers SET [Arname]=@n,[Remark]=@r,[UpdatedAt]=@ua WHERE [Arcode]=@c',
      { c:(arcode||'').toUpperCase(), n:arname||'', r:remark||'', ua:new Date().toISOString() });
    return res.json({ success: true, message: 'อัปเดตลูกค้าสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/delete', async (req, res) => {
  try {
    await execute('DELETE FROM dbo.Customers WHERE [Arcode]=@c', { c: (req.body.arcode||'').toUpperCase() });
    return res.json({ success: true, message: 'ลบลูกค้าสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

module.exports = router;
