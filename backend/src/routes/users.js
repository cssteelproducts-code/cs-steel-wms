const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/users - List all users
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT u.UserID, u.Username, u.FullName, u.Email, u.IsActive, u.CreatedAt, u.LastLogin,
             u.SessionDurationHours,
             r.RoleName, r.RoleID,
             w.WarehouseName, w.WarehouseID
      FROM WMS_Users u
      LEFT JOIN WMS_Roles r ON u.RoleID = r.RoleID
      LEFT JOIN WMS_Warehouses w ON u.WarehouseID = w.WarehouseID
      ORDER BY u.CreatedAt DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users - Create user
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, password, fullName, email, roleId, warehouseId, sessionDurationHours } = req.body;

    if (!username || !password || !fullName || !roleId) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    }

    const pool = getPool();

    const existing = await pool.request()
      .input('Username', sql.NVarChar, username)
      .query('SELECT UserID FROM WMS_Users WHERE Username = @Username');

    if (existing.recordset.length > 0) {
      return res.status(400).json({ success: false, message: 'Username นี้มีในระบบแล้ว' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const sessionHours = sessionDurationHours ? parseInt(sessionDurationHours) : null;
    await pool.request()
      .input('Username', sql.NVarChar, username)
      .input('Password', sql.NVarChar, hashed)
      .input('FullName', sql.NVarChar, fullName)
      .input('Email', sql.NVarChar, email || '')
      .input('RoleID', sql.Int, roleId)
      .input('WarehouseID', sql.Int, warehouseId || null)
      .input('SessionDurationHours', sql.Int, sessionHours)
      .query(`INSERT INTO WMS_Users (Username, Password, FullName, Email, RoleID, WarehouseID, SessionDurationHours)
              VALUES (@Username, @Password, @FullName, @Email, @RoleID, @WarehouseID, @SessionDurationHours)`);

    res.json({ success: true, message: `สร้างผู้ใช้ "${username}" สำเร็จ` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { fullName, email, roleId, warehouseId, isActive, password, sessionDurationHours } = req.body;
    const pool = getPool();

    const sessionHours = sessionDurationHours ? parseInt(sessionDurationHours) : null;
    let updateQuery = `UPDATE WMS_Users SET FullName=@FullName, Email=@Email,
                       RoleID=@RoleID, WarehouseID=@WarehouseID, IsActive=@IsActive,
                       SessionDurationHours=@SessionDurationHours`;
    const request = pool.request()
      .input('UserID', sql.Int, req.params.id)
      .input('FullName', sql.NVarChar, fullName)
      .input('Email', sql.NVarChar, email || '')
      .input('RoleID', sql.Int, roleId)
      .input('WarehouseID', sql.Int, warehouseId || null)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .input('SessionDurationHours', sql.Int, sessionHours);

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      updateQuery += ', Password=@Password';
      request.input('Password', sql.NVarChar, hashed);
    }

    updateQuery += ' WHERE UserID=@UserID';
    await request.query(updateQuery);

    res.json({ success: true, message: 'แก้ไขผู้ใช้สำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/:id - Deactivate user
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('UserID', sql.Int, req.params.id)
      .query('UPDATE WMS_Users SET IsActive = 0 WHERE UserID = @UserID');
    res.json({ success: true, message: 'ระงับการใช้งานผู้ใช้สำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/roles - List roles
router.get('/roles', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query('SELECT * FROM WMS_Roles WHERE IsActive=1 ORDER BY SortOrder ASC, RoleName');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/roles', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleName, description, sortOrder } = req.body;
    if (!roleName) return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อบทบาท' });
    const pool = getPool();
    const exists = await pool.request()
      .input('RoleName', sql.NVarChar, roleName)
      .query('SELECT RoleID, IsActive FROM WMS_Roles WHERE RoleName=@RoleName');
    if (exists.recordset.length > 0) {
      const row = exists.recordset[0];
      if (row.IsActive) return res.status(400).json({ success: false, message: 'มีบทบาทนี้อยู่แล้ว' });
      await pool.request()
        .input('RoleID', sql.Int, row.RoleID)
        .input('Description', sql.NVarChar, description || '')
        .input('SortOrder', sql.Int, sortOrder || 0)
        .query('UPDATE WMS_Roles SET IsActive=1, Description=@Description, SortOrder=@SortOrder WHERE RoleID=@RoleID');
      return res.json({ success: true, message: 'เพิ่มบทบาทสำเร็จ' });
    }
    await pool.request()
      .input('RoleName', sql.NVarChar, roleName)
      .input('Description', sql.NVarChar, description || '')
      .input('SortOrder', sql.Int, sortOrder || 0)
      .query('INSERT INTO WMS_Roles (RoleName, Description, SortOrder) VALUES (@RoleName, @Description, @SortOrder)');
    res.json({ success: true, message: 'เพิ่มบทบาทสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/roles/:roleId
router.put('/roles/:roleId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleName, description, sortOrder } = req.body;
    if (!roleName) return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อบทบาท' });
    const pool = getPool();
    await pool.request()
      .input('RoleID', sql.Int, req.params.roleId)
      .input('RoleName', sql.NVarChar, roleName)
      .input('Description', sql.NVarChar, description || '')
      .input('SortOrder', sql.Int, sortOrder || 0)
      .query('UPDATE WMS_Roles SET RoleName=@RoleName, Description=@Description, SortOrder=@SortOrder WHERE RoleID=@RoleID');
    res.json({ success: true, message: 'แก้ไขบทบาทสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/roles/:roleId
router.delete('/roles/:roleId', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const inUse = await pool.request()
      .input('RoleID', sql.Int, req.params.roleId)
      .query('SELECT COUNT(1) AS cnt FROM WMS_Users WHERE RoleID=@RoleID AND IsActive=1');
    if (inUse.recordset[0].cnt > 0)
      return res.status(400).json({ success: false, message: 'ไม่สามารถลบได้ — มีผู้ใช้ที่ใช้บทบาทนี้อยู่' });
    await pool.request()
      .input('RoleID', sql.Int, req.params.roleId)
      .query('UPDATE WMS_Roles SET IsActive=0 WHERE RoleID=@RoleID');
    res.json({ success: true, message: 'ลบบทบาทสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/permissions/:roleId
router.get('/permissions/:roleId', authenticate, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('RoleID', sql.Int, req.params.roleId)
      .query(`SELECT * FROM WMS_MenuPermissions WHERE RoleID = @RoleID ORDER BY MenuCode`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users/permissions - Set permissions for a role
router.post('/permissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId, permissions } = req.body;
    // permissions = [{ menuCode, menuName, canView, canCreate, canEdit, canDelete }]
    const pool = getPool();

    for (const perm of permissions) {
      const existing = await pool.request()
        .input('RoleID', sql.Int, roleId)
        .input('MenuCode', sql.NVarChar, perm.menuCode)
        .query('SELECT PermissionID FROM WMS_MenuPermissions WHERE RoleID=@RoleID AND MenuCode=@MenuCode');

      if (existing.recordset.length > 0) {
        await pool.request()
          .input('RoleID', sql.Int, roleId)
          .input('MenuCode', sql.NVarChar, perm.menuCode)
          .input('CanView', sql.Bit, perm.canView ? 1 : 0)
          .input('CanCreate', sql.Bit, perm.canCreate ? 1 : 0)
          .input('CanEdit', sql.Bit, perm.canEdit ? 1 : 0)
          .input('CanDelete', sql.Bit, perm.canDelete ? 1 : 0)
          .query(`UPDATE WMS_MenuPermissions SET CanView=@CanView, CanCreate=@CanCreate,
                  CanEdit=@CanEdit, CanDelete=@CanDelete
                  WHERE RoleID=@RoleID AND MenuCode=@MenuCode`);
      } else {
        await pool.request()
          .input('RoleID', sql.Int, roleId)
          .input('MenuCode', sql.NVarChar, perm.menuCode)
          .input('MenuName', sql.NVarChar, perm.menuName || '')
          .input('CanView', sql.Bit, perm.canView ? 1 : 0)
          .input('CanCreate', sql.Bit, perm.canCreate ? 1 : 0)
          .input('CanEdit', sql.Bit, perm.canEdit ? 1 : 0)
          .input('CanDelete', sql.Bit, perm.canDelete ? 1 : 0)
          .query(`INSERT INTO WMS_MenuPermissions (RoleID, MenuCode, MenuName, CanView, CanCreate, CanEdit, CanDelete)
                  VALUES (@RoleID, @MenuCode, @MenuName, @CanView, @CanCreate, @CanEdit, @CanDelete)`);
      }
    }

    res.json({ success: true, message: 'บันทึกสิทธิ์การใช้งานสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
