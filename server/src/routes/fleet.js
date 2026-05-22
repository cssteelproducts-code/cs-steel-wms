const router         = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query, execute, withTx, txExecute } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');

const ROLES_DELIVERY_ADMIN = ['manager','dept_head','section_chief'];
router.use(authMiddleware);

function rowToFleet(r) {
  return {
    fleetId:          r.FleetID          || '',
    licensePlate:     r.LicensePlate     || '',
    vehicleType:      r.VehicleType      || '',
    weightCapacityKg: parseFloat(r.WeightCapacityKg) || 0,
    lengthCapacityM:  parseFloat(r.LengthCapacityM)  || 0,
    widthCapacityM:   parseFloat(r.WidthCapacityM)   || 0,
    heightCapacityM:  parseFloat(r.HeightCapacityM)  || 0,
    homeZone:         r.HomeZone         || '',
    homeLat:          parseFloat(r.HomeLat) || 0,
    homeLng:          parseFloat(r.HomeLng) || 0,
    status:           r.Status           || '',
    remark:           r.Remark           || '',
    insuranceCompany: r.InsuranceCompany || '',
    insuranceExpiry:  r.InsuranceExpiry  || '',
    prbaCompany:      r.PrbaCompany      || '',
    prbaExpiry:       r.PrbaExpiry       || '',
    taxRenewalDate:   r.TaxRenewalDate   || '',
    hasHiab:          r.HasHiab === true || r.HasHiab === 1 || r.HasHiab === '1',
    createdAt:        r.CreatedAt        || '',
    updatedAt:        r.UpdatedAt        || '',
  };
}

function rowToMaint(r) {
  return {
    recordId:        r.RecordID        || '',
    fleetId:         r.FleetID         || '',
    licensePlate:    r.LicensePlate    || '',
    type:            r.Type            || '',
    symptom:         r.Symptom         || '',
    startDate:       r.StartDate       || '',
    expectedEndDate: r.ExpectedEndDate || '',
    actualEndDate:   r.ActualEndDate   || '',
    daysParked:      parseFloat(r.DaysParked) || 0,
    remark:          r.Remark          || '',
    createdAt:       r.CreatedAt       || '',
  };
}

// GET /api/fleet
router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.Fleet ORDER BY [LicensePlate]');
    return res.json({ success: true, vehicles: rows.map(rowToFleet) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/fleet/available
router.get('/available', async (req, res) => {
  try {
    const rows = await query("SELECT * FROM dbo.Fleet WHERE [Status]=N'พร้อม' ORDER BY [LicensePlate]");
    return res.json({ success: true, vehicles: rows.map(rowToFleet) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/fleet/maintenance/:fleetId
router.get('/maintenance/:fleetId', async (req, res) => {
  try {
    const rows = req.params.fleetId === 'all'
      ? await query('SELECT * FROM dbo.FleetMaintenance ORDER BY [CreatedAt] DESC')
      : await query('SELECT * FROM dbo.FleetMaintenance WHERE [FleetID]=@fid ORDER BY [CreatedAt] DESC', { fid: req.params.fleetId });
    return res.json({ success: true, records: rows.map(rowToMaint) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/fleet/add
router.post('/add', async (req, res) => {
  try {
    const p = req.body;
    const fleetId = p.fleetId || ('FL-' + uuidv4().slice(0,8).toUpperCase());
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO dbo.Fleet ([FleetID],[LicensePlate],[VehicleType],[WeightCapacityKg],[LengthCapacityM],
       [WidthCapacityM],[HeightCapacityM],[HomeZone],[HomeLat],[HomeLng],[Status],[Remark],[CreatedAt],[UpdatedAt],
       [InsuranceCompany],[InsuranceExpiry],[PrbaCompany],[PrbaExpiry],[TaxRenewalDate],[HasHiab])
       VALUES (@id,@lp,@vt,@wt,@len,@wid,@hgt,@hz,@hlat,@hlng,@st,@rm,@ca,@ua,@ins,@inse,@prba,@prbae,@tax,@hiab)`,
      { id:fleetId, lp:(p.licensePlate||'').toUpperCase(), vt:p.vehicleType||'',
        wt:parseFloat(p.weightCapacityKg)||0, len:parseFloat(p.lengthCapacityM)||0,
        wid:parseFloat(p.widthCapacityM)||0, hgt:parseFloat(p.heightCapacityM)||0,
        hz:p.homeZone||'', hlat:parseFloat(p.homeLat)||null, hlng:parseFloat(p.homeLng)||null,
        st:p.status||'พร้อม', rm:p.remark||'', ca:now, ua:now,
        ins:p.insuranceCompany||'', inse:p.insuranceExpiry||'',
        prba:p.prbaCompany||'', prbae:p.prbaExpiry||'', tax:p.taxRenewalDate||'',
        hiab:p.hasHiab?1:0 }
    );
    return res.json({ success: true, fleetId, message: 'เพิ่มรถสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/fleet/update
router.post('/update', async (req, res) => {
  try {
    const { fleetId, ...p } = req.body;
    const now = new Date().toISOString();
    await execute(
      `UPDATE dbo.Fleet SET [LicensePlate]=@lp,[VehicleType]=@vt,[WeightCapacityKg]=@wt,
       [LengthCapacityM]=@len,[WidthCapacityM]=@wid,[HeightCapacityM]=@hgt,[HomeZone]=@hz,
       [HomeLat]=@hlat,[HomeLng]=@hlng,[Status]=@st,[Remark]=@rm,[UpdatedAt]=@ua,
       [InsuranceCompany]=@ins,[InsuranceExpiry]=@inse,[PrbaCompany]=@prba,[PrbaExpiry]=@prbae,
       [TaxRenewalDate]=@tax,[HasHiab]=@hiab WHERE [FleetID]=@id`,
      { id:fleetId, lp:(p.licensePlate||'').toUpperCase(), vt:p.vehicleType||'',
        wt:parseFloat(p.weightCapacityKg)||0, len:parseFloat(p.lengthCapacityM)||0,
        wid:parseFloat(p.widthCapacityM)||0, hgt:parseFloat(p.heightCapacityM)||0,
        hz:p.homeZone||'', hlat:parseFloat(p.homeLat)||null, hlng:parseFloat(p.homeLng)||null,
        st:p.status||'พร้อม', rm:p.remark||'', ua:now,
        ins:p.insuranceCompany||'', inse:p.insuranceExpiry||'',
        prba:p.prbaCompany||'', prbae:p.prbaExpiry||'', tax:p.taxRenewalDate||'',
        hiab:p.hasHiab?1:0 }
    );
    return res.json({ success: true, message: 'อัปเดตรถสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/fleet/status
router.post('/status', async (req, res) => {
  try {
    const { fleetId, status } = req.body;
    await execute('UPDATE dbo.Fleet SET [Status]=@s,[UpdatedAt]=@ua WHERE [FleetID]=@id',
      { s: status, ua: new Date().toISOString(), id: fleetId });
    return res.json({ success: true, status });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/fleet/delete
router.post('/delete', async (req, res) => {
  try {
    await execute('DELETE FROM dbo.Fleet WHERE [FleetID]=@id', { id: req.body.fleetId });
    return res.json({ success: true, message: 'ลบรถสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/fleet/maintenance/add
router.post('/maintenance/add', async (req, res) => {
  try {
    const p = req.body;
    const recordId = 'MNT-' + uuidv4().slice(0,8).toUpperCase();
    const now = new Date().toISOString();
    await withTx(async tx => {
      await txExecute(tx,
        `INSERT INTO dbo.FleetMaintenance ([RecordID],[FleetID],[LicensePlate],[Type],[Symptom],[StartDate],
         [ExpectedEndDate],[ActualEndDate],[DaysParked],[Remark],[CreatedAt])
         VALUES (@rid,@fid,@lp,@tp,@sym,@sd,@eed,N'',NULL,@rm,@ca)`,
        { rid:recordId, fid:p.fleetId, lp:p.licensePlate||'', tp:p.type||'',
          sym:p.symptom||'', sd:p.startDate||'', eed:p.expectedEndDate||'', rm:p.remark||'', ca:now }
      );
      if (p.status) {
        await txExecute(tx, 'UPDATE dbo.Fleet SET [Status]=@s,[UpdatedAt]=@ua WHERE [FleetID]=@id',
          { s: p.status, ua: now, id: p.fleetId });
      }
    });
    return res.json({ success: true, recordId, message: 'บันทึกการซ่อมบำรุงสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/fleet/maintenance/close
router.post('/maintenance/close', async (req, res) => {
  try {
    const { recordId, actualEndDate } = req.body;
    const rows = await query('SELECT * FROM dbo.FleetMaintenance WHERE [RecordID]=@rid', { rid: recordId });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบข้อมูล' });
    const rec = rows[0];
    const start = new Date(rec.StartDate || rec.CreatedAt);
    const end   = new Date(actualEndDate || new Date());
    const days  = Math.round((end - start) / 86400000);
    await withTx(async tx => {
      await txExecute(tx,
        'UPDATE dbo.FleetMaintenance SET [ActualEndDate]=@aed,[DaysParked]=@dp WHERE [RecordID]=@rid',
        { aed: actualEndDate, dp: days, rid: recordId }
      );
      await txExecute(tx, "UPDATE dbo.Fleet SET [Status]=N'พร้อม',[UpdatedAt]=@ua WHERE [FleetID]=@fid",
        { ua: new Date().toISOString(), fid: rec.FleetID });
    });
    return res.json({ success: true, recordId, daysParked: days, message: 'ปิดการซ่อมบำรุงสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

module.exports = router;
