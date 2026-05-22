// แทน TrucksDB.gs
const router         = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query, execute, withTx, txQuery, txExecute } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
const { getTodayStr, formatTime, formatDate, getRoleAccess } = require('./utils');

router.use(authMiddleware);

// POST /api/trucks/checkin
router.post('/checkin', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.checkin.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    const payload  = req.body;
    const now      = new Date();
    const ciTime   = /^\d{1,2}:\d{2}$/.test(payload.checkinTime || '') ? payload.checkinTime : formatTime(now);
    const dateStr  = getTodayStr();
    const tsIso    = now.toISOString();
    const newId    = 'TRK-' + dateStr.replace(/\//g, '') + '-' + uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase();

    await execute(
      `INSERT INTO dbo.Trucks
         ([ID],[Date],[Warehouse],[LicensePlate],[VehicleType],[Transport],[Arcode],
          [CheckinTime],[DataStationTime],[CheckoutTime],[Status],[CheckinTimestamp],[CheckoutTimestamp],
          [NetWeight],[PlannedStations],[Arname])
       VALUES
         (@id,@date,@wh,@lp,@vt,@tr,@arc,@ci,N'',N'',N'รอใบ Pick',@ts,N'',N'',N'',@arn)`,
      {
        id:  newId,       date: dateStr,
        wh:  payload.warehouse    || '',
        lp:  (payload.licensePlate || '').toUpperCase(),
        vt:  payload.vehicleType  || '',
        tr:  payload.transport    || '',
        arc: (payload.arcode      || '').toUpperCase(),
        ci:  ciTime,  ts: tsIso,
        arn: (payload.arname      || '').trim(),
      }
    );
    return res.json({ success: true, id: newId, checkinTime: ciTime, date: dateStr });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// GET /api/trucks/search?q=XX
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toUpperCase();
    if (!q) return res.json({ success: false, message: 'กรุณากรอกทะเบียนรถ', code: 'INVALID_QUERY' });
    const rows = await query(
      "SELECT * FROM dbo.Trucks WHERE [LicensePlate] LIKE @q",
      { q: '%' + q + '%' }
    );
    return res.json({ success: true, trucks: rows.map(rowToTruck) });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// GET /api/trucks/:id
router.get('/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.Trucks WHERE [ID]=@id', { id: req.params.id });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบรถ: ' + req.params.id, code: 'NOT_FOUND' });
    return res.json({ success: true, truck: rowToTruck(rows[0]) });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// GET /api/trucks  (active + today completed)
router.get('/', async (req, res) => {
  try {
    const today = getTodayStr();
    const rows  = await query(
      "SELECT * FROM dbo.Trucks WHERE ISNULL([Status],N'')<>N'' AND ([Date]=@d OR [Status]<>N'ดำเนินการเสร็จสิ้น')",
      { d: today }
    );
    const now    = new Date();
    const active = [], completed = [];
    rows.forEach(r => {
      const t  = rowToTruck(r);
      const ts = r.CheckinTimestamp ? new Date(r.CheckinTimestamp) : null;
      t.elapsedMinutes = ts ? Math.round((now - ts) / 60000) : 0;
      if (r.Status === 'ดำเนินการเสร็จสิ้น') completed.push(t);
      else active.push(t);
    });
    active.sort((a, b) => b.elapsedMinutes - a.elapsedMinutes);
    completed.sort((a, b) => b.checkoutTime.localeCompare(a.checkoutTime));
    return res.json({ success: true, active, completed });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/trucks/datastation
router.post('/datastation', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.datastation.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    const { truckId, stationNames } = req.body;
    const now  = new Date();
    const time = formatTime(now);

    await withTx(async tx => {
      await txExecute(tx,
        'UPDATE dbo.Trucks SET [DataStationTime]=@t,[PlannedStations]=@st,[Status]=N\'กำลังขนถ่าย\' WHERE [ID]=@id',
        { t: time, st: Array.isArray(stationNames) ? stationNames.join(',') : stationNames, id: truckId }
      );
      if (Array.isArray(stationNames)) {
        for (const stn of stationNames) {
          const sid = 'STN-' + Date.now() + '-' + uuidv4().slice(0, 6).toUpperCase();
          await txExecute(tx,
            `INSERT INTO dbo.LoadingStations
               ([ID],[TruckID],[StationName],[EntryTime],[ExitTime],[DurationMinutes],[EntryTimestamp],[ExitTimestamp],[LicensePlate])
             VALUES (@id,@tid,@sn,@et,N'',NULL,@ets,NULL,@lp)`,
            {
              id: sid, tid: truckId, sn: stn, et: time,
              ets: now.toISOString(), lp: '',
            }
          );
        }
      }
    });
    return res.json({ success: true, dataStationTime: time });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/trucks/checkout
router.post('/checkout', async (req, res) => {
  try {
    const ra = await getRoleAccess();
    if (!ra.checkout.includes(req.user.role))
      return res.json({ success: false, message: 'ไม่มีสิทธิ์', code: 'FORBIDDEN' });

    const { truckId, netWeight, checkoutTime: coTimeRaw } = req.body;
    const now    = new Date();
    const coTime = /^\d{1,2}:\d{2}$/.test(coTimeRaw || '') ? coTimeRaw : formatTime(now);

    await execute(
      `UPDATE dbo.Trucks SET
         [CheckoutTime]=@co,[CheckoutTimestamp]=@ts,[NetWeight]=@nw,[Status]=N'ดำเนินการเสร็จสิ้น'
       WHERE [ID]=@id`,
      { co: coTime, ts: now.toISOString(), nw: netWeight || '', id: truckId }
    );
    return res.json({ success: true, checkoutTime: coTime });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/trucks/station-exit  (บันทึกออกจากจุดขนถ่าย)
router.post('/station-exit', async (req, res) => {
  try {
    const { truckId, stationName } = req.body;
    const now  = new Date();
    const time = formatTime(now);
    const stns = await query(
      "SELECT * FROM dbo.LoadingStations WHERE [TruckID]=@tid AND [StationName]=@sn AND ([ExitTime] IS NULL OR [ExitTime]=N'')",
      { tid: truckId, sn: stationName }
    );
    if (stns.length) {
      const stn     = stns[0];
      const entryTs = stn.EntryTimestamp ? new Date(stn.EntryTimestamp) : null;
      const mins    = entryTs ? Math.round((now - entryTs) / 60000) : null;
      await execute(
        'UPDATE dbo.LoadingStations SET [ExitTime]=@et,[ExitTimestamp]=@ets,[DurationMinutes]=@dur WHERE [ID]=@id',
        { et: time, ets: now.toISOString(), dur: mins, id: stn.ID }
      );
    }
    return res.json({ success: true, exitTime: time });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// GET /api/trucks/stations/:truckId
router.get('/stations/:truckId', async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM dbo.LoadingStations WHERE [TruckID]=@tid ORDER BY [EntryTimestamp]',
      { tid: req.params.truckId }
    );
    return res.json({ success: true, stations: rows });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

function rowToTruck(r) {
  return {
    id:                r.ID                || '',
    date:              r.Date              || '',
    warehouse:         r.Warehouse         || '',
    licensePlate:      r.LicensePlate      || '',
    vehicleType:       r.VehicleType       || '',
    transport:         r.Transport         || '',
    arcode:            r.Arcode            || '',
    arname:            r.Arname            || '',
    checkinTime:       r.CheckinTime       || '',
    dataStationTime:   r.DataStationTime   || '',
    checkoutTime:      r.CheckoutTime      || '',
    status:            r.Status            || '',
    netWeight:         r.NetWeight         || '',
    plannedStations:   r.PlannedStations   || '',
    checkinTimestamp:  r.CheckinTimestamp  || '',
    checkoutTimestamp: r.CheckoutTimestamp || '',
    elapsedMinutes:    0,
  };
}

module.exports = router;
