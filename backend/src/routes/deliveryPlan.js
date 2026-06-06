const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const { haversine } = require('../utils/geo');

router.use(authenticate);

// ── Nearest-Neighbor VRP ─────────────────────────────────────
function runVRP(depot, orders, vehicles) {
  const routes = [];
  const remaining = orders.map((o, i) => ({ ...o, _idx: i }));

  for (const vehicle of vehicles) {
    if (!remaining.length) break;
    const route = { vehicle, stops: [], totalQty: 0, totalDistKm: 0 };
    let cur = { lat: depot.lat, lng: depot.lng };

    while (remaining.length) {
      let best = null, bestDist = Infinity, bestI = -1;
      for (let i = 0; i < remaining.length; i++) {
        const o = remaining[i];
        if (!o.lat || !o.lng) continue;
        if (route.totalQty + (o.quantity || 0) > vehicle.capacityTon) continue;
        const d = haversine(cur.lat, cur.lng, o.lat, o.lng);
        if (d < bestDist) { bestDist = d; best = o; bestI = i; }
      }
      if (!best) break;
      route.stops.push({ ...best, distFromPrevKm: Math.round(bestDist * 10) / 10 });
      route.totalQty += best.quantity || 0;
      route.totalDistKm += bestDist;
      cur = { lat: best.lat, lng: best.lng };
      remaining.splice(bestI, 1);
    }

    if (route.stops.length) {
      route.totalDistKm += haversine(cur.lat, cur.lng, depot.lat, depot.lng);
      route.totalDistKm = Math.round(route.totalDistKm * 10) / 10;
      routes.push(route);
    }
  }

  return { routes, unassigned: remaining };
}

// ── DELIVERY ORDERS ──────────────────────────────────────────

router.get('/orders', async (req, res) => {
  try {
    const pool = getPool();
    const { status, warehouseId, date, search } = req.query;
    const r = pool.request();
    const conds = ['1=1'];
    if (status) { r.input('st', sql.NVarChar, status); conds.push('o.Status = @st'); }
    if (warehouseId) { r.input('wh', sql.Int, warehouseId); conds.push('o.WarehouseID = @wh'); }
    if (date) { r.input('dt', sql.Date, date); conds.push('CAST(o.RequestedDate AS DATE) = @dt'); }
    if (search) { r.input('s', sql.NVarChar, `%${search}%`); conds.push('(o.OrderCode LIKE @s OR c.CustomerName LIKE @s OR o.DeliveryAddress LIKE @s)'); }

    const result = await r.query(`
      SELECT o.OrderID, o.OrderCode, o.CustomerID, o.WarehouseID, o.ProductID,
        o.Quantity, o.Unit, o.DeliveryAddress, o.DeliveryLat, o.DeliveryLng,
        o.RequestedDate, o.TimeWindowStart, o.TimeWindowEnd, o.Status,
        o.Notes, o.CreatedAt,
        c.CustomerName, c.ARCode,
        w.WarehouseName,
        p.ProductName, p.ProductCode
      FROM WMS_DeliveryOrders o
      LEFT JOIN WMS_Customers c ON o.CustomerID = c.CustomerID
      LEFT JOIN WMS_Warehouses w ON o.WarehouseID = w.WarehouseID
      LEFT JOIN WMS_Products p ON o.ProductID = p.ProductID
      WHERE ${conds.join(' AND ')}
      ORDER BY o.RequestedDate DESC, o.OrderID DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/orders', async (req, res) => {
  try {
    const pool = getPool();
    const { customerId, warehouseId, productId, quantity, unit, deliveryAddress,
      deliveryLat, deliveryLng, requestedDate, timeWindowStart, timeWindowEnd, notes } = req.body;

    const dateStr = (requestedDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    const seq = await pool.request()
      .input('prefix', sql.NVarChar, `DO-${dateStr}-%`)
      .query('SELECT COUNT(*)+1 AS seq FROM WMS_DeliveryOrders WHERE OrderCode LIKE @prefix');
    const orderCode = `DO-${dateStr}-${String(seq.recordset[0].seq).padStart(3, '0')}`;

    const result = await pool.request()
      .input('code', sql.NVarChar, orderCode)
      .input('cid', sql.Int, customerId || null)
      .input('wh', sql.Int, warehouseId)
      .input('pid', sql.Int, productId || null)
      .input('qty', sql.Decimal(12, 3), parseFloat(quantity || 0))
      .input('unit', sql.NVarChar, unit || 'ตัน')
      .input('addr', sql.NVarChar, deliveryAddress || null)
      .input('lat', sql.Float, deliveryLat ? parseFloat(deliveryLat) : null)
      .input('lng', sql.Float, deliveryLng ? parseFloat(deliveryLng) : null)
      .input('rdate', sql.Date, requestedDate || new Date())
      .input('tw1', sql.NVarChar, timeWindowStart || null)
      .input('tw2', sql.NVarChar, timeWindowEnd || null)
      .input('notes', sql.NVarChar, notes || null)
      .input('op', sql.Int, req.user.UserID)
      .query(`
        INSERT INTO WMS_DeliveryOrders
          (OrderCode, CustomerID, WarehouseID, ProductID, Quantity, Unit,
           DeliveryAddress, DeliveryLat, DeliveryLng, RequestedDate,
           TimeWindowStart, TimeWindowEnd, Notes, CreatedBy)
        OUTPUT INSERTED.OrderID
        VALUES (@code, @cid, @wh, @pid, @qty, @unit, @addr, @lat, @lng,
                @rdate, @tw1, @tw2, @notes, @op)
      `);
    res.json({ success: true, orderId: result.recordset[0].OrderID, orderCode });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/orders/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { customerId, productId, quantity, unit, deliveryAddress,
      deliveryLat, deliveryLng, requestedDate, timeWindowStart, timeWindowEnd, notes, status } = req.body;
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('cid', sql.Int, customerId || null)
      .input('pid', sql.Int, productId || null)
      .input('qty', sql.Decimal(12, 3), parseFloat(quantity || 0))
      .input('unit', sql.NVarChar, unit || 'ตัน')
      .input('addr', sql.NVarChar, deliveryAddress || null)
      .input('lat', sql.Float, deliveryLat ? parseFloat(deliveryLat) : null)
      .input('lng', sql.Float, deliveryLng ? parseFloat(deliveryLng) : null)
      .input('rdate', sql.Date, requestedDate)
      .input('tw1', sql.NVarChar, timeWindowStart || null)
      .input('tw2', sql.NVarChar, timeWindowEnd || null)
      .input('notes', sql.NVarChar, notes || null)
      .input('st', sql.NVarChar, status || 'PENDING')
      .query(`
        UPDATE WMS_DeliveryOrders SET
          CustomerID=@cid, ProductID=@pid, Quantity=@qty, Unit=@unit,
          DeliveryAddress=@addr, DeliveryLat=@lat, DeliveryLng=@lng,
          RequestedDate=@rdate, TimeWindowStart=@tw1, TimeWindowEnd=@tw2,
          Notes=@notes, Status=@st
        WHERE OrderID=@id
      `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('id', sql.Int, req.params.id)
      .query("UPDATE WMS_DeliveryOrders SET Status='CANCELLED' WHERE OrderID=@id AND Status='PENDING'");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELIVERY PLANS ───────────────────────────────────────────

router.get('/plans', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT TOP 50 p.PlanID, p.PlanCode, p.PlanDate, p.Status, p.Notes, p.CreatedAt,
        w.WarehouseName,
        (SELECT COUNT(*) FROM WMS_DeliveryRoutes r WHERE r.PlanID = p.PlanID) AS RouteCount,
        (SELECT COUNT(*) FROM WMS_DeliveryRouteStops s
           JOIN WMS_DeliveryRoutes r ON s.RouteID = r.RouteID WHERE r.PlanID = p.PlanID) AS OrderCount
      FROM WMS_DeliveryPlans p
      LEFT JOIN WMS_Warehouses w ON p.WarehouseID = w.WarehouseID
      ORDER BY p.PlanDate DESC, p.PlanID DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/plans', async (req, res) => {
  try {
    const pool = getPool();
    const { warehouseId, planDate, notes } = req.body;
    const dateStr = (planDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    const seq = await pool.request()
      .input('prefix', sql.NVarChar, `PLN-${dateStr}-%`)
      .query('SELECT COUNT(*)+1 AS seq FROM WMS_DeliveryPlans WHERE PlanCode LIKE @prefix');
    const planCode = `PLN-${dateStr}-${String(seq.recordset[0].seq).padStart(3, '0')}`;

    const result = await pool.request()
      .input('code', sql.NVarChar, planCode)
      .input('wh', sql.Int, warehouseId)
      .input('date', sql.Date, planDate || new Date())
      .input('notes', sql.NVarChar, notes || null)
      .input('op', sql.Int, req.user.UserID)
      .query(`
        INSERT INTO WMS_DeliveryPlans (PlanCode, WarehouseID, PlanDate, Notes, CreatedBy)
        OUTPUT INSERTED.PlanID
        VALUES (@code, @wh, @date, @notes, @op)
      `);
    res.json({ success: true, planId: result.recordset[0].PlanID, planCode });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/plans/:id', async (req, res) => {
  try {
    const pool = getPool();
    const plan = await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT p.*, w.WarehouseName, w.GpsLat AS depotLat, w.GpsLng AS depotLng
      FROM WMS_DeliveryPlans p LEFT JOIN WMS_Warehouses w ON p.WarehouseID = w.WarehouseID
      WHERE p.PlanID = @id
    `);
    const [routes, allStops] = await Promise.all([
      pool.request().input('id', sql.Int, req.params.id).query(`
        SELECT r.RouteID, r.LicensePlate, r.DriverName, r.CapacityTon,
          r.TotalDistKm, r.TotalQty, r.Status,
          (SELECT COUNT(*) FROM WMS_DeliveryRouteStops s WHERE s.RouteID = r.RouteID) AS StopCount
        FROM WMS_DeliveryRoutes r WHERE r.PlanID = @id ORDER BY r.RouteID
      `),
      pool.request().input('id', sql.Int, req.params.id).query(`
        SELECT s.StopID, s.RouteID, s.StopSequence, s.EstimatedArrival, s.ActualArrival, s.Status,
          s.DistFromPrevKm, o.OrderCode, o.DeliveryAddress, o.DeliveryLat, o.DeliveryLng,
          o.Quantity, o.Unit, c.CustomerName
        FROM WMS_DeliveryRouteStops s
        JOIN WMS_DeliveryOrders o ON s.OrderID = o.OrderID
        LEFT JOIN WMS_Customers c ON o.CustomerID = c.CustomerID
        JOIN WMS_DeliveryRoutes r ON s.RouteID = r.RouteID
        WHERE r.PlanID = @id ORDER BY s.RouteID, s.StopSequence
      `)
    ]);
    const stopsByRoute = {};
    for (const stop of allStops.recordset) {
      if (!stopsByRoute[stop.RouteID]) stopsByRoute[stop.RouteID] = [];
      stopsByRoute[stop.RouteID].push(stop);
    }
    for (const route of routes.recordset) route.stops = stopsByRoute[route.RouteID] || [];
    res.json({ success: true, data: { ...plan.recordset[0], routes: routes.recordset } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/delivery/plans/:id/vrp - run VRP optimization
router.post('/plans/:id/vrp', async (req, res) => {
  try {
    const pool = getPool();
    const { vehicles } = req.body; // [{ licensePlate, driverName, capacityTon }]

    if (!vehicles || !vehicles.length) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรถอย่างน้อย 1 คัน' });
    }

    const plan = await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT p.*, w.GpsLat, w.GpsLng FROM WMS_DeliveryPlans p
      JOIN WMS_Warehouses w ON p.WarehouseID = w.WarehouseID
      WHERE p.PlanID = @id
    `);
    if (!plan.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบแผน' });
    const planRow = plan.recordset[0];

    const orders = await pool.request()
      .input('wh', sql.Int, planRow.WarehouseID)
      .input('date', sql.Date, planRow.PlanDate)
      .query(`
        SELECT o.OrderID, o.OrderCode, o.CustomerID, o.Quantity, o.DeliveryAddress,
          o.DeliveryLat AS lat, o.DeliveryLng AS lng,
          c.CustomerName
        FROM WMS_DeliveryOrders o
        LEFT JOIN WMS_Customers c ON o.CustomerID = c.CustomerID
        WHERE o.WarehouseID = @wh
          AND CAST(o.RequestedDate AS DATE) = @date
          AND o.Status = 'PENDING'
      `);

    if (!orders.recordset.length) {
      return res.status(400).json({ success: false, message: 'ไม่มีคำสั่งจัดส่ง PENDING สำหรับวันและคลังนี้' });
    }

    const depot = { lat: planRow.GpsLat || 13.7563, lng: planRow.GpsLng || 100.5018 };
    const vrpResult = runVRP(depot, orders.recordset, vehicles.map(v => ({
      ...v,
      capacityTon: parseFloat(v.capacityTon) || 20
    })));

    // Delete existing routes for this plan (batch, no per-route loop)
    await pool.request().input('id', sql.Int, req.params.id)
      .query('DELETE FROM WMS_DeliveryRouteStops WHERE RouteID IN (SELECT RouteID FROM WMS_DeliveryRoutes WHERE PlanID = @id)');
    await pool.request().input('id', sql.Int, req.params.id)
      .query('DELETE FROM WMS_DeliveryRoutes WHERE PlanID = @id');

    // Insert new routes
    for (const route of vrpResult.routes) {
      const routeResult = await pool.request()
        .input('planId', sql.Int, req.params.id)
        .input('plate', sql.NVarChar, route.vehicle.licensePlate)
        .input('driver', sql.NVarChar, route.vehicle.driverName || null)
        .input('cap', sql.Decimal(10, 2), route.vehicle.capacityTon)
        .input('dist', sql.Decimal(10, 2), route.totalDistKm)
        .input('qty', sql.Decimal(12, 3), route.totalQty)
        .query(`
          INSERT INTO WMS_DeliveryRoutes (PlanID, LicensePlate, DriverName, CapacityTon, TotalDistKm, TotalQty)
          OUTPUT INSERTED.RouteID
          VALUES (@planId, @plate, @driver, @cap, @dist, @qty)
        `);
      const routeId = routeResult.recordset[0].RouteID;

      if (route.stops.length > 0) {
        const stopReq = pool.request();
        const stopVals = route.stops.map((stop, i) => {
          stopReq.input(`rid${i}`, sql.Int, routeId);
          stopReq.input(`oid${i}`, sql.Int, stop.OrderID);
          stopReq.input(`seq${i}`, sql.Int, i + 1);
          stopReq.input(`dst${i}`, sql.Decimal(10, 2), stop.distFromPrevKm);
          return `(@rid${i}, @oid${i}, @seq${i}, @dst${i})`;
        });
        await stopReq.query(`INSERT INTO WMS_DeliveryRouteStops (RouteID, OrderID, StopSequence, DistFromPrevKm) VALUES ${stopVals.join(', ')}`);

        const orderReq = pool.request();
        const orderParams = route.stops.map((stop, i) => { orderReq.input(`ord${i}`, sql.Int, stop.OrderID); return `@ord${i}`; });
        await orderReq.query(`UPDATE WMS_DeliveryOrders SET Status='PLANNED' WHERE OrderID IN (${orderParams.join(',')})`);
      }
    }

    // Update plan status
    await pool.request().input('id', sql.Int, req.params.id)
      .query("UPDATE WMS_DeliveryPlans SET Status='DRAFT' WHERE PlanID=@id");

    res.json({
      success: true,
      message: `VRP สำเร็จ: ${vrpResult.routes.length} เส้นทาง, ${vrpResult.unassigned.length} คำสั่งที่จัดไม่ได้`,
      routeCount: vrpResult.routes.length,
      unassignedCount: vrpResult.unassigned.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/delivery/plans/:id/confirm
router.put('/plans/:id/confirm', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('id', sql.Int, req.params.id)
      .query("UPDATE WMS_DeliveryPlans SET Status='CONFIRMED' WHERE PlanID=@id");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/delivery/routes/:id/complete
router.put('/routes/:id/complete', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('id', sql.Int, req.params.id)
      .query("UPDATE WMS_DeliveryRoutes SET Status='COMPLETED' WHERE RouteID=@id");
    await pool.request().input('id', sql.Int, req.params.id)
      .query(`
        UPDATE WMS_DeliveryOrders SET Status='DELIVERED'
        WHERE OrderID IN (SELECT OrderID FROM WMS_DeliveryRouteStops WHERE RouteID=@id)
      `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
