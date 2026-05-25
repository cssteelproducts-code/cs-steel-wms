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
    if (!truckId) return res.json({ success: false, message: 'ระบุ truckId' });

    const existing = await query('SELECT * FROM dbo.Trucks WHERE [ID]=@id', { id: truckId });
    if (!existing.length) return res.json({ success: false, message: 'ไม่พบรถ', code: 'NOT_FOUND' });
    const truck = existing[0];
    if ((truck.DataStationTime || '').toString().trim() !== '') {
      return res.json({
        success: false, message: 'บันทึก Data Station แล้ว', code: 'ALREADY_RECORDED',
        checkinTimestamp: (truck.CheckinTimestamp || '').toString(),
        plannedStations:  (truck.PlannedStations  || '').toString().split(',').filter(Boolean),
      });
    }

    const now  = new Date();
    const time = formatTime(now);
    const stationsStr = Array.isArray(stationNames) ? stationNames.join(',') : (stationNames || '');

    await withTx(async tx => {
      await txExecute(tx,
        "UPDATE dbo.Trucks SET [DataStationTime]=@t,[PlannedStations]=@st,[Status]=N'กำลังไปขึ้นสินค้า' WHERE [ID]=@id",
        { t: time, st: stationsStr, id: truckId }
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
              ets: now.toISOString(), lp: (truck.LicensePlate || '').toString(),
            }
          );
        }
      }
    });
    return res.json({
      success: true, dataStationTime: time,
      checkinTimestamp: (truck.CheckinTimestamp || '').toString(),
      plannedStations:  Array.isArray(stationNames) ? stationNames : stationsStr.split(',').filter(Boolean),
    });
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

    const { truckId, netWeight, checkoutTime: coTimeRaw, arcode, arname } = req.body;
    if (!truckId) return res.json({ success: false, message: 'ระบุ truckId' });

    const existing = await query('SELECT * FROM dbo.Trucks WHERE [ID]=@id', { id: truckId });
    if (!existing.length) return res.json({ success: false, message: 'ไม่พบรถ', code: 'NOT_FOUND' });
    const truck = existing[0];
    if ((truck.Status || '').toString() === 'ดำเนินการเสร็จสิ้น') {
      return res.json({
        success: false, message: 'Checkout แล้ว', code: 'ALREADY_RECORDED',
        checkoutTime: (truck.CheckoutTime || '').toString(),
      });
    }

    const now    = new Date();
    const coTime = /^\d{1,2}:\d{2}$/.test(coTimeRaw || '') ? coTimeRaw : formatTime(now);
    const finalArcode = arcode !== undefined ? (arcode || '').toUpperCase() : (truck.Arcode || '').toString();
    const finalArname = arname !== undefined ? (arname || '').trim()        : (truck.Arname || '').toString();

    await execute(
      `UPDATE dbo.Trucks SET
         [CheckoutTime]=@co,[CheckoutTimestamp]=@ts,[NetWeight]=@nw,
         [Status]=N'ดำเนินการเสร็จสิ้น',[Arcode]=@arc,[Arname]=@arn
       WHERE [ID]=@id`,
      { co: coTime, ts: now.toISOString(), nw: netWeight || '', arc: finalArcode, arn: finalArname, id: truckId }
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

// POST /api/trucks/station-entry  (บันทึกเวลาเข้าจุดขนถ่ายโดยใช้ station ID)
router.post('/station-entry', async (req, res) => {
  try {
    const { stationId } = req.body;
    if (!stationId) return res.json({ success: false, message: 'ระบุ stationId' });
    const now  = new Date();
    const time = formatTime(now);
    await execute(
      'UPDATE dbo.LoadingStations SET [EntryTime]=@et,[EntryTimestamp]=@ets WHERE [ID]=@id',
      { et: time, ets: now.toISOString(), id: stationId }
    );
    return res.json({ success: true, entryTime: time });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/trucks/station-exit-by-id  (บันทึกออกจากจุดขนถ่ายโดยใช้ station ID)
router.post('/station-exit-by-id', async (req, res) => {
  try {
    const { stationId } = req.body;
    if (!stationId) return res.json({ success: false, message: 'ระบุ stationId' });
    const now     = new Date();
    const time    = formatTime(now);
    const stns    = await query('SELECT * FROM dbo.LoadingStations WHERE [ID]=@id', { id: stationId });
    if (stns.length) {
      const entryTs = stns[0].EntryTimestamp ? new Date(stns[0].EntryTimestamp) : null;
      const mins    = entryTs ? Math.round((now - entryTs) / 60000) : null;
      await execute(
        'UPDATE dbo.LoadingStations SET [ExitTime]=@et,[ExitTimestamp]=@ets,[DurationMinutes]=@dur WHERE [ID]=@id',
        { et: time, ets: now.toISOString(), dur: mins, id: stationId }
      );
    }
    return res.json({ success: true, exitTime: time });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/trucks/station-add  (เพิ่มจุดขนถ่ายให้รถ)
router.post('/station-add', async (req, res) => {
  try {
    const { truckId, stationName } = req.body;
    if (!truckId || !stationName) return res.json({ success: false, message: 'ระบุ truckId และ stationName' });
    const now  = new Date();
    const time = formatTime(now);
    const sid  = 'STN-' + Date.now() + '-' + uuidv4().slice(0, 6).toUpperCase();
    const lp   = await query('SELECT [LicensePlate] FROM dbo.Trucks WHERE [ID]=@id', { id: truckId });
    await execute(
      `INSERT INTO dbo.LoadingStations
         ([ID],[TruckID],[StationName],[EntryTime],[ExitTime],[DurationMinutes],[EntryTimestamp],[ExitTimestamp],[LicensePlate])
       VALUES (@id,@tid,@sn,@et,N'',NULL,@ets,NULL,@lp)`,
      { id: sid, tid: truckId, sn: stationName, et: time, ets: now.toISOString(), lp: lp.length ? (lp[0].LicensePlate || '') : '' }
    );
    return res.json({ success: true, stationId: sid, entryTime: time });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/trucks/update-plate
router.post('/update-plate', async (req, res) => {
  try {
    const { truckId, licensePlate } = req.body;
    if (!truckId || !licensePlate) return res.json({ success: false, message: 'ระบุ truckId และ licensePlate' });
    await execute(
      'UPDATE dbo.Trucks SET [LicensePlate]=@lp WHERE [ID]=@id',
      { lp: licensePlate.toUpperCase(), id: truckId }
    );
    return res.json({ success: true, message: 'อัปเดตทะเบียนแล้ว' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/trucks/update-weight
router.post('/update-weight', async (req, res) => {
  try {
    const { truckId, netWeight } = req.body;
    if (!truckId) return res.json({ success: false, message: 'ระบุ truckId' });
    await execute(
      'UPDATE dbo.Trucks SET [NetWeight]=@nw WHERE [ID]=@id',
      { nw: netWeight || '', id: truckId }
    );
    return res.json({ success: true, message: 'อัปเดตน้ำหนักแล้ว' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/trucks/update-customer
router.post('/update-customer', async (req, res) => {
  try {
    const { truckId, arcode, arname } = req.body;
    if (!truckId) return res.json({ success: false, message: 'ระบุ truckId' });
    await execute(
      'UPDATE dbo.Trucks SET [Arcode]=@arc,[Arname]=@arn WHERE [ID]=@id',
      { arc: (arcode || '').toUpperCase(), arn: arname || '', id: truckId }
    );
    return res.json({ success: true, message: 'อัปเดตลูกค้าแล้ว' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// GET /api/trucks/month-report?month=MM/YYYY
router.get('/month-report', async (req, res) => {
  try {
    const month = (req.query.month || '').toString();
    let rows;
    if (month) {
      const [mm, yyyy] = month.split('/');
      rows = await query(
        "SELECT * FROM dbo.Trucks WHERE [Date] LIKE @pat AND [Status]=N'ดำเนินการเสร็จสิ้น'",
        { pat: `%/${mm.padStart(2,'0')}/${yyyy}` }
      );
    } else {
      rows = await query(
        "SELECT * FROM dbo.Trucks WHERE [Status]=N'ดำเนินการเสร็จสิ้น'"
      );
    }
    return res.json({ success: true, trucks: rows.map(rowToTruck) });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// GET /api/trucks/range?from=dd/MM/YYYY&to=dd/MM/YYYY
router.get('/range', async (req, res) => {
  try {
    const from = (req.query.from || '').toString();
    const to   = (req.query.to   || '').toString();
    if (!from || !to) return res.json({ success: false, message: 'ระบุ from และ to' });

    function parseThaiDate(s) {
      const p = (s || '').split('/');
      if (p.length !== 3) return null;
      const [d, m, y] = p.map(Number);
      const ceYear = y > 2500 ? y - 543 : y;
      return new Date(ceYear, m - 1, d);
    }

    const fromDate = parseThaiDate(from);
    const toDate   = parseThaiDate(to);
    if (!fromDate || !toDate || isNaN(fromDate) || isNaN(toDate))
      return res.json({ success: false, message: 'รูปแบบวันที่ไม่ถูกต้อง (DD/MM/YYYY)' });

    const rows = await query("SELECT * FROM dbo.Trucks WHERE [Status]=N'ดำเนินการเสร็จสิ้น'");
    const filtered = rows.filter(r => {
      const d = parseThaiDate((r.Date || '').toString());
      return d && !isNaN(d) && d >= fromDate && d <= toDate;
    });
    return res.json({ success: true, trucks: filtered.map(rowToTruck) });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/trucks/delete
router.post('/delete', async (req, res) => {
  try {
    const { truckId } = req.body;
    if (!truckId) return res.json({ success: false, message: 'ระบุ truckId' });
    const cntRows = await query(
      'SELECT COUNT(*) AS cnt FROM dbo.LoadingStations WHERE [TruckID]=@id', { id: truckId }
    ).catch(() => [{ cnt: 0 }]);
    const stationsDeleted = parseInt(cntRows[0]?.cnt) || 0;
    await execute('DELETE FROM dbo.LoadingStations WHERE [TruckID]=@id', { id: truckId });
    await execute('DELETE FROM dbo.Trucks WHERE [ID]=@id', { id: truckId });
    return res.json({ success: true, message: 'ลบรถแล้ว', stationsDeleted });
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
