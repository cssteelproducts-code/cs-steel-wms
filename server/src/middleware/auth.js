// JWT verify middleware — แทน validateToken() + requireAuth() ใน Auth.gs
const jwt = require('jsonwebtoken');

// ใช้เป็น middleware: app.use('/api/trucks', authMiddleware, trucksRouter)
function authMiddleware(req, res, next) {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.body?.token;
  if (!token) return res.json({ success: false, message: 'หมดเวลาเข้าสู่ระบบ', code: 'AUTH_EXPIRED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.json({ success: false, message: 'หมดเวลาเข้าสู่ระบบ', code: 'AUTH_EXPIRED' });
  }
}

// ตรวจสิทธิ์ตาม role — แทน requireAuth(token, allowedRoles)
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.json({ success: false, message: 'หมดเวลาเข้าสู่ระบบ', code: 'AUTH_EXPIRED' });
    if (allowedRoles && !allowedRoles.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์ใช้งานฟังก์ชันนี้', code: 'FORBIDDEN' });
    next();
  };
}

module.exports = { authMiddleware, requireRole };
