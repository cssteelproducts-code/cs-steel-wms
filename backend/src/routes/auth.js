const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

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
               r.RoleName, w.WarehouseName
        FROM WMS_Users u
        LEFT JOIN WMS_Roles r ON u.RoleID = r.RoleID
        LEFT JOIN WMS_Warehouses w ON u.WarehouseID = w.WarehouseID
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

    // Update last login
    await pool.request()
      .input('UserID', sql.Int, user.UserID)
      .query('UPDATE WMS_Users SET LastLogin = GETDATE() WHERE UserID = @UserID');

    // Get menu permissions
    const perms = await pool.request()
      .input('RoleID', sql.Int, user.RoleID)
      .query(`
        SELECT MenuCode, CanView, CanCreate, CanEdit, CanDelete
        FROM WMS_MenuPermissions
        WHERE RoleID = @RoleID AND CanView = 1
      `);

    const permissions = {};
    perms.recordset.forEach(p => {
      permissions[p.MenuCode] = {
        canView: p.CanView,
        canCreate: p.CanCreate,
        canEdit: p.CanEdit,
        canDelete: p.CanDelete
      };
    });

    const token = jwt.sign(
      { userId: user.UserID, username: user.Username, roleId: user.RoleID },
      process.env.JWT_SECRET || 'cs_steel_wms_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
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
    const perms = await pool.request()
      .input('RoleID', sql.Int, req.user.RoleID)
      .query(`
        SELECT MenuCode, CanView, CanCreate, CanEdit, CanDelete
        FROM WMS_MenuPermissions
        WHERE RoleID = @RoleID AND CanView = 1
      `);

    const permissions = {};
    perms.recordset.forEach(p => {
      permissions[p.MenuCode] = {
        canView: p.CanView,
        canCreate: p.CanCreate,
        canEdit: p.CanEdit,
        canDelete: p.CanDelete
      };
    });

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
      .query('SELECT Password FROM WMS_Users WHERE UserID = @UserID');

    const match = await bcrypt.compare(currentPassword, userResult.recordset[0].Password);
    if (!match) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.request()
      .input('UserID', sql.Int, req.user.UserID)
      .input('Password', sql.NVarChar, hashed)
      .query('UPDATE WMS_Users SET Password = @Password WHERE UserID = @UserID');

    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
