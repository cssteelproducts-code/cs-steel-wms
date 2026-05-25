const router         = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query, execute } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
const { getTodayStr }    = require('./utils');
router.use(authMiddleware);

function rowToPlan(r) {
  let orders = [];
  try { orders = JSON.parse(r.OrdersJson || '[]'); } catch {}
  return {
    planId:        r.PlanID        || '',
    planDate:      r.PlanDate      || '',
    status:        r.Status        || '',
    fleetId:       r.FleetID       || '',
    licensePlate:  r.LicensePlate  || '',
    vehicleType:   r.VehicleType   || '',
    totalWeightKg: parseFloat(r.TotalWeightKg) || 0,
    totalOrders:   parseInt(r.TotalOrders)     || 0,
    orders,
    routeJson:     r.RouteJson     || '',
    remark:        r.Remark        || '',
    createdBy:     r.CreatedBy     || '',
    createdAt:     r.CreatedAt     || '',
    updatedAt:     r.UpdatedAt     || '',
  };
}

// GET /api/plans?planDate=&status=
router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM dbo.DeliveryPlans WHERE 1=1';
    const inputs = {};
    if (req.query.planDate) { sql += ' AND [PlanDate]=@pd'; inputs.pd = req.query.planDate; }
    if (req.query.status)   { sql += ' AND [Status]=@st';   inputs.st = req.query.status; }
    sql += ' ORDER BY [PlanDate] DESC,[CreatedAt] DESC';
    const rows = await query(sql, inputs);
    return res.json({ success: true, plans: rows.map(rowToPlan) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/plans/:planId
router.get('/:planId', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.DeliveryPlans WHERE [PlanID]=@pid', { pid: req.params.planId });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบ Plan' });
    return res.json({ success: true, plan: rowToPlan(rows[0]) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/plans/add — manual plan creation
router.post('/add', async (req, res) => {
  try {
    const p = req.body;
    const planId = 'PLN-' + uuidv4().slice(0, 8).toUpperCase();
    const now = new Date().toISOString();
    const ordersJson = JSON.stringify(p.orders || []);
    await execute(
      `INSERT INTO dbo.DeliveryPlans ([PlanID],[PlanDate],[Status],[FleetID],[LicensePlate],[VehicleType],
       [TotalWeightKg],[TotalOrders],[OrdersJson],[RouteJson],[Remark],[CreatedBy],[CreatedAt],[UpdatedAt])
       VALUES (@pid,@pd,N'ร่าง',@fid,@lp,@vt,@wt,@cnt,@oj,@rj,@rm,@cb,@ca,@ua)`,
      { pid: planId, pd: p.planDate || getTodayStr(), fid: p.fleetId || '',
        lp: p.licensePlate || '', vt: p.vehicleType || '',
        wt: parseFloat(p.totalWeightKg) || 0,
        cnt: (p.orders || []).length,
        oj: ordersJson, rj: p.routeJson || '', rm: p.remark || '',
        cb: req.user.username, ca: now, ua: now }
    );
    return res.json({ success: true, planId, message: 'สร้าง Plan สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/plans/update
router.post('/update', async (req, res) => {
  try {
    const { planId, ...p } = req.body;
    const ordersJson = JSON.stringify(p.orders || []);
    await execute(
      `UPDATE dbo.DeliveryPlans SET [PlanDate]=@pd,[FleetID]=@fid,[LicensePlate]=@lp,[VehicleType]=@vt,
       [TotalWeightKg]=@wt,[TotalOrders]=@cnt,[OrdersJson]=@oj,[RouteJson]=@rj,[Remark]=@rm,[UpdatedAt]=@ua
       WHERE [PlanID]=@pid`,
      { pid: planId, pd: p.planDate || '', fid: p.fleetId || '',
        lp: p.licensePlate || '', vt: p.vehicleType || '',
        wt: parseFloat(p.totalWeightKg) || 0,
        cnt: (p.orders || []).length,
        oj: ordersJson, rj: p.routeJson || '', rm: p.remark || '',
        ua: new Date().toISOString() }
    );
    return res.json({ success: true, message: 'อัปเดต Plan สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/plans/confirm
router.post('/confirm', async (req, res) => {
  try {
    const { planId } = req.body;
    const rows = await query('SELECT * FROM dbo.DeliveryPlans WHERE [PlanID]=@pid', { pid: planId });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบ Plan' });
    const plan = rowToPlan(rows[0]);
    await execute(
      "UPDATE dbo.DeliveryPlans SET [Status]=N'ยืนยัน',[UpdatedAt]=@ua WHERE [PlanID]=@pid",
      { pid: planId, ua: new Date().toISOString() }
    );
    for (const order of plan.orders) {
      await execute(
        "UPDATE dbo.DeliveryOrders SET [Status]=N'มอบหมายแล้ว',[AssignedPlanID]=@pid WHERE [OrderID]=@oid",
        { pid: planId, oid: order.orderId || order }
      );
    }
    return res.json({ success: true, message: 'ยืนยัน Plan สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/plans/start-delivery
router.post('/start-delivery', async (req, res) => {
  try {
    const { planId } = req.body;
    await execute(
      "UPDATE dbo.DeliveryPlans SET [Status]=N'กำลังจัดส่ง',[UpdatedAt]=@ua WHERE [PlanID]=@pid",
      { pid: planId, ua: new Date().toISOString() }
    );
    return res.json({ success: true, message: 'เริ่มจัดส่งสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/plans/complete
router.post('/complete', async (req, res) => {
  try {
    const { planId } = req.body;
    const rows = await query('SELECT * FROM dbo.DeliveryPlans WHERE [PlanID]=@pid', { pid: planId });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบ Plan' });
    const plan = rowToPlan(rows[0]);
    await execute(
      "UPDATE dbo.DeliveryPlans SET [Status]=N'จัดส่งเสร็จ',[UpdatedAt]=@ua WHERE [PlanID]=@pid",
      { pid: planId, ua: new Date().toISOString() }
    );
    for (const order of plan.orders) {
      await execute(
        "UPDATE dbo.DeliveryOrders SET [Status]=N'จัดส่งแล้ว' WHERE [OrderID]=@oid",
        { oid: order.orderId || order }
      );
    }
    return res.json({ success: true, message: 'ปิด Plan สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/plans/cancel
router.post('/cancel', async (req, res) => {
  try {
    const { planId } = req.body;
    const rows = await query('SELECT * FROM dbo.DeliveryPlans WHERE [PlanID]=@pid', { pid: planId });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบ Plan' });
    const plan = rowToPlan(rows[0]);
    await execute(
      "UPDATE dbo.DeliveryPlans SET [Status]=N'ยกเลิก',[UpdatedAt]=@ua WHERE [PlanID]=@pid",
      { pid: planId, ua: new Date().toISOString() }
    );
    for (const order of plan.orders) {
      await execute(
        "UPDATE dbo.DeliveryOrders SET [Status]=N'รอมอบหมาย',[AssignedPlanID]=N'' WHERE [OrderID]=@oid",
        { oid: order.orderId || order }
      );
    }
    return res.json({ success: true, message: 'ยกเลิก Plan สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/plans/delete
router.post('/delete', async (req, res) => {
  try {
    await execute('DELETE FROM dbo.DeliveryPlans WHERE [PlanID]=@pid', { pid: req.body.planId });
    return res.json({ success: true, message: 'ลบ Plan สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/plans/vrp — Clarke-Wright savings VRP
router.post('/vrp', async (req, res) => {
  try {
    const { orders, vehicles, depotLat, depotLng } = req.body;
    if (!orders?.length || !vehicles?.length) {
      return res.json({ success: false, message: 'ต้องการ orders และ vehicles' });
    }
    const depot = { lat: parseFloat(depotLat) || 13.7563, lng: parseFloat(depotLng) || 100.5018 };
    const routes = clarkeWright(orders, vehicles, depot);
    return res.json({ success: true, routes });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/plans/assign-order
router.post('/assign-order', async (req, res) => {
  try {
    const { planId, orderId } = req.body;
    const rows = await query('SELECT * FROM dbo.DeliveryPlans WHERE [PlanID]=@pid', { pid: planId });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบ Plan' });
    const plan = rowToPlan(rows[0]);
    if (!plan.orders.find(o => (o.orderId || o) === orderId)) {
      plan.orders.push({ orderId });
    }
    await execute(
      'UPDATE dbo.DeliveryPlans SET [OrdersJson]=@oj,[TotalOrders]=@cnt,[UpdatedAt]=@ua WHERE [PlanID]=@pid',
      { oj: JSON.stringify(plan.orders), cnt: plan.orders.length,
        ua: new Date().toISOString(), pid: planId }
    );
    await execute(
      "UPDATE dbo.DeliveryOrders SET [Status]=N'มอบหมายแล้ว',[AssignedPlanID]=@pid WHERE [OrderID]=@oid",
      { pid: planId, oid: orderId }
    );
    return res.json({ success: true, message: 'เพิ่ม Order ใน Plan สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/plans/remove-order
router.post('/remove-order', async (req, res) => {
  try {
    const { planId, orderId } = req.body;
    const rows = await query('SELECT * FROM dbo.DeliveryPlans WHERE [PlanID]=@pid', { pid: planId });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบ Plan' });
    const plan = rowToPlan(rows[0]);
    plan.orders = plan.orders.filter(o => (o.orderId || o) !== orderId);
    await execute(
      'UPDATE dbo.DeliveryPlans SET [OrdersJson]=@oj,[TotalOrders]=@cnt,[UpdatedAt]=@ua WHERE [PlanID]=@pid',
      { oj: JSON.stringify(plan.orders), cnt: plan.orders.length,
        ua: new Date().toISOString(), pid: planId }
    );
    await execute(
      "UPDATE dbo.DeliveryOrders SET [Status]=N'รอมอบหมาย',[AssignedPlanID]=N'' WHERE [OrderID]=@oid",
      { oid: orderId }
    );
    return res.json({ success: true, message: 'นำ Order ออกจาก Plan สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// ==================== Clarke-Wright Savings VRP ====================
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clarkeWright(orders, vehicles, depot) {
  const nodes = orders.filter(o => o.lat && o.lng);
  if (!nodes.length) return vehicles.map(v => ({ vehicle: v, orders: [], totalWeightKg: 0 }));

  const distDepot = nodes.map(n => haversineKm(depot.lat, depot.lng, n.lat, n.lng));

  const savings = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const s = distDepot[i] + distDepot[j] - haversineKm(nodes[i].lat, nodes[i].lng, nodes[j].lat, nodes[j].lng);
      savings.push({ i, j, s });
    }
  }
  savings.sort((a, b) => b.s - a.s);

  const routes = vehicles.map(v => ({
    vehicle: v,
    orders: [],
    totalWeightKg: 0,
  }));

  const assigned = new Set();
  const nodeRoute = {};

  for (const { i, j } of savings) {
    if (assigned.has(i) && assigned.has(j)) continue;
    const ri = assigned.has(i) ? nodeRoute[i] : null;
    const rj = assigned.has(j) ? nodeRoute[j] : null;
    if (ri !== null && rj !== null && ri !== rj) continue;

    const targetRoute = routes.find(r => {
      const cap = r.vehicle.weightCapacityKg || 99999;
      const wouldAdd = (!assigned.has(i) ? nodes[i].weightKg || 0 : 0) +
                       (!assigned.has(j) ? nodes[j].weightKg || 0 : 0);
      return r.totalWeightKg + wouldAdd <= cap;
    });
    if (!targetRoute) continue;

    const ridx = routes.indexOf(targetRoute);
    if (!assigned.has(i)) {
      targetRoute.orders.push(nodes[i]);
      targetRoute.totalWeightKg += nodes[i].weightKg || 0;
      assigned.add(i);
      nodeRoute[i] = ridx;
    }
    if (!assigned.has(j)) {
      targetRoute.orders.push(nodes[j]);
      targetRoute.totalWeightKg += nodes[j].weightKg || 0;
      assigned.add(j);
      nodeRoute[j] = ridx;
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    if (!assigned.has(i)) {
      const target = routes.find(r => r.totalWeightKg + (nodes[i].weightKg || 0) <= (r.vehicle.weightCapacityKg || 99999));
      if (target) {
        target.orders.push(nodes[i]);
        target.totalWeightKg += nodes[i].weightKg || 0;
      } else {
        routes[0].orders.push(nodes[i]);
      }
    }
  }

  return routes;
}

// GET /api/plans/confirmed-today  (แผนที่ confirm แล้วสำหรับวันนี้)
router.get('/confirmed-today', async (req, res) => {
  try {
    const today = getTodayStr();
    const rows  = await query(
      "SELECT * FROM dbo.DeliveryPlans WHERE [PlanDate]=@d AND [Status] IN (N'ยืนยัน',N'กำลังส่ง')",
      { d: today }
    );
    const plans = rows.map(r => {
      const p = rowToPlan(r);
      const customerNames = [...new Set(
        (p.orders || []).map(o => (o.arname || o.customerName || '').trim()).filter(Boolean)
      )];
      return { ...p, orderCount: p.orders.length, customerNames };
    });
    return res.json({ success: true, plans, planDate: today });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/plans/station-queues  (คิวที่สถานี — เหมือน GAS: activePlanned + exitedAt cross-check)
router.get('/station-queues', async (req, res) => {
  try {
    const today = getTodayStr();

    const [truckRows, stationRows] = await Promise.all([
      query(
        "SELECT [ID],[LicensePlate],[VehicleType],[Arname],[Arcode],[PlannedStations],[CheckoutTime],[Status] FROM dbo.Trucks WHERE [Date]=@d AND [Status]<>N'ดำเนินการเสร็จสิ้น' AND ISNULL([PlannedStations],N'')<>N''",
        { d: today }
      ),
      query(
        "SELECT [TruckID],[StationName],[ExitTime] FROM dbo.LoadingStations WHERE [TruckID] IN (SELECT [ID] FROM dbo.Trucks WHERE [Date]=@d)",
        { d: today }
      ),
    ]);

    // build exitedAt set: truckId|stationName → true
    const exitedAt = {};
    stationRows.forEach(sr => {
      const exit = (sr.ExitTime || '').toString().trim();
      if (exit) exitedAt[(sr.TruckID || '') + '|' + (sr.StationName || '')] = true;
    });

    // stationQueues: stationName → { count, trucks[] }
    const stationQueues = {};
    truckRows.forEach(r => {
      const tid    = (r.ID || '').toString();
      const lp     = (r.LicensePlate || '').toString();
      const vt     = (r.VehicleType  || '').toString();
      const arn    = (r.Arname       || '').toString();
      const arc    = (r.Arcode       || '').toString();
      const planned = (r.PlannedStations || '').toString().split(',').map(s => s.trim()).filter(Boolean);
      planned.forEach(stName => {
        if (!exitedAt[tid + '|' + stName]) {
          if (!stationQueues[stName]) stationQueues[stName] = { stationName: stName, count: 0, trucks: [] };
          stationQueues[stName].count++;
          stationQueues[stName].trucks.push({ truckId: tid, licensePlate: lp, vehicleType: vt, arname: arn, arcode: arc });
        }
      });
    });

    return res.json({ success: true, queues: Object.values(stationQueues).sort((a, b) => b.count - a.count) });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/plans/vrp-settings
router.get('/vrp-settings', async (req, res) => {
  try {
    const rows = await query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'VRP_SETTINGS'").catch(() => []);
    let settings = {};
    if (rows.length && rows[0].Value) {
      try { settings = JSON.parse(rows[0].Value); } catch {}
    }
    return res.json({ success: true, settings });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/plans/vrp-settings
router.post('/vrp-settings', async (req, res) => {
  try {
    const { settings } = req.body;
    const val  = JSON.stringify(settings || {});
    const rows = await query("SELECT [Key] FROM dbo.AppConfig WHERE [Key]=N'VRP_SETTINGS'").catch(() => []);
    if (rows.length) {
      await execute("UPDATE dbo.AppConfig SET [Value]=@v,[UpdatedAt]=@ua WHERE [Key]=N'VRP_SETTINGS'",
        { v: val, ua: new Date().toISOString() });
    } else {
      await execute("INSERT INTO dbo.AppConfig ([Key],[Value],[UpdatedAt]) VALUES (N'VRP_SETTINGS',@v,@ua)",
        { v: val, ua: new Date().toISOString() });
    }
    return res.json({ success: true, message: 'บันทึก VRP Settings สำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/plans/kpi-report?month=MM/YYYY
router.get('/kpi-report', async (req, res) => {
  try {
    const month = (req.query.month || '').toString();
    let sql = "SELECT p.*,o.[DeliveryZone],o.[ProductType],o.[WeightKg] FROM dbo.DeliveryPlans p LEFT JOIN dbo.DeliveryOrders o ON o.[PlanID]=p.[PlanID] WHERE p.[Status]=N'ส่งแล้ว'";
    const inputs = {};
    if (month) { sql += ' AND p.[PlanDate] LIKE @pat'; inputs.pat = '%/' + month; }
    const rows = await query(sql, inputs);
    return res.json({ success: true, rows });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// GET /api/plans/:planId/export
router.get('/:planId/export', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM dbo.DeliveryPlans WHERE [PlanID]=@pid', { pid: req.params.planId });
    if (!rows.length) return res.json({ success: false, message: 'ไม่พบ Plan' });
    const plan    = rowToPlan(rows[0]);
    const orderRows = await query(
      'SELECT * FROM dbo.DeliveryOrders WHERE [PlanID]=@pid',
      { pid: req.params.planId }
    ).catch(() => []);
    return res.json({ success: true, plan, orders: orderRows });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

module.exports = router;
