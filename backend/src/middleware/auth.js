const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');

// Cache user lookups by token — eliminates a DB round-trip on every API call.
// 30s TTL: user info is stable; if a user is deactivated it takes effect within 30s.
const _authCache = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _authCache.entries()) if (v.exp < now) _authCache.delete(k);
}, 60000);

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cs_steel_wms_secret');

    const hit = _authCache.get(token);
    if (hit && Date.now() < hit.exp) {
      req.user = hit.user;
      return next();
    }

    const pool = getPool();
    const result = await pool.request()
      .input('UserID', sql.Int, decoded.userId)
      .query(`
        SELECT u.UserID, u.Username, u.FullName, u.RoleID, u.WarehouseID, u.IsActive,
               r.RoleName
        FROM WMS_Users u WITH (NOLOCK)
        LEFT JOIN WMS_Roles r WITH (NOLOCK) ON u.RoleID = r.RoleID
        WHERE u.UserID = @UserID AND u.IsActive = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'ไม่พบผู้ใช้งาน หรือถูกระงับการใช้งาน' });
    }

    const user = result.recordset[0];
    _authCache.set(token, { user, exp: Date.now() + 30000 });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
    // JWT errors (invalid signature, malformed, etc.) → 401
    if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
      return res.status(401).json({ success: false, message: 'Token ไม่ถูกต้อง' });
    }
    // Any other error (DB not connected yet, network, etc.) → 503 so the client
    // does NOT clear the token and redirect to Login — it just shows an error.
    console.error('Auth middleware error:', err.message);
    return res.status(503).json({ success: false, message: 'ระบบไม่พร้อม กรุณารอสักครู่แล้วลองใหม่' });
  }
};

const requireAdmin = async (req, res, next) => {
  if (req.user.RoleName === 'Admin') return next();
  try {
    const result = await getPool().request()
      .input('RoleID', sql.Int, req.user.RoleID)
      .query(`SELECT 1 FROM WMS_MenuPermissions WITH (NOLOCK)
              WHERE RoleID = @RoleID AND MenuCode = 'USERS' AND CanView = 1`);
    if (result.recordset.length > 0) return next();
  } catch {}
  return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ดำเนินการนี้' });
};

module.exports = { authenticate, requireAdmin };
