// แทน Utils.gs — config constants, helper functions, app config endpoints
const router  = require('express').Router();
const { query, execute } = require('../db/connection');
const { authMiddleware, requireRole } = require('../middleware/auth');

// ==================== Constants (แทน ROLES_* ใน Utils.gs) ====================
const ROLES_ADMIN     = ['manager', 'dept_head'];
const ROLES_ALL       = ['manager','dept_head','section_chief','unit_chief','locker_officer',
                         'checker_officer','data_officer','warehouse_admin','sales','weight_officer'];

const DEFAULT_ROLE_ACCESS = {
  checkin:     ['manager','dept_head','section_chief','weight_officer'],
  datastation: ['manager','dept_head','section_chief','data_officer'],
  loading:     ['manager','dept_head','section_chief','unit_chief','locker_officer','checker_officer'],
  checkout:    ['manager','dept_head','section_chief','weight_officer'],
  eta:         ['manager','dept_head','section_chief','unit_chief','checker_officer','warehouse_admin','weight_officer','data_officer'],
  dashboard:   ['manager','dept_head','section_chief','unit_chief','checker_officer','warehouse_admin','sales','weight_officer'],
  stdmonitor:  ['manager','dept_head','section_chief'],
  delivery:    ROLES_ALL,
  trip:        ['manager','dept_head','section_chief'],
  customers:   ['manager','dept_head','section_chief'],
  data:        ROLES_ALL,
  warehouse:   ['manager','dept_head','section_chief','unit_chief'],
  users:       ['manager','dept_head'],
};

const DEFAULT_STD_MINUTES = {
  '4 ล้อ':60,'6 ล้อ':120,'8 ล้อ':120,
  '10 ล้อ':140,'12 ล้อ':160,'เทเลอร์':240,'พ่วง':240,
};

const OVERTIME_CUTOFFS = {
  '4 ล้อ':'16:00','6 ล้อ':'15:30','8 ล้อ':'15:30',
  '10 ล้อ':'15:00','12 ล้อ':'14:00','เทเลอร์':'14:00','พ่วง':'14:00',
};

const TZ = process.env.TZ || 'Asia/Bangkok';

// ==================== Date/Time helpers (แทน formatTime, getTodayStr, etc.) ====================
function formatTime(date) {
  return date.toLocaleTimeString('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
}
function formatDate(date) {
  const d = date.toLocaleDateString('th-TH', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
  // แปลง d/M/YYYY → dd/MM/YYYY
  const [day, mon, yr] = d.split('/');
  return day.padStart(2,'0') + '/' + mon.padStart(2,'0') + '/' + yr;
}
function getTodayStr()  { return formatDate(new Date()); }
function getMonthStr()  {
  const n = new Date();
  return n.toLocaleDateString('th-TH', { timeZone: TZ, month: '2-digit', year: 'numeric' }).replace(' ', '/');
}
function getYearStr()   {
  return new Date().toLocaleDateString('th-TH', { timeZone: TZ, year: 'numeric' });
}

// ==================== Role Access (อ่านจาก DB หรือใช้ default) ====================
let _raCache = null;
let _raCacheExp = 0;

async function getRoleAccess() {
  if (_raCache && Date.now() < _raCacheExp) return _raCache;
  const rows = await query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'ROLE_ACCESS'").catch(() => []);
  let ra = DEFAULT_ROLE_ACCESS;
  if (rows.length && rows[0].Value) {
    try {
      const saved = JSON.parse(rows[0].Value);
      ra = { ...DEFAULT_ROLE_ACCESS, ...saved };
    } catch {}
  }
  _raCache    = ra;
  _raCacheExp = Date.now() + 300_000; // 5 min cache
  return ra;
}

// ==================== Express Routes ====================

// GET /api/utils/db-stats  (public — แสดงที่หน้า Login)
router.get('/db-stats', async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        CAST(SUM(size) * 8.0 / 1024 AS DECIMAL(10,2)) AS TotalMB,
        CAST(SUM(FILEPROPERTY(name, 'SpaceUsed')) * 8.0 / 1024 AS DECIMAL(10,2)) AS UsedMB
      FROM sys.database_files
      WHERE type = 0
    `);
    const total = parseFloat(rows[0]?.TotalMB) || 0;
    const used  = parseFloat(rows[0]?.UsedMB)  || 0;
    const free  = Math.max(0, total - used);
    const pct   = total > 0 ? Math.round((used / total) * 100) : 0;
    return res.json({
      success: true,
      dbName:  process.env.MSSQL_DB   || 'WMS',
      server:  process.env.MSSQL_SERVER|| '',
      totalMB: total,
      usedMB:  used,
      freeMB:  parseFloat(free.toFixed(2)),
      usedPct: pct,
    });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.use(authMiddleware);

// GET /api/utils/config
router.get('/config', async (req, res) => {
  try {
    const [raRows, mmRows, stdRows, logoRows] = await Promise.all([
      query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'ROLE_ACCESS'").catch(() => []),
      query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'MENU_MAINTENANCE'").catch(() => []),
      query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'STD_MINUTES'").catch(() => []),
      query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'LOGO_URL'").catch(() => []),
    ]);
    const parseVal = (rows, def) => {
      if (!rows.length || !rows[0].Value) return def;
      try { return JSON.parse(rows[0].Value); } catch { return def; }
    };
    return res.json({
      success: true,
      roleAccess:      parseVal(raRows,  DEFAULT_ROLE_ACCESS),
      menuMaintenance: parseVal(mmRows,  {}),
      stdMinutes:      parseVal(stdRows, DEFAULT_STD_MINUTES),
      logoUrl:         logoRows.length ? (logoRows[0].Value || '') : '',
      overtimeCutoffs: OVERTIME_CUTOFFS,
    });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/utils/config/role-access
router.post('/config/role-access', requireRole(ROLES_ADMIN), async (req, res) => {
  try {
    const val = JSON.stringify(req.body.roleAccess);
    await _upsertConfig('ROLE_ACCESS', val);
    _raCache = null;
    return res.json({ success: true, message: 'บันทึกสิทธิ์สำเร็จ' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/utils/config/std-minutes
router.post('/config/std-minutes', requireRole(['manager']), async (req, res) => {
  try {
    await _upsertConfig('STD_MINUTES', JSON.stringify(req.body.stdMinutes));
    return res.json({ success: true, message: 'บันทึก STD สำเร็จ' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/utils/config/logo
router.post('/config/logo', requireRole(ROLES_ADMIN), async (req, res) => {
  try {
    await _upsertConfig('LOGO_URL', req.body.logoUrl || '');
    return res.json({ success: true, message: 'อัปเดต Logo สำเร็จ' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/utils/config/menu-maintenance
router.post('/config/menu-maintenance', requireRole(['manager']), async (req, res) => {
  try {
    await _upsertConfig('MENU_MAINTENANCE', JSON.stringify(req.body.maintenanceJson));
    return res.json({ success: true, message: 'บันทึกการตั้งค่าเมนูสำเร็จ' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

async function _upsertConfig(key, value) {
  const existing = await query('SELECT [Key] FROM dbo.AppConfig WHERE [Key]=@k', { k: key }).catch(() => []);
  if (existing.length) {
    await execute('UPDATE dbo.AppConfig SET [Value]=@v,[UpdatedAt]=@ua WHERE [Key]=@k',
      { v: value, ua: new Date().toISOString(), k: key });
  } else {
    await execute('INSERT INTO dbo.AppConfig ([Key],[Value],[UpdatedAt]) VALUES (@k,@v,@ua)',
      { k: key, v: value, ua: new Date().toISOString() });
  }
}

// GET /api/utils/db-info
router.get('/db-info', requireRole(ROLES_ADMIN), async (req, res) => {
  try {
    const rows = await query(
      "SELECT CAST(SUM(CAST(size AS BIGINT))*8.0/1024 AS DECIMAL(10,2)) AS total_mb," +
      "CAST(SUM(CAST(FILEPROPERTY(name,N'SpaceUsed') AS BIGINT))*8.0/1024 AS DECIMAL(10,2)) AS used_mb " +
      "FROM sys.database_files WHERE type_desc=N'ROWS'"
    );
    const totalMb = rows.length ? parseFloat(rows[0].total_mb) : 0;
    const usedMb  = rows.length ? parseFloat(rows[0].used_mb)  : 0;
    return res.json({ success: true, server: process.env.MSSQL_SERVER, db: process.env.MSSQL_DB, totalMb, usedMb, freeMb: Math.max(0, totalMb - usedMb) });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

module.exports = router;
module.exports.getTodayStr    = getTodayStr;
module.exports.getMonthStr    = getMonthStr;
module.exports.getYearStr     = getYearStr;
module.exports.formatTime     = formatTime;
module.exports.formatDate     = formatDate;
module.exports.getRoleAccess  = getRoleAccess;
module.exports.DEFAULT_ROLE_ACCESS = DEFAULT_ROLE_ACCESS;
module.exports.OVERTIME_CUTOFFS    = OVERTIME_CUTOFFS;
