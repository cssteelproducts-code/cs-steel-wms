const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// TTL cache for frequently-read, rarely-changing data
const _c = new Map();
const cGet = k => { const e = _c.get(k); return (e && Date.now() < e.exp) ? e.v : null; };
const cSet = (k, v, ms) => _c.set(k, { v, exp: Date.now() + ms });
const cDel = (...keys) => keys.forEach(k => _c.delete(k));

// GET /api/users - List all users
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const hit = cGet('users:list');
  if (hit) return res.json({ success: true, data: hit });
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT u.UserID, u.Username, u.FullName, u.Email, u.IsActive, u.CreatedAt, u.LastLogin,
             u.SessionDurationHours, u.UserLevel,
             r.RoleName, r.RoleID,
             w.WarehouseName, w.WarehouseID
      FROM WMS_Users u WITH (NOLOCK)
      LEFT JOIN WMS_Roles r WITH (NOLOCK) ON u.RoleID = r.RoleID
      LEFT JOIN WMS_Warehouses w WITH (NOLOCK) ON u.WarehouseID = w.WarehouseID
      ORDER BY u.UserLevel DESC, u.CreatedAt DESC
    `);
    cSet('users:list', result.recordset, 10000);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users - Create user
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, password, fullName, email, roleId, warehouseId, sessionDurationHours, userLevel } = req.body;

    if (!username || !password || !fullName || !roleId) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    }

    const pool = getPool();

    const existing = await pool.request()
      .input('Username', sql.NVarChar, username)
      .query('SELECT UserID FROM WMS_Users WITH (NOLOCK) WHERE Username = @Username');

    if (existing.recordset.length > 0) {
      return res.status(400).json({ success: false, message: 'Username นี้มีในระบบแล้ว' });
    }

    const hashed = await bcrypt.hash(password, 8);
    const sessionHours = sessionDurationHours ? parseInt(sessionDurationHours) : null;
    await pool.request()
      .input('Username', sql.NVarChar, username)
      .input('Password', sql.NVarChar, hashed)
      .input('FullName', sql.NVarChar, fullName)
      .input('Email', sql.NVarChar, email || '')
      .input('RoleID', sql.Int, roleId)
      .input('WarehouseID', sql.Int, warehouseId || null)
      .input('SessionDurationHours', sql.Int, sessionHours)
      .input('UserLevel', sql.Int, userLevel ? parseInt(userLevel) : 0)
      .query(`INSERT INTO WMS_Users (Username, Password, FullName, Email, RoleID, WarehouseID, SessionDurationHours, UserLevel)
              VALUES (@Username, @Password, @FullName, @Email, @RoleID, @WarehouseID, @SessionDurationHours, @UserLevel)`);

    cDel('users:list');
    res.json({ success: true, message: `สร้างผู้ใช้ "${username}" สำเร็จ` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { fullName, email, roleId, warehouseId, isActive, password, sessionDurationHours, userLevel } = req.body;
    const pool = getPool();

    const sessionHours = sessionDurationHours ? parseInt(sessionDurationHours) : null;
    let updateQuery = `UPDATE WMS_Users SET FullName=@FullName, Email=@Email,
                       RoleID=@RoleID, WarehouseID=@WarehouseID, IsActive=@IsActive,
                       SessionDurationHours=@SessionDurationHours, UserLevel=@UserLevel`;
    const request = pool.request()
      .input('UserID', sql.Int, req.params.id)
      .input('FullName', sql.NVarChar, fullName)
      .input('Email', sql.NVarChar, email || '')
      .input('RoleID', sql.Int, roleId)
      .input('WarehouseID', sql.Int, warehouseId || null)
      .input('IsActive', sql.Bit, isActive !== undefined ? isActive : 1)
      .input('SessionDurationHours', sql.Int, sessionHours)
      .input('UserLevel', sql.Int, userLevel ? parseInt(userLevel) : 0);

    if (password) {
      const hashed = await bcrypt.hash(password, 8);
      updateQuery += ', Password=@Password';
      request.input('Password', sql.NVarChar, hashed);
    }

    updateQuery += ' WHERE UserID=@UserID';
    await request.query(updateQuery);

    cDel('users:list');
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
    cDel('users:list');
    res.json({ success: true, message: 'ระงับการใช้งานผู้ใช้สำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/roles - List roles
router.get('/roles', authenticate, async (req, res) => {
  const hit = cGet('users:roles');
  if (hit) return res.json({ success: true, data: hit });
  try {
    const pool = getPool();
    const result = await pool.request()
      .query('SELECT * FROM WMS_Roles WITH (NOLOCK) WHERE IsActive=1 ORDER BY SortOrder ASC, RoleName');
    cSet('users:roles', result.recordset, 30000);
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
      .query('SELECT RoleID, IsActive FROM WMS_Roles WITH (NOLOCK) WHERE RoleName=@RoleName');
    if (exists.recordset.length > 0) {
      const row = exists.recordset[0];
      if (row.IsActive) return res.status(400).json({ success: false, message: 'มีบทบาทนี้อยู่แล้ว' });
      await pool.request()
        .input('RoleID', sql.Int, row.RoleID)
        .input('Description', sql.NVarChar, description || '')
        .input('SortOrder', sql.Int, sortOrder || 0)
        .query('UPDATE WMS_Roles SET IsActive=1, Description=@Description, SortOrder=@SortOrder WHERE RoleID=@RoleID');
      cDel('users:roles');
      return res.json({ success: true, message: 'เพิ่มบทบาทสำเร็จ' });
    }
    await pool.request()
      .input('RoleName', sql.NVarChar, roleName)
      .input('Description', sql.NVarChar, description || '')
      .input('SortOrder', sql.Int, sortOrder || 0)
      .query('INSERT INTO WMS_Roles (RoleName, Description, SortOrder) VALUES (@RoleName, @Description, @SortOrder)');
    cDel('users:roles');
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
    cDel('users:roles');
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
      .query('SELECT COUNT(1) AS cnt FROM WMS_Users WITH (NOLOCK) WHERE RoleID=@RoleID AND IsActive=1');
    if (inUse.recordset[0].cnt > 0)
      return res.status(400).json({ success: false, message: 'ไม่สามารถลบได้ — มีผู้ใช้ที่ใช้บทบาทนี้อยู่' });
    await pool.request()
      .input('RoleID', sql.Int, req.params.roleId)
      .query('UPDATE WMS_Roles SET IsActive=0 WHERE RoleID=@RoleID');
    cDel('users:roles');
    res.json({ success: true, message: 'ลบบทบาทสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/permissions/:roleId
router.get('/permissions/:roleId', authenticate, requireAdmin, async (req, res) => {
  const key = `users:perms:${req.params.roleId}`;
  const hit = cGet(key);
  if (hit) return res.json({ success: true, data: hit });
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('RoleID', sql.Int, req.params.roleId)
      .query(`SELECT * FROM WMS_MenuPermissions WITH (NOLOCK) WHERE RoleID = @RoleID ORDER BY MenuCode`);
    cSet(key, result.recordset, 15000);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users/permissions - DELETE + INSERT in a single batch (one round-trip)
router.post('/permissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId, permissions } = req.body;
    const pool = getPool();
    const rid = parseInt(roleId);
    const esc = s => String(s || '').replace(/'/g, "''");

    let batch = `DELETE FROM WMS_MenuPermissions WHERE RoleID=${rid};`;
    if (permissions && permissions.length > 0) {
      const vals = permissions.map(p =>
        `(${rid},N'${esc(p.menuCode)}',N'${esc(p.menuName)}',${p.canView?1:0},${p.canCreate?1:0},${p.canEdit?1:0},${p.canDelete?1:0})`
      );
      batch += `INSERT INTO WMS_MenuPermissions (RoleID,MenuCode,MenuName,CanView,CanCreate,CanEdit,CanDelete) VALUES ${vals.join(',')};`;
    }

    await pool.request().query(batch);
    cDel(`users:perms:${rid}`);
    res.json({ success: true, message: 'บันทึกสิทธิ์การใช้งานสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
