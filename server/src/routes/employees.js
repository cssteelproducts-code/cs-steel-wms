const router         = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query, execute } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

const VEHICLE_TYPES = ['4 ล้อ','6 ล้อ','8 ล้อ','10 ล้อ','12 ล้อ','เทเลอร์','พ่วง'];

// ==================== Employees ====================
router.get('/list', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.Employees ORDER BY [EmpName]');
    return res.json({ success: true, employees: rows.map(r => ({
      empId:       r.EmpID       || '',
      empName:     r.EmpName     || '',
      nickName:    r.NickName    || '',
      position:    r.Position    || '',
      phone:       r.Phone       || '',
      status:      r.Status      || '',
      createdAt:   r.CreatedAt   || '',
      updatedAt:   r.UpdatedAt   || '',
    })) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/add', async (req, res) => {
  try {
    const p = req.body;
    const empId = 'EMP-' + uuidv4().slice(0,6).toUpperCase();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO dbo.Employees ([EmpID],[EmpName],[NickName],[Position],[Phone],[Status],[CreatedAt],[UpdatedAt])
       VALUES (@id,@nm,@nk,@pos,@ph,@st,@ca,@ua)`,
      { id:empId, nm:p.empName||'', nk:p.nickName||'', pos:p.position||'',
        ph:p.phone||'', st:p.status||'พร้อม', ca:now, ua:now }
    );
    return res.json({ success: true, empId, message: 'เพิ่มพนักงานสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/update', async (req, res) => {
  try {
    const { empId, ...p } = req.body;
    await execute(
      'UPDATE dbo.Employees SET [EmpName]=@nm,[NickName]=@nk,[Position]=@pos,[Phone]=@ph,[Status]=@st,[UpdatedAt]=@ua WHERE [EmpID]=@id',
      { id:empId, nm:p.empName||'', nk:p.nickName||'', pos:p.position||'',
        ph:p.phone||'', st:p.status||'พร้อม', ua:new Date().toISOString() }
    );
    return res.json({ success: true, message: 'อัปเดตพนักงานสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/delete', async (req, res) => {
  try {
    await execute('DELETE FROM dbo.Employees WHERE [EmpID]=@id', { id: req.body.empId });
    return res.json({ success: true, message: 'ลบพนักงานสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// ==================== Trip Rates ====================
router.get('/trip-rates', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.TripRates');
    return res.json({ success: true, rates: rows.map(r => ({
      vehicleType:   r.VehicleType   || '',
      driverRate:    parseFloat(r.DriverRate)    || 0,
      assistantRate: parseFloat(r.AssistantRate) || 0,
      updatedAt:     r.UpdatedAt     || '',
    })) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/trip-rates/save', async (req, res) => {
  try {
    const { rates } = req.body;
    const now = new Date().toISOString();
    for (const r of rates) {
      const existing = await query('SELECT [VehicleType] FROM dbo.TripRates WHERE [VehicleType]=@vt', { vt: r.vehicleType });
      if (existing.length) {
        await execute('UPDATE dbo.TripRates SET [DriverRate]=@dr,[AssistantRate]=@ar,[UpdatedAt]=@ua WHERE [VehicleType]=@vt',
          { dr:parseFloat(r.driverRate)||0, ar:parseFloat(r.assistantRate)||0, ua:now, vt:r.vehicleType });
      } else {
        await execute('INSERT INTO dbo.TripRates ([VehicleType],[DriverRate],[AssistantRate],[UpdatedAt]) VALUES (@vt,@dr,@ar,@ua)',
          { vt:r.vehicleType, dr:parseFloat(r.driverRate)||0, ar:parseFloat(r.assistantRate)||0, ua:now });
      }
    }
    return res.json({ success: true, message: 'บันทึก Trip Rates สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// ==================== Trip Logs ====================
router.get('/trip-logs', async (req, res) => {
  try {
    const inputs = {};
    let sql = 'SELECT * FROM dbo.TripLogs WHERE 1=1';
    if (req.query.planDate) { sql += ' AND [PlanDate]=@pd'; inputs.pd = req.query.planDate; }
    if (req.query.yearMonth) { sql += " AND [PlanDate] LIKE @ym"; inputs.ym = '%/' + req.query.yearMonth.replace('/','/'); }
    sql += ' ORDER BY [CreatedAt] DESC';
    const rows = await query(sql, inputs);
    return res.json({ success: true, logs: rows.map(r => ({
      logId:             r.LogID             || '',
      planId:            r.PlanID            || '',
      planDate:          r.PlanDate          || '',
      fleetId:           r.FleetID           || '',
      licensePlate:      r.LicensePlate      || '',
      vehicleType:       r.VehicleType       || '',
      driverEmpId:       r.DriverEmpID       || '',
      driverEmpName:     r.DriverEmpName     || '',
      assistantEmpId:    r.AssistantEmpID    || '',
      assistantEmpName:  r.AssistantEmpName  || '',
      driverFee:         parseFloat(r.DriverFee)    || 0,
      assistantFee:      parseFloat(r.AssistantFee) || 0,
      totalFee:          parseFloat(r.TotalFee)     || 0,
      status:            r.Status            || '',
      remark:            r.Remark            || '',
      createdBy:         r.CreatedBy         || '',
      createdAt:         r.CreatedAt         || '',
    })) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/trip-logs/save', async (req, res) => {
  try {
    const p = req.body;
    const logId = 'LOG-' + uuidv4().slice(0,8).toUpperCase();
    const now   = new Date().toISOString();
    await execute(
      `INSERT INTO dbo.TripLogs ([LogID],[PlanID],[PlanDate],[FleetID],[LicensePlate],[VehicleType],
       [DriverEmpID],[DriverEmpName],[AssistantEmpID],[AssistantEmpName],
       [DriverFee],[AssistantFee],[TotalFee],[Status],[Remark],[CreatedBy],[CreatedAt])
       VALUES (@lid,@pid,@pd,@fid,@lp,@vt,@deid,@denm,@aeid,@aenm,@df,@af,@tf,N'บันทึกแล้ว',@rm,@cb,@ca)`,
      { lid:logId, pid:p.planId||'', pd:p.planDate||'', fid:p.fleetId||'',
        lp:p.licensePlate||'', vt:p.vehicleType||'',
        deid:p.driverEmpId||'', denm:p.driverEmpName||'',
        aeid:p.assistantEmpId||'', aenm:p.assistantEmpName||'',
        df:parseFloat(p.driverFee)||0, af:parseFloat(p.assistantFee)||0,
        tf:parseFloat(p.totalFee)||(parseFloat(p.driverFee)||0)+(parseFloat(p.assistantFee)||0),
        rm:p.remark||'', cb:req.user.username, ca:now }
    );
    return res.json({ success: true, logId, message: 'บันทึก Trip Log สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/trip-logs/update', async (req, res) => {
  try {
    const { logId, ...p } = req.body;
    await execute(
      `UPDATE dbo.TripLogs SET [DriverEmpID]=@deid,[DriverEmpName]=@denm,[AssistantEmpID]=@aeid,
       [AssistantEmpName]=@aenm,[DriverFee]=@df,[AssistantFee]=@af,[TotalFee]=@tf,[Remark]=@rm
       WHERE [LogID]=@lid`,
      { lid:logId, deid:p.driverEmpId||'', denm:p.driverEmpName||'',
        aeid:p.assistantEmpId||'', aenm:p.assistantEmpName||'',
        df:parseFloat(p.driverFee)||0, af:parseFloat(p.assistantFee)||0,
        tf:parseFloat(p.totalFee)||(parseFloat(p.driverFee)||0)+(parseFloat(p.assistantFee)||0),
        rm:p.remark||'' }
    );
    return res.json({ success: true, message: 'อัปเดต Trip Log สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/trip-logs/delete', async (req, res) => {
  try {
    await execute('DELETE FROM dbo.TripLogs WHERE [LogID]=@lid', { lid: req.body.logId });
    return res.json({ success: true, message: 'ลบ Trip Log สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/employees/trip-report?yearMonth=05/2026
router.get('/trip-report', async (req, res) => {
  try {
    const { yearMonth } = req.query;
    if (!yearMonth) return res.json({ success: false, message: 'ระบุ yearMonth' });
    const [mm, yyyy] = yearMonth.split('/');
    const rows = await query("SELECT * FROM dbo.TripLogs WHERE [PlanDate] LIKE @ym",
      { ym: '%/' + mm + '/' + yyyy });
    const summary = { totalLogs: rows.length, totalFee: rows.reduce((s,r) => s + (parseFloat(r.TotalFee)||0), 0) };
    return res.json({ success: true, logs: rows, summary, yearMonth });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

module.exports = router;
