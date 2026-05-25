// แทน DashboardDB.gs — ported logic ตรงจาก GAS
const router = require('express').Router();
const { query } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
const { getTodayStr, getMonthStr, getYearStr, formatDate, getRoleAccess, OVERTIME_CUTOFFS, DEFAULT_STD_MINUTES } = require('./utils');

router.use(authMiddleware);

// ─── helpers ────────────────────────────────────────────────────────────────

function isOvertime(vehicleType, checkinTime) {
  const cutoff = OVERTIME_CUTOFFS[vehicleType || ''];
  if (!cutoff || !checkinTime) return false;
  const m = checkinTime.toString().trim().match(/(\d{2}):(\d{2})/);
  const timeStr = m ? m[1] + ':' + m[2] : checkinTime.toString().trim();
  return timeStr > cutoff;
}

function currentStationFast(stationRows, truckStatus) {
  if (!stationRows || stationRows.length === 0) {
    if (truckStatus && truckStatus !== 'รอใบ Pick') return truckStatus;
    return 'รอใบ Pick / Pick စောင့်';
  }
  for (let i = stationRows.length - 1; i >= 0; i--) {
    const entryTime = (stationRows[i].EntryTime  || '').toString();
    const exitTime  = (stationRows[i].ExitTime   || '').toString();
    if (entryTime && !exitTime)
      return (stationRows[i].StationName || '').toString() + ' ⏳';
  }
  const last = stationRows[stationRows.length - 1];
  return (last.StationName || '').toString() + ' ✓';
}

async function getStdMinutes() {
  const rows = await query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'STD_MINUTES'").catch(() => []);
  if (rows.length && rows[0].Value) {
    try { return JSON.parse(rows[0].Value); } catch {}
  }
  return DEFAULT_STD_MINUTES;
}

function parseThaiDate(str) {
  if (!str) return null;
  const p = str.toString().split('/');
  if (p.length !== 3) return null;
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
}

// ─── GET /api/dashboard ──────────────────────────────────────────────────────
// ตรงกับ GAS _buildDashboardData() ครบทุก field
router.get('/', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.dashboard.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    const today     = getTodayStr();
    const month     = getMonthStr();    // MM/YYYY
    const year      = getYearStr();     // YYYY
    const now       = new Date();
    const yd        = new Date(now); yd.setDate(yd.getDate() - 1);
    if (yd.getDay() === 0) yd.setDate(yd.getDate() - 1);
    const yesterday = formatDate(yd);

    const [truckRows, stationRows] = await Promise.all([
      query("SELECT * FROM dbo.Trucks WHERE [Date] LIKE N'%/" + year + "'"),
      query('SELECT * FROM dbo.LoadingStations'),
    ]);

    // group stations by truck
    const stationByTruck = {};
    const exitedAt = {};
    stationRows.forEach(sr => {
      const tid    = (sr.TruckID     || '').toString();
      const stName = (sr.StationName || '').toString();
      const exit   = (sr.ExitTime    || '').toString();
      if (!tid) return;
      if (!stationByTruck[tid]) stationByTruck[tid] = [];
      stationByTruck[tid].push(sr);
      if (exit && stName) exitedAt[tid + '|' + stName] = true;
    });

    let todayCount = 0, monthCount = 0, yearCount = 0;
    const activeTrucks = [], completedTrucks = [];
    let totalNetWeightYesterday = 0, trucksWithWeightYesterday = 0;
    let normalWeightYesterday = 0, normalCountYesterday = 0;
    let otWeightYesterday = 0, otCountYesterday = 0;
    const vBreakToday = {}, vBreakMonth = {}, vBreakYear = {};
    const tBreakToday = {}, tBreakMonth = {}, tBreakYear = {};
    const timingToday = { inTime: 0, outOfTime: 0 };
    const timingMonth = { inTime: 0, outOfTime: 0 };
    const timingYear  = { inTime: 0, outOfTime: 0 };
    const otBreakToday = {}, otBreakMonth = {}, otBreakYear = {};
    const activePlanned = {}, activeTruckInfo = {};

    truckRows.forEach(r => {
      const dateStr   = (r.Date        || '').toString();
      if (!dateStr) return;
      const parts = dateStr.split('/');
      if (parts.length !== 3) return;
      const rowYear   = parts[2];
      const rowMonth  = parts[1] + '/' + parts[2];
      const vtype     = (r.VehicleType || '').toString();
      const transport = (r.Transport   || '').toString();
      const cTime     = (r.CheckinTime || '').toString();
      const status    = (r.Status      || '').toString();
      const oot       = isOvertime(vtype, cTime);
      const isToday   = dateStr === today;
      const isMon     = rowMonth === month;
      const isYr      = rowYear  === year;

      if (isToday) {
        todayCount++;
        vBreakToday[vtype] = (vBreakToday[vtype] || 0) + 1;
        tBreakToday[transport] = (tBreakToday[transport] || 0) + 1;
        if (oot) { timingToday.outOfTime++; otBreakToday[vtype] = (otBreakToday[vtype] || 0) + 1; }
        else timingToday.inTime++;
      }
      if (isMon) {
        monthCount++;
        vBreakMonth[vtype] = (vBreakMonth[vtype] || 0) + 1;
        tBreakMonth[transport] = (tBreakMonth[transport] || 0) + 1;
        if (oot) { timingMonth.outOfTime++; otBreakMonth[vtype] = (otBreakMonth[vtype] || 0) + 1; }
        else timingMonth.inTime++;
      }
      if (isYr) {
        yearCount++;
        vBreakYear[vtype] = (vBreakYear[vtype] || 0) + 1;
        tBreakYear[transport] = (tBreakYear[transport] || 0) + 1;
        if (oot) { timingYear.outOfTime++; otBreakYear[vtype] = (otBreakYear[vtype] || 0) + 1; }
        else timingYear.inTime++;
      }

      if (status !== '' && status !== 'ดำเนินการเสร็จสิ้น') {
        const truckId    = (r.ID || '').toString();
        const ts         = r.CheckinTimestamp ? new Date(r.CheckinTimestamp.toString()) : null;
        const truckStRows = stationByTruck[truckId] || [];
        const plannedArr  = r.PlannedStations
          ? r.PlannedStations.toString().split(',').map(s => s.trim()).filter(Boolean)
          : [];
        const exitedArr = truckStRows
          .filter(sr => sr.ExitTime && sr.ExitTime.toString() !== '')
          .map(sr => (sr.StationName || '').toString().trim())
          .filter(Boolean);
        const lp = (r.LicensePlate || '').toString();
        activeTrucks.push({
          id:              truckId,
          date:            dateStr,
          licensePlate:    lp,
          vehicleType:     vtype,
          transport:       transport,
          warehouse:       (r.Warehouse || '').toString(),
          arcode:          (r.Arcode    || '').toString(),
          arname:          (r.Arname    || '').toString(),
          checkinTime:     cTime,
          elapsedMinutes:  ts ? Math.round((now - ts) / 60000) : 0,
          currentStation:  currentStationFast(truckStRows, status),
          isOvertime:      oot,
          plannedStations: plannedArr,
          exitedStations:  exitedArr,
        });
        activeTruckInfo[truckId] = {
          licensePlate: lp, vehicleType: vtype,
          arname: (r.Arname || '').toString(),
          arcode: (r.Arcode || '').toString(),
        };
        const checkoutTime = (r.CheckoutTime || '').toString();
        if (checkoutTime === '' && r.PlannedStations && truckId)
          activePlanned[truckId] = plannedArr;

      } else if (status === 'ดำเนินการเสร็จสิ้น') {
        if (isToday) {
          completedTrucks.push({
            id:           (r.ID           || '').toString(),
            licensePlate: (r.LicensePlate || '').toString(),
            vehicleType:  vtype,
            transport:    transport,
            arcode:       (r.Arcode       || '').toString(),
            arname:       (r.Arname       || '').toString(),
            warehouse:    (r.Warehouse    || '').toString(),
            checkinTime:  cTime,
            checkoutTime: (r.CheckoutTime || '').toString(),
            netWeight:    (r.NetWeight    || '').toString(),
            isOvertime:   oot,
          });
        }
        if (dateStr === yesterday) {
          const wwy  = parseFloat((r.NetWeight || '').toString());
          const coTy = (r.CheckoutTime || '').toString().trim();
          if (!isNaN(wwy) && wwy > 0) {
            totalNetWeightYesterday += wwy; trucksWithWeightYesterday++;
            if (coTy && coTy <= '19:00') { normalWeightYesterday += wwy; normalCountYesterday++; }
            else if (coTy) { otWeightYesterday += wwy; otCountYesterday++; }
          }
        }
      }
    });

    activeTrucks.sort((a, b) => b.elapsedMinutes - a.elapsedMinutes);
    completedTrucks.sort((a, b) => b.checkoutTime.localeCompare(a.checkoutTime));

    let totalNetWeightToday = 0, trucksWithWeightToday = 0;
    let normalWeightToday = 0, normalCountToday = 0;
    let otWeightToday = 0, otCountToday = 0;
    completedTrucks.forEach(t => {
      const w = parseFloat(t.netWeight);
      if (!isNaN(w) && w > 0) {
        totalNetWeightToday += w; trucksWithWeightToday++;
        if (t.checkoutTime && t.checkoutTime <= '19:00') { normalWeightToday += w; normalCountToday++; }
        else if (t.checkoutTime) { otWeightToday += w; otCountToday++; }
      }
    });

    const stationQueues = {}, stationTrucks = {};
    Object.keys(activePlanned).forEach(truckId => {
      activePlanned[truckId].forEach(stName => {
        if (!exitedAt[truckId + '|' + stName]) {
          stationQueues[stName] = (stationQueues[stName] || 0) + 1;
          if (!stationTrucks[stName]) stationTrucks[stName] = [];
          const tk = activeTruckInfo[truckId];
          if (tk) stationTrucks[stName].push(tk);
        }
      });
    });

    return res.json({
      success: true,
      todayCount, monthCount, yearCount,
      activeTrucks,
      completedTrucks,
      totalNetWeightToday,
      trucksWithWeightToday,
      normalWeightToday,   normalCountToday,
      otWeightToday,       otCountToday,
      totalNetWeightYesterday,
      trucksWithWeightYesterday,
      normalWeightYesterday,   normalCountYesterday,
      otWeightYesterday,       otCountYesterday,
      yesterdayDate:   yesterday,
      vehicleBreakdown:   { today: vBreakToday,  month: vBreakMonth,  year: vBreakYear  },
      transportBreakdown: { today: tBreakToday,  month: tBreakMonth,  year: tBreakYear  },
      timingStats:        { today: timingToday,  month: timingMonth,  year: timingYear  },
      overtimeBreakdown:  { today: otBreakToday, month: otBreakMonth, year: otBreakYear },
      stationQueues,
      stationTrucks,
    });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// ─── GET /api/dashboard/stdmonitor ──────────────────────────────────────────
// ตรงกับ GAS _buildSTDData() — key ต้องเป็น "trucks" ไม่ใช่ "items"
router.get('/stdmonitor', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.stdmonitor.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    const stdMinutes = await getStdMinutes();
    const now = new Date();

    const [truckRows, stationRows] = await Promise.all([
      query("SELECT * FROM dbo.Trucks WHERE ISNULL([Status],N'')<>N'' AND [Status]<>N'ดำเนินการเสร็จสิ้น'"),
      query('SELECT * FROM dbo.LoadingStations'),
    ]);

    // lastActivity per truck (max of EntryTimestamp / ExitTimestamp across all stations)
    const lastActByTruck = {};
    stationRows.forEach(sr => {
      const tid = (sr.TruckID || '').toString();
      if (!tid) return;
      ['EntryTimestamp', 'ExitTimestamp'].forEach(col => {
        const v = (sr[col] || '').toString();
        if (!v) return;
        const t = new Date(v);
        if (!isNaN(t) && (!lastActByTruck[tid] || t > lastActByTruck[tid]))
          lastActByTruck[tid] = t;
      });
    });

    const trucks = truckRows.map(r => {
      const truckId  = (r.ID || '').toString();
      const ts       = r.CheckinTimestamp ? new Date(r.CheckinTimestamp.toString()) : null;
      const lastActTs = lastActByTruck[truckId] || null;
      return {
        id:                    truckId,
        licensePlate:          (r.LicensePlate || '').toString(),
        vehicleType:           (r.VehicleType  || '').toString(),
        arcode:                (r.Arcode       || '').toString(),
        arname:                (r.Arname       || '').toString(),
        warehouse:             (r.Warehouse    || '').toString(),
        status:                (r.Status       || '').toString(),
        checkinTime:           (r.CheckinTime  || '').toString(),
        checkinTimestamp:      ts       ? ts.toISOString()       : '',
        lastActivityTimestamp: lastActTs ? lastActTs.toISOString() : '',
        elapsedMinutes:        ts ? Math.round((now - ts) / 60000) : 0,
      };
    });
    trucks.sort((a, b) => b.elapsedMinutes - a.elapsedMinutes);

    return res.json({ success: true, trucks, stdMinutes });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// ─── GET /api/dashboard/month-report?yearMonth=YYYY-MM ───────────────────────
// ตรงกับ GAS getVehicleMonthReport()
router.get('/month-report', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.dashboard.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    let yearMonth = (req.query.yearMonth || '').toString();
    if (!yearMonth) {
      const n = new Date();
      yearMonth = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
    }
    const yp    = yearMonth.split('-');
    const year  = parseInt(yp[0]);
    const month = parseInt(yp[1]);

    // นับวันทำงาน (จันทร์–เสาร์)
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      if (dow >= 1 && dow <= 6) workingDays++;
    }

    const monthSuffix = String(month).padStart(2, '0') + '/' + year;
    const planRows = await query('SELECT * FROM dbo.DeliveryPlans');

    const map = {};
    planRows.forEach(r => {
      const planDate     = (r.PlanDate     || '').toString();
      const licensePlate = (r.LicensePlate || '').toString();
      const vehicleType  = (r.VehicleType  || '').toString();
      const orderIds     = (r.OrderIDs     || '').toString().split(',').filter(Boolean);
      const weightKg     = parseFloat((r.TotalWeightKg || '').toString()) || 0;
      const distKm       = parseFloat((r.EstDistanceKm || '').toString()) || 0;
      const status       = (r.Status       || '').toString();
      const planParts    = planDate.split('/');

      if (!licensePlate || planParts.length !== 3) return;
      // PlanDate format: DD/MM/YYYY — check if month+year match
      if ((planParts[1] + '/' + planParts[2]) !== monthSuffix) return;

      if (!map[licensePlate]) {
        map[licensePlate] = {
          licensePlate, vehicleType,
          allTrips: 0, completedTrips: 0,
          totalDistanceKm: 0, totalWeightKg: 0, totalOrders: 0,
          deliveryDates: {},
        };
      }
      const v = map[licensePlate];
      v.allTrips++;
      if (status === 'จัดส่งสำเร็จ') {
        v.completedTrips++;
        v.totalDistanceKm += isNaN(distKm)   ? 0 : distKm;
        v.totalWeightKg   += isNaN(weightKg) ? 0 : weightKg;
        v.totalOrders     += orderIds.length;
        v.deliveryDates[planDate] = true;
      }
    });

    const vehicles = Object.keys(map).map(plate => {
      const v  = map[plate];
      const dd = Object.keys(v.deliveryDates).length;
      return {
        licensePlate:    v.licensePlate,
        vehicleType:     v.vehicleType,
        workingDays,
        deliveryDays:    dd,
        deliveryRatePct: workingDays > 0 ? Math.round(dd / workingDays * 100) : 0,
        allTrips:        v.allTrips,
        completedTrips:  v.completedTrips,
        totalDistanceKm: Math.round(v.totalDistanceKm),
        totalWeightKg:   Math.round(v.totalWeightKg),
        totalOrders:     v.totalOrders,
        avgKmPerTrip:    v.completedTrips > 0 ? Math.round(v.totalDistanceKm / v.completedTrips) : 0,
        avgKgPerTrip:    v.completedTrips > 0 ? Math.round(v.totalWeightKg    / v.completedTrips) : 0,
      };
    });
    vehicles.sort((a, b) => b.deliveryDays - a.deliveryDays);

    return res.json({ success: true, vehicles, yearMonth, workingDays });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// ─── GET /api/dashboard/bulk ─────────────────────────────────────────────────
router.get('/bulk', async (req, res) => {
  try {
    const today = getTodayStr();
    const [plans, orders] = await Promise.all([
      query("SELECT * FROM dbo.DeliveryPlans WHERE [PlanDate]=@d ORDER BY [CreatedAt] DESC", { d: today }),
      query("SELECT * FROM dbo.DeliveryOrders WHERE [PlanDate]=@d", { d: today }),
    ]);
    return res.json({ success: true, plans, orders });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// ─── GET /api/dashboard/forecast ────────────────────────────────────────────
// คำนวณจากประวัติรถในระบบ — ตรงกับ _renderForecast ใน index.html
router.get('/forecast', async (req, res) => {
  try {
    const rows = await query("SELECT * FROM dbo.Trucks WHERE [Status]=N'ดำเนินการเสร็จสิ้น'");
    const now       = new Date();
    const todayStr  = getTodayStr();
    const WEEKDAY_TH = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];

    function _parseStr(s) {
      const p = (s || '').split('/');
      if (p.length !== 3) return null;
      const [d, m, y] = p.map(Number);
      const ceYear = y > 2500 ? y - 543 : y;
      return new Date(ceYear, m - 1, d);
    }

    // Build per-day stats
    const dayData = {};
    rows.forEach(r => {
      const d = (r.Date || '').toString();
      if (!d) return;
      if (!dayData[d]) dayData[d] = { trucks: 0, weight: 0, checkinTimes: [], stations: {}, transports: {}, vtypes: {} };
      dayData[d].trucks++;
      const w = parseFloat((r.NetWeight || '').toString());
      if (!isNaN(w) && w > 0) dayData[d].weight += w;
      const ci = (r.CheckinTime || '').toString(); if (ci) dayData[d].checkinTimes.push(ci);
      const tr = (r.Transport || '').toString(); if (tr) dayData[d].transports[tr] = (dayData[d].transports[tr] || 0) + 1;
      const vt = (r.VehicleType || '').toString(); if (vt) dayData[d].vtypes[vt] = (dayData[d].vtypes[vt] || 0) + 1;
      (r.PlannedStations || '').toString().split(',').filter(Boolean).forEach(s => {
        dayData[d].stations[s] = (dayData[d].stations[s] || 0) + 1;
      });
    });

    // Last 14 days
    const last14 = [];
    let maxT = 1;
    for (let i = 13; i >= 0; i--) {
      const d2 = new Date(now); d2.setDate(d2.getDate() - i);
      const ds = formatDate(d2);
      const dd = dayData[ds] || { trucks: 0, weight: 0 };
      if (dd.trucks > maxT) maxT = dd.trucks;
      last14.push({ date: ds, weekday: WEEKDAY_TH[d2.getDay()], trucks: dd.trucks, weight: Math.round(dd.weight), barPct: 0 });
    }
    last14.forEach(d2 => { d2.barPct = Math.round(d2.trucks / maxT * 100); });

    // Tomorrow
    const tmrw = new Date(now); tmrw.setDate(now.getDate() + 1);
    const tmrwWd  = WEEKDAY_TH[tmrw.getDay()];
    const tmrwDs  = formatDate(tmrw);
    const tmrwDow = tmrw.getDay();
    const sameWdKeys = Object.keys(dayData).filter(ds => { const d2 = _parseStr(ds); return d2 && d2.getDay() === tmrwDow; });
    const refDays = sameWdKeys.length;
    const predTrucks = refDays > 0 ? Math.round(sameWdKeys.reduce((s, k) => s + dayData[k].trucks, 0) / refDays) : 0;
    const predWeight = refDays > 0 ? Math.round(sameWdKeys.reduce((s, k) => s + dayData[k].weight, 0) / refDays) : 0;

    // Hourly distribution
    const hourlyCount = new Array(24).fill(0);
    Object.values(dayData).forEach(dd => dd.checkinTimes.forEach(t => {
      const m = t.match(/^(\d{1,2})/); if (m) { const h = parseInt(m[1]); if (h < 24) hourlyCount[h]++; }
    }));
    const maxH = Math.max(...hourlyCount, 1);
    const hourlyPct  = hourlyCount.map(c => Math.round(c / maxH * 100));
    const peakHours  = hourlyCount.map((c, h) => ({ h, c })).filter(x => x.c >= maxH * 0.7).map(x => x.h);

    // Aggregates
    const days = Math.max(Object.keys(dayData).length, 1);
    function _topItems(getter, nameKey, max) {
      const tot = {}; Object.values(dayData).forEach(dd => Object.keys(getter(dd)).forEach(k => { tot[k] = (tot[k] || 0) + getter(dd)[k]; }));
      const grand = Object.values(tot).reduce((s, c) => s + c, 0) || 1;
      return Object.keys(tot).sort((a, b) => tot[b] - tot[a]).slice(0, max).map(k => ({
        [nameKey]: k, count: tot[k], pct: Math.round(tot[k] / grand * 100), avgPerDay: Math.round(tot[k] / days * 10) / 10
      }));
    }
    const vtypes       = _topItems(d2 => d2.vtypes,      'type',    8);
    const topStations  = _topItems(d2 => d2.stations,    'station', 8);
    const topTransports= _topItems(d2 => d2.transports,  'name',    6);

    const todayD   = dayData[todayStr] || { trucks: 0, weight: 0 };
    const staffNote = predTrucks >= 30 ? 'งานหนักมาก' : predTrucks >= 20 ? 'งานหนัก' : predTrucks >= 10 ? 'งานปกติ' : predTrucks >= 5 ? 'งานเบา' : 'วันหยุด/น้อย';

    return res.json({
      success: true,
      today:    { date: todayStr, weekday: WEEKDAY_TH[now.getDay()], trucks: todayD.trucks, weight: Math.round(todayD.weight) },
      tomorrow: { date: tmrwDs, weekday: tmrwWd, refDays, trucks: predTrucks, weight: predWeight },
      staffRec: { note: staffNote, value: predTrucks, total: predTrucks },
      hourlyPct, hourlyCount, peakHours, last14, vtypes, topStations, topTransports,
    });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

module.exports = router;
