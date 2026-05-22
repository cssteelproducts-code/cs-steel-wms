// แทน DashboardDB.gs
const router = require('express').Router();
const { query, withTx, txQuery } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
const { getTodayStr, getMonthStr, getYearStr, formatDate, getRoleAccess } = require('./utils');

router.use(authMiddleware);

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.dashboard.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    const today     = getTodayStr();
    const year      = getYearStr();
    let truckRows, stationRows;

    await withTx(async tx => {
      truckRows   = await txQuery(tx, "SELECT * FROM dbo.Trucks WHERE [Date] LIKE N'%/" + year + "'");
      stationRows = await txQuery(tx, 'SELECT * FROM dbo.LoadingStations');
    });

    const stats = _buildStats(truckRows, stationRows, today);
    return res.json({ success: true, ...stats });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// GET /api/dashboard/stdmonitor  (STD = Standard Time monitor)
router.get('/stdmonitor', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.stdmonitor.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    const [truckRows, stationRows] = await Promise.all([
      query("SELECT * FROM dbo.Trucks WHERE ISNULL([Status],N'')<>N'' AND [Status]<>N'ดำเนินการเสร็จสิ้น'"),
      query('SELECT * FROM dbo.LoadingStations'),
    ]);

    const now      = new Date();
    const std      = _buildSTDData(truckRows, stationRows, now);
    return res.json({ success: true, ...std });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

function _buildStats(truckRows, stationRows, today) {
  const now       = new Date();
  const month     = getMonthStr();
  const year      = getYearStr();
  const yd        = new Date(now); yd.setDate(yd.getDate() - 1);
  if (yd.getDay() === 0) yd.setDate(yd.getDate() - 1);
  const yesterday = formatDate(yd);

  const stationByTruck = {};
  stationRows.forEach(sr => {
    const tid = sr.TruckID || '';
    if (!tid) return;
    if (!stationByTruck[tid]) stationByTruck[tid] = [];
    stationByTruck[tid].push(sr);
  });

  let todayCount = 0, monthCount = 0, yearCount = 0;
  const vBreakToday = {}, vBreakMonth = {}, vBreakYear = {};
  const timingToday = { inTime: 0, outOfTime: 0 };
  const timingMonth = { inTime: 0, outOfTime: 0 };
  const timingYear  = { inTime: 0, outOfTime: 0 };
  let totalWeightYesterday = 0, weightCountYesterday = 0;

  const OVERTIME_CUTOFFS = {
    '4 ล้อ': '16:00', '6 ล้อ': '15:30', '8 ล้อ': '15:30',
    '10 ล้อ': '15:00', '12 ล้อ': '14:00', 'เทเลอร์': '14:00', 'พ่วง': '14:00',
  };

  truckRows.forEach(r => {
    const dateStr = (r.Date || '').toString();
    const vt      = (r.VehicleType || '').toString();
    const ciTime  = (r.CheckinTime || '').toString();
    const nw      = parseFloat(r.NetWeight) || 0;
    const cutoff  = OVERTIME_CUTOFFS[vt];
    const ot      = cutoff && ciTime ? ciTime > cutoff : false;

    if (dateStr === today) {
      todayCount++;
      vBreakToday[vt] = (vBreakToday[vt] || 0) + 1;
      if (cutoff) { ot ? timingToday.outOfTime++ : timingToday.inTime++; }
    }
    if (dateStr.endsWith('/' + month.split('/')[0] + '/' + month.split('/')[1]) ||
        dateStr.slice(3) === month) {
      monthCount++;
      vBreakMonth[vt] = (vBreakMonth[vt] || 0) + 1;
      if (cutoff) { ot ? timingMonth.outOfTime++ : timingMonth.inTime++; }
    }
    if (dateStr.endsWith('/' + year)) {
      yearCount++;
      vBreakYear[vt] = (vBreakYear[vt] || 0) + 1;
      if (cutoff) { ot ? timingYear.outOfTime++ : timingYear.inTime++; }
    }
    if (dateStr === yesterday && nw > 0) {
      totalWeightYesterday += nw;
      weightCountYesterday++;
    }
  });

  return {
    today, month, year, yesterday,
    todayCount, monthCount, yearCount,
    vehicleBreakToday: vBreakToday, vehicleBreakMonth: vBreakMonth, vehicleBreakYear: vBreakYear,
    timingToday, timingMonth, timingYear,
    avgWeightYesterday: weightCountYesterday ? (totalWeightYesterday / weightCountYesterday).toFixed(2) : '0',
  };
}

function _buildSTDData(truckRows, stationRows, now) {
  const STD_MINUTES = {
    '4 ล้อ': 60, '6 ล้อ': 120, '8 ล้อ': 120,
    '10 ล้อ': 140, '12 ล้อ': 160, 'เทเลอร์': 240, 'พ่วง': 240,
  };
  const stationByTruck = {};
  stationRows.forEach(sr => {
    const tid = sr.TruckID || '';
    if (!tid) return;
    if (!stationByTruck[tid]) stationByTruck[tid] = [];
    stationByTruck[tid].push(sr);
  });
  const items = truckRows.map(r => {
    const ts      = r.CheckinTimestamp ? new Date(r.CheckinTimestamp) : null;
    const elapsed = ts ? Math.round((now - ts) / 60000) : 0;
    const vt      = (r.VehicleType || '').toString();
    const std     = STD_MINUTES[vt] || 120;
    const stns    = stationByTruck[r.ID || ''] || [];
    return {
      id:            r.ID || '',
      licensePlate:  r.LicensePlate || '',
      vehicleType:   vt,
      status:        r.Status || '',
      checkinTime:   r.CheckinTime || '',
      elapsedMinutes: elapsed,
      stdMinutes:    std,
      overSTD:       elapsed > std,
      stationCount:  stns.length,
      stationsExited: stns.filter(s => s.ExitTime).length,
    };
  });
  return { items, stdMinutes: STD_MINUTES };
}

module.exports = router;
