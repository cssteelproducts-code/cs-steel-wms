const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// Permissions cache by roleId — 60s TTL (matches auth middleware cache window)
const _permsCache = new Map();
const permsGet = k => { const e = _permsCache.get(k); return (e && Date.now() < e.exp) ? e.v : null; };
const permsSet = (k, v) => _permsCache.set(k, { v, exp: Date.now() + 60000 });

async function fetchPermissions(pool, roleId) {
  const key = `p:${roleId}`;
  const hit = permsGet(key);
  if (hit) return hit;
  const result = await pool.request()
    .input('RoleID', sql.Int, roleId)
    .query(`SELECT MenuCode, CanView, CanCreate, CanEdit, CanDelete
            FROM WMS_MenuPermissions WITH (NOLOCK)
            WHERE RoleID = @RoleID AND CanView = 1`);
  const perms = {};
  result.recordset.forEach(p => {
    perms[p.MenuCode] = {
      canView: p.CanView, canCreate: p.CanCreate,
      canEdit: p.CanEdit, canDelete: p.CanDelete
    };
  });
  permsSet(key, perms);
  return perms;
}

// Called from users.js after saving permissions to a role
const clearPermsCache = (roleId) => _permsCache.delete(`p:${roleId}`);

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก Username และ Password' });
    }

    const pool = getPool();
    const result = await pool.request()
      .input('Username', sql.NVarChar, username)
      .query(`
        SELECT u.UserID, u.Username, u.Password, u.FullName, u.RoleID, u.WarehouseID, u.IsActive,
               u.SessionDurationHours, r.RoleName, w.WarehouseName
        FROM WMS_Users u WITH (NOLOCK)
        LEFT JOIN WMS_Roles r      WITH (NOLOCK) ON u.RoleID      = r.RoleID
        LEFT JOIN WMS_Warehouses w WITH (NOLOCK) ON u.WarehouseID = w.WarehouseID
        WHERE u.Username = @Username
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }

    const user = result.recordset[0];
    if (!user.IsActive) {
      return res.status(401).json({ success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน' });
    }

    const passwordMatch = await bcrypt.compare(password, user.Password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }

    // Run LastLogin update + permissions fetch in parallel (independent after bcrypt passes)
    const [permissions] = await Promise.all([
      fetchPermissions(pool, user.RoleID),
      pool.request()
        .input('UserID', sql.Int, user.UserID)
        .query('UPDATE WMS_Users SET LastLogin = GETDATE() WHERE UserID = @UserID')
    ]);

    const sessionHours = user.SessionDurationHours || parseInt(process.env.JWT_EXPIRES_HOURS || '24');
    const token = jwt.sign(
      { userId: user.UserID, username: user.Username, roleId: user.RoleID },
      process.env.JWT_SECRET || 'cs_steel_wms_secret',
      { expiresIn: `${sessionHours}h` }
    );

    res.json({
      success: true,
      token,
      user: {
        userId: user.UserID,
        username: user.Username,
        fullName: user.FullName,
        roleName: user.RoleName,
        warehouseId: user.WarehouseID,
        warehouseName: user.WarehouseName
      },
      permissions
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const permissions = await fetchPermissions(pool, req.user.RoleID);
    res.json({
      success: true,
      user: {
        userId: req.user.UserID,
        username: req.user.Username,
        fullName: req.user.FullName,
        roleName: req.user.RoleName,
        warehouseId: req.user.WarehouseID
      },
      permissions
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const pool = getPool();

    const userResult = await pool.request()
      .input('UserID', sql.Int, req.user.UserID)
      .query('SELECT Password FROM WMS_Users WITH (NOLOCK) WHERE UserID = @UserID');

    const match = await bcrypt.compare(currentPassword, userResult.recordset[0].Password);
    if (!match) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }

    const hashed = await bcrypt.hash(newPassword, 8);
    await pool.request()
      .input('UserID', sql.Int, req.user.UserID)
      .input('Password', sql.NVarChar, hashed)
      .query('UPDATE WMS_Users SET Password = @Password WHERE UserID = @UserID');

    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/reset-password — self-service, no token required
router.post('/reset-password', async (req, res) => {
  try {
    const { username, fullName, newPassword } = req.body;
    if (!username || !fullName || !newPassword) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    const pool = getPool();
    const result = await pool.request()
      .input('Username', sql.NVarChar, username.trim())
      .query('SELECT UserID, FullName, IsActive FROM WMS_Users WITH (NOLOCK) WHERE Username = @Username');

    if (result.recordset.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่พบ Username ในระบบ' });
    }

    const user = result.recordset[0];
    if (!user.IsActive) {
      return res.status(400).json({ success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน' });
    }

    const nameMatch = user.FullName.trim().toLowerCase() === fullName.trim().toLowerCase();
    if (!nameMatch) {
      return res.status(400).json({ success: false, message: 'ชื่อ-นามสกุลไม่ตรงกับที่ลงทะเบียนไว้' });
    }

    const hashed = await bcrypt.hash(newPassword, 8);
    await pool.request()
      .input('UserID', sql.Int, user.UserID)
      .input('Password', sql.NVarChar, hashed)
      .query('UPDATE WMS_Users SET Password = @Password WHERE UserID = @UserID');

    res.json({ success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

module.exports = router;
module.exports.clearPermsCache = clearPermsCache;
