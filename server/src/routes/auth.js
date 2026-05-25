// แทน Auth.gs — login, logout, user management
// หมายเหตุ: password ยังใช้ SHA-256+salt เหมือนเดิม เพื่อให้ login ด้วย password เดิมได้
//           ถ้าต้องการ migrate เป็น bcrypt ให้ reset password หลัง deploy
const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { query, execute } = require('../db/connection');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { getRoleAccess, DEFAULT_ROLE_ACCESS } = require('./utils');

const ROLES_ADMIN = ['manager', 'dept_head'];

async function _getAppConfigForLogin() {
  const [raRows, mmRows] = await Promise.all([
    query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'ROLE_ACCESS'").catch(() => []),
    query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'MENU_MAINTENANCE'").catch(() => []),
  ]);
  const parseVal = (rows, def) => {
    if (!rows.length || !rows[0].Value) return def;
    try { return JSON.parse(rows[0].Value); } catch { return def; }
  };
  return {
    roleAccess:      parseVal(raRows,  DEFAULT_ROLE_ACCESS),
    menuMaintenance: parseVal(mmRows,  {}),
    customRoles:     [],
  };
}

function hashPassword(password) {
  const salt = process.env.PASSWORD_SALT || '';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.json({ success: false, message: 'กรุณากรอก username และ password' });

    const rows = await query(
      'SELECT * FROM dbo.Users WHERE [Username] = @u',
      { u: username.trim() }
    );
    if (!rows.length)
      return res.json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', code: 'INVALID_CREDENTIALS' });

    const user   = rows[0];
    const hashed = hashPassword(password);
    if ((user.Password || '').trim() !== hashed)
      return res.json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', code: 'INVALID_CREDENTIALS' });

    const sessionHours = parseFloat(user.SessionHours) || 8;
    const token = jwt.sign(
      { username: user.Username, role: user.Role, displayName: user.DisplayName },
      process.env.JWT_SECRET,
      { expiresIn: `${sessionHours}h` }
    );
    const [cfg, dbRows] = await Promise.all([
      _getAppConfigForLogin().catch(() => ({ roleAccess: DEFAULT_ROLE_ACCESS, menuMaintenance: {}, customRoles: [] })),
      query(
        "SELECT CAST(SUM(CAST(size AS BIGINT))*8.0/1024 AS DECIMAL(10,2)) AS total_mb," +
        "CAST(SUM(CAST(FILEPROPERTY(name,N'SpaceUsed') AS BIGINT))*8.0/1024 AS DECIMAL(10,2)) AS used_mb " +
        "FROM sys.database_files WHERE type_desc=N'ROWS'"
      ).catch(() => []),
    ]);
    const _totalMb = dbRows.length ? parseFloat(dbRows[0].total_mb) : 0;
    const _usedMb  = dbRows.length ? parseFloat(dbRows[0].used_mb)  : 0;
    return res.json({
      success:         true,
      token,
      role:            user.Role,
      displayName:     user.DisplayName,
      sessionHours,
      roleAccess:      cfg.roleAccess,
      menuMaintenance: cfg.menuMaintenance,
      customRoles:     cfg.customRoles,
      dbInfo: {
        db:      process.env.MSSQL_DB     || '',
        server:  process.env.MSSQL_SERVER || '',
        totalMb: _totalMb,
        usedMb:  _usedMb,
        freeMb:  Math.max(0, _totalMb - _usedMb),
      },
    });
  } catch (e) {
    return res.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + e.message });
  }
});

// POST /api/auth/logout  (JWT stateless — client ลบ token เอง; endpoint นี้เพื่อ compat)
router.post('/logout', (req, res) => res.json({ success: true }));

// GET /api/auth/users
router.get('/users', authMiddleware, requireRole(ROLES_ADMIN), async (req, res) => {
  try {
    const rows = await query('SELECT [Username],[Role],[DisplayName],[SessionHours] FROM dbo.Users');
    const users = rows.map(r => ({
      username:    r.Username,
      role:        r.Role,
      displayName: r.DisplayName,
      sessionHours: parseFloat(r.SessionHours) || 8,
    }));
    return res.json({ success: true, users });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/auth/users/create
router.post('/users/create', authMiddleware, requireRole(ROLES_ADMIN), async (req, res) => {
  try {
    const { username, password, role, displayName } = req.body;
    if (!username || !password || !role || !displayName)
      return res.json({ success: false, message: 'กรอกข้อมูลให้ครบ' });
    const hashed = hashPassword(password);
    await execute(
      `INSERT INTO dbo.Users ([Username],[Password],[Role],[DisplayName],[Token],[TokenExpiry],[SessionHours])
       VALUES (@u, @pw, @role, @dn, N'', N'', 8)`,
      { u: username, pw: hashed, role, dn: displayName }
    );
    return res.json({ success: true, message: 'สร้างผู้ใช้สำเร็จ' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/auth/users/update
router.post('/users/update', authMiddleware, requireRole(ROLES_ADMIN), async (req, res) => {
  try {
    const { targetUsername, newRole, newDisplayName, sessionHours } = req.body;
    if (!targetUsername || !newRole || !newDisplayName)
      return res.json({ success: false, message: 'กรอกข้อมูลให้ครบ' });
    const sh = parseFloat(sessionHours) || 8;
    await execute(
      'UPDATE dbo.Users SET [Role]=@r,[DisplayName]=@dn,[SessionHours]=@sh WHERE [Username]=@u',
      { r: newRole, dn: newDisplayName, sh, u: targetUsername }
    );
    return res.json({ success: true, message: 'อัปเดตผู้ใช้สำเร็จ' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/auth/users/delete
router.post('/users/delete', authMiddleware, requireRole(ROLES_ADMIN), async (req, res) => {
  try {
    const { targetUsername } = req.body;
    if (!targetUsername) return res.json({ success: false, message: 'ระบุ username ที่ต้องการลบ' });
    if (req.user.username === targetUsername)
      return res.json({ success: false, message: 'ไม่สามารถลบบัญชีตัวเองได้' });
    await execute('DELETE FROM dbo.Users WHERE [Username]=@u', { u: targetUsername });
    return res.json({ success: true, message: 'ลบผู้ใช้สำเร็จ' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const rows = await query('SELECT [Password] FROM dbo.Users WHERE [Username]=@u', { u: req.user.username });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบผู้ใช้' });
    if ((rows[0].Password || '').trim() !== hashPassword(oldPassword))
      return res.json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    await execute('UPDATE dbo.Users SET [Password]=@pw WHERE [Username]=@u',
      { pw: hashPassword(newPassword), u: req.user.username });
    return res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/auth/admin-reset-password  (admin reset โดยไม่ต้องยืนยัน displayName)
router.post('/admin-reset-password', authMiddleware, requireRole(ROLES_ADMIN), async (req, res) => {
  try {
    const { targetUsername, newPassword } = req.body;
    if (!targetUsername || !newPassword)
      return res.json({ success: false, message: 'กรอกข้อมูลให้ครบ' });
    if (newPassword.length < 4)
      return res.json({ success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' });
    const hashed = hashPassword(newPassword);
    await execute(
      "UPDATE dbo.Users SET [Password]=@pw,[Token]=N'',[TokenExpiry]=N'' WHERE [Username]=@u",
      { pw: hashed, u: targetUsername }
    );
    return res.json({ success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/auth/roles/add  (เพิ่ม custom role — ยังไม่ implement เต็ม ให้ return success)
router.post('/roles/add', authMiddleware, requireRole(ROLES_ADMIN), async (req, res) => {
  return res.json({ success: true, message: 'Custom roles ไม่รองรับใน Node.js version นี้' });
});

// POST /api/auth/roles/edit
router.post('/roles/edit', authMiddleware, requireRole(ROLES_ADMIN), async (req, res) => {
  return res.json({ success: true, message: 'Custom roles ไม่รองรับใน Node.js version นี้' });
});

// POST /api/auth/roles/delete
router.post('/roles/delete', authMiddleware, requireRole(ROLES_ADMIN), async (req, res) => {
  return res.json({ success: true, message: 'Custom roles ไม่รองรับใน Node.js version นี้' });
});

// POST /api/auth/reset-password  (self reset ด้วย displayName verify)
router.post('/reset-password', async (req, res) => {
  try {
    const { username, displayName, newPassword } = req.body;
    if (!username || !displayName || !newPassword)
      return res.json({ success: false, message: 'กรอกข้อมูลให้ครบ' });
    if (newPassword.length < 4)
      return res.json({ success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' });
    const rows = await query(
      'SELECT [Username] FROM dbo.Users WHERE [Username]=@u AND [DisplayName]=@dn',
      { u: username.trim(), dn: displayName.trim() }
    );
    if (!rows.length)
      return res.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง ไม่พบผู้ใช้หรือชื่อ-สกุลไม่ตรง', code: 'NOT_FOUND' });
    await execute(
      "UPDATE dbo.Users SET [Password]=@pw,[Token]=N'',[TokenExpiry]=N'' WHERE [Username]=@u",
      { pw: hashPassword(newPassword), u: username.trim() }
    );
    return res.json({ success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

module.exports = router;
