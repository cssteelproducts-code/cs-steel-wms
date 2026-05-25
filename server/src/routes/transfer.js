const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query, execute } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// ==================== Transfer Tasks ====================
router.get('/tasks', async (req, res) => {
  try {
    let sql = 'SELECT * FROM dbo.TransferTasks WHERE 1=1';
    const inputs = {};
    if (req.query.status) { sql += ' AND [Status]=@st'; inputs.st = req.query.status; }
    if (req.query.date)   { sql += ' AND CAST([CreatedAt] AS DATE)=@dt'; inputs.dt = req.query.date; }
    sql += ' ORDER BY [CreatedAt] DESC';
    const rows = await query(sql, inputs);
    return res.json({ success: true, tasks: rows.map(rowToTask) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.get('/tasks/:taskId', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.TransferTasks WHERE [TaskID]=@id', { id: req.params.taskId });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบงานโอน' });
    return res.json({ success: true, task: rowToTask(rows[0]) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/tasks/add', async (req, res) => {
  try {
    const p = req.body;
    const taskId = 'TRF-' + uuidv4().slice(0, 8).toUpperCase();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO dbo.TransferTasks ([TaskID],[FromLocationID],[ToLocationID],[SkuCode],[SkuName],
       [Quantity],[Unit],[Status],[Priority],[AssignedVehicle],[RequestedBy],[CreatedAt],[Remark])
       VALUES (@id,@from,@to,@sku,@nm,@qty,@un,N'รอดำเนินการ',@pri,@veh,@rb,@ra,@rm)`,
      { id: taskId, from: p.fromLocationId || '', to: p.toLocationId || '',
        sku: p.skuCode || '', nm: p.skuName || '',
        qty: parseFloat(p.quantity) || 0, un: p.unit || '',
        pri: parseInt(p.priority) || 2, veh: p.assignedVehicle || '',
        rb: req.user.username, ra: now, rm: p.remark || '' }
    );
    return res.json({ success: true, taskId, message: 'สร้างงานโอนสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/tasks/update', async (req, res) => {
  try {
    const { taskId, ...p } = req.body;
    await execute(
      `UPDATE dbo.TransferTasks SET [FromLocationID]=@from,[ToLocationID]=@to,[SkuCode]=@sku,
       [SkuName]=@nm,[Quantity]=@qty,[Unit]=@un,[Priority]=@pri,[AssignedVehicle]=@veh,[Remark]=@rm
       WHERE [TaskID]=@id`,
      { id: taskId, from: p.fromLocationId || '', to: p.toLocationId || '',
        sku: p.skuCode || '', nm: p.skuName || '',
        qty: parseFloat(p.quantity) || 0, un: p.unit || '',
        pri: parseInt(p.priority) || 2, veh: p.assignedVehicle || '', rm: p.remark || '' }
    );
    return res.json({ success: true, message: 'อัปเดตงานโอนสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/tasks/start', async (req, res) => {
  try {
    const { taskId, assignedVehicle } = req.body;
    const now = new Date().toISOString();
    await execute(
      "UPDATE dbo.TransferTasks SET [Status]=N'กำลังโอน',[AssignedVehicle]=@veh,[StartedAt]=@sa WHERE [TaskID]=@id",
      { id: taskId, veh: assignedVehicle || '', sa: now }
    );
    return res.json({ success: true, message: 'เริ่มงานโอนสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/tasks/complete', async (req, res) => {
  try {
    const { taskId, actualQuantity } = req.body;
    const now = new Date().toISOString();
    const rows = await query('SELECT * FROM dbo.TransferTasks WHERE [TaskID]=@id', { id: taskId });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบงานโอน' });
    const task = rows[0];
    await execute(
      "UPDATE dbo.TransferTasks SET [Status]=N'เสร็จสิ้น',[ActualQuantity]=@aq,[CompletedAt]=@ca WHERE [TaskID]=@id",
      { id: taskId, aq: parseFloat(actualQuantity) || parseFloat(task.Quantity) || 0, ca: now }
    );
    return res.json({ success: true, message: 'งานโอนเสร็จสิ้น' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/tasks/cancel', async (req, res) => {
  try {
    await execute(
      "UPDATE dbo.TransferTasks SET [Status]=N'ยกเลิก' WHERE [TaskID]=@id",
      { id: req.body.taskId }
    );
    return res.json({ success: true, message: 'ยกเลิกงานโอนสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/tasks/delete', async (req, res) => {
  try {
    await execute('DELETE FROM dbo.TransferTasks WHERE [TaskID]=@id', { id: req.body.taskId });
    return res.json({ success: true, message: 'ลบงานโอนสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// ==================== Transfer Vehicles ====================
router.get('/vehicles', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.TransferVehicles ORDER BY [LicensePlate]');
    return res.json({ success: true, vehicles: rows.map(r => ({
      vehicleId:    r.VehicleID    || '',
      licensePlate: r.LicensePlate || '',
      vehicleType:  r.VehicleType  || '',
      driverName:   r.DriverName   || '',
      phone:        r.Phone        || '',
      status:       r.Status       || 'ว่าง',
      remark:       r.Remark       || '',
    })) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/vehicles/add', async (req, res) => {
  try {
    const p = req.body;
    const vehicleId = 'TV-' + uuidv4().slice(0, 6).toUpperCase();
    await execute(
      `INSERT INTO dbo.TransferVehicles ([VehicleID],[LicensePlate],[VehicleType],[DriverName],[Phone],[Status],[Remark])
       VALUES (@id,@lp,@vt,@dn,@ph,@st,@rm)`,
      { id: vehicleId, lp: (p.licensePlate || '').toUpperCase(), vt: p.vehicleType || '',
        dn: p.driverName || '', ph: p.phone || '', st: p.status || 'ว่าง', rm: p.remark || '' }
    );
    return res.json({ success: true, vehicleId, message: 'เพิ่มยานพาหนะสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/vehicles/update', async (req, res) => {
  try {
    const { vehicleId, ...p } = req.body;
    await execute(
      'UPDATE dbo.TransferVehicles SET [LicensePlate]=@lp,[VehicleType]=@vt,[DriverName]=@dn,[Phone]=@ph,[Status]=@st,[Remark]=@rm WHERE [VehicleID]=@id',
      { id: vehicleId, lp: (p.licensePlate || '').toUpperCase(), vt: p.vehicleType || '',
        dn: p.driverName || '', ph: p.phone || '', st: p.status || 'ว่าง', rm: p.remark || '' }
    );
    return res.json({ success: true, message: 'อัปเดตยานพาหนะสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

router.post('/vehicles/delete', async (req, res) => {
  try {
    await execute('DELETE FROM dbo.TransferVehicles WHERE [VehicleID]=@id', { id: req.body.vehicleId });
    return res.json({ success: true, message: 'ลบยานพาหนะสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

function rowToTask(r) {
  return {
    taskId:         r.TaskID         || '',
    fromLocationId: r.FromLocationID || '',
    toLocationId:   r.ToLocationID   || '',
    skuCode:        r.SkuCode        || '',
    skuName:        r.SkuName        || '',
    quantity:       parseFloat(r.Quantity)       || 0,
    actualQuantity: parseFloat(r.ActualQuantity) || 0,
    unit:           r.Unit           || '',
    status:         r.Status         || '',
    priority:       parseInt(r.Priority)         || 2,
    assignedVehicle:r.AssignedVehicle|| '',
    requestedBy:    r.RequestedBy    || '',
    createdAt:      r.CreatedAt    || '',
    startedAt:      r.StartedAt      || '',
    completedAt:    r.CompletedAt    || '',
    remark:         r.Remark         || '',
  };
}

// GET /api/transfer/monitor?date=
router.get('/monitor', async (req, res) => {
  try {
    const date  = (req.query.date || '').toString();
    let sql     = 'SELECT * FROM dbo.TransferTasks WHERE 1=1';
    const inputs = {};
    if (date) { sql += ' AND ([CreatedAt] LIKE @pat OR [StartedAt] LIKE @pat OR [CompletedAt] LIKE @pat)'; inputs.pat = date + '%'; }
    sql += ' ORDER BY [CreatedAt] DESC';
    const rows  = await query(sql, inputs);
    const tasks = rows.map(rowToTask);
    return res.json({
      success: true,
      activeTasks:    tasks.filter(t => ['รอมอบหมาย','กำลังดำเนินการ'].includes(t.status)),
      completedTasks: tasks.filter(t => t.status === 'สำเร็จ'),
      cancelledTasks: tasks.filter(t => t.status === 'ยกเลิก'),
    });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/transfer/drivers
router.get('/drivers', async (req, res) => {
  try {
    const rows = await query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'TRANSFER_DRIVERS'").catch(() => []);
    let drivers = [];
    if (rows.length && rows[0].Value) {
      try { drivers = JSON.parse(rows[0].Value); } catch {}
    }
    return res.json({ success: true, drivers });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/transfer/drivers/save
router.post('/drivers/save', async (req, res) => {
  try {
    const { drivers } = req.body;
    const val  = JSON.stringify(Array.isArray(drivers) ? drivers : []);
    const rows = await query("SELECT [Key] FROM dbo.AppConfig WHERE [Key]=N'TRANSFER_DRIVERS'").catch(() => []);
    if (rows.length) {
      await execute("UPDATE dbo.AppConfig SET [Value]=@v,[UpdatedAt]=@ua WHERE [Key]=N'TRANSFER_DRIVERS'",
        { v: val, ua: new Date().toISOString() });
    } else {
      await execute("INSERT INTO dbo.AppConfig ([Key],[Value],[UpdatedAt]) VALUES (N'TRANSFER_DRIVERS',@v,@ua)",
        { v: val, ua: new Date().toISOString() });
    }
    return res.json({ success: true, message: 'บันทึก drivers แล้ว' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/transfer/station-log
router.post('/station-log', async (req, res) => {
  try {
    const { taskId, stationName, entryTime, exitTime, note } = req.body;
    if (!taskId) return res.json({ success: false, message: 'ระบุ taskId' });
    const rows = await query('SELECT [StationLogs] FROM dbo.TransferTasks WHERE [TaskID]=@id', { id: taskId });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบ task' });
    let logs = [];
    try { logs = JSON.parse(rows[0].StationLogs || '[]'); } catch {}
    logs.push({ stationName, entryTime, exitTime, note, ts: new Date().toISOString() });
    await execute('UPDATE dbo.TransferTasks SET [StationLogs]=@sl WHERE [TaskID]=@id',
      { sl: JSON.stringify(logs), id: taskId });
    return res.json({ success: true, message: 'บันทึก log แล้ว' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/transfer/vehicles/status
router.post('/vehicles/status', async (req, res) => {
  try {
    const { vehicleId, status } = req.body;
    if (!vehicleId || !status) return res.json({ success: false, message: 'ระบุ vehicleId และ status' });
    await execute('UPDATE dbo.TransferVehicles SET [Status]=@st WHERE [VehicleID]=@id',
      { st: status, id: vehicleId });
    return res.json({ success: true, message: 'อัปเดต status แล้ว' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/transfer/settings
router.get('/settings', async (req, res) => {
  try {
    const rows = await query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'TRANSFER_SETTINGS'").catch(() => []);
    let settings = {};
    if (rows.length && rows[0].Value) {
      try { settings = JSON.parse(rows[0].Value); } catch {}
    }
    return res.json({ success: true, settings });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/transfer/settings
router.post('/settings', async (req, res) => {
  try {
    const val  = JSON.stringify(req.body || {});
    const rows = await query("SELECT [Key] FROM dbo.AppConfig WHERE [Key]=N'TRANSFER_SETTINGS'").catch(() => []);
    if (rows.length) {
      await execute("UPDATE dbo.AppConfig SET [Value]=@v,[UpdatedAt]=@ua WHERE [Key]=N'TRANSFER_SETTINGS'",
        { v: val, ua: new Date().toISOString() });
    } else {
      await execute("INSERT INTO dbo.AppConfig ([Key],[Value],[UpdatedAt]) VALUES (N'TRANSFER_SETTINGS',@v,@ua)",
        { v: val, ua: new Date().toISOString() });
    }
    return res.json({ success: true, message: 'บันทึก settings แล้ว' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/transfer/report?month=MM/YYYY
router.get('/report', async (req, res) => {
  try {
    const month = (req.query.month || '').toString();
    let sql = 'SELECT * FROM dbo.TransferTasks WHERE 1=1';
    const inputs = {};
    if (month) { sql += ' AND ([CreatedAt] LIKE @pat OR [CompletedAt] LIKE @pat)'; inputs.pat = '%' + month + '%'; }
    const rows = await query(sql, inputs);
    return res.json({ success: true, tasks: rows.map(rowToTask) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

module.exports = router;
