const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cs_steel_wms_secret');

    const pool = getPool();
    const result = await pool.request()
      .input('UserID', sql.Int, decoded.userId)
      .query(`
        SELECT u.UserID, u.Username, u.FullName, u.RoleID, u.WarehouseID, u.IsActive,
               r.RoleName
        FROM WMS_Users u
        LEFT JOIN WMS_Roles r ON u.RoleID = r.RoleID
        WHERE u.UserID = @UserID AND u.IsActive = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'ไม่พบผู้ใช้งาน หรือถูกระงับการใช้งาน' });
    }

    req.user = result.recordset[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
    return res.status(401).json({ success: false, message: 'Token ไม่ถูกต้อง' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.RoleName !== 'Admin') {
    return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ดำเนินการ (Admin เท่านั้น)' });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
