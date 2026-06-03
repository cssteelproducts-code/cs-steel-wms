const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── helpers ─────────────────────────────────────────────────────────────────
const parseExcelDate = (v) => {
  if (!v) return null;
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  return null;
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── ensure tables ────────────────────────────────────────────────────────────
let ready = false;
const ensureTables = async () => {
  if (ready) return;
  const pool = getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_TMS_Orders' AND xtype='U')
    CREATE TABLE WMS_TMS_Orders (
      TmsOrderID   INT IDENTITY(1,1) PRIMARY KEY,
      SourceOrderNo NVARCHAR(50),  PoNo NVARCHAR(100),
      CustCode     NVARCHAR(50),   CustName NVARCHAR(200),
      DeliveryAddr NVARCHAR(500),  City NVARCHAR(100),
      Province     NVARCHAR(100),  PostalCode NVARCHAR(20),
      OrderDate    DATE,           ShipByDate DATE,
      ShipType     NVARCHAR(100),  DistanceKm DECIMAL(10,2) DEFAULT 0,
      TotalWeightKg DECIMAL(12,3) DEFAULT 0,
      TotalQty     DECIMAL(12,3) DEFAULT 0,
      Status       NVARCHAR(20)  DEFAULT N'PENDING',
      ImportBatch  NVARCHAR(100),
      CreatedAt    DATETIME DEFAULT GETDATE()
    );
    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_TMS_OrderLines' AND xtype='U')
    CREATE TABLE WMS_TMS_OrderLines (
      LineID       INT IDENTITY(1,1) PRIMARY KEY,
      TmsOrderID   INT NOT NULL,   LineNo INT DEFAULT 0,
      PartCode     NVARCHAR(100),  PartDesc NVARCHAR(300),
      Qty          DECIMAL(12,3) DEFAULT 0,
      UOM          NVARCHAR(20),
      WeightPerUnit DECIMAL(10,3) DEFAULT 0,
      TotalWeightKg DECIMAL(12,3) DEFAULT 0,
      ItemLength   DECIMAL(8,3),  ItemWidth DECIMAL(8,3),
      ItemHeight   DECIMAL(8,3)
    );
    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_TMS_Plans' AND xtype='U')
    CREATE TABLE WMS_TMS_Plans (
      PlanID    INT IDENTITY(1,1) PRIMARY KEY,
      PlanCode  NVARCHAR(50) NOT NULL,
      PlanDate  DATE,
      Status    NVARCHAR(20) DEFAULT N'DRAFT',
      Notes     NVARCHAR(500),
      CreatedBy INT,
      CreatedAt DATETIME DEFAULT GETDATE()
    );
    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_TMS_Trips' AND xtype='U')
    CREATE TABLE WMS_TMS_Trips (
      TripID        INT IDENTITY(1,1) PRIMARY KEY,
      PlanID        INT NOT NULL,   TripNo INT DEFAULT 1,
      VehicleID     INT,            LicensePlate NVARCHAR(20),
      DriverName    NVARCHAR(100),  PayloadKg DECIMAL(10,2),
      BedLength     DECIMAL(8,3),   BedWidth DECIMAL(8,3),
      TotalStops    INT DEFAULT 0,  TotalDistKm DECIMAL(10,2) DEFAULT 0,
      TotalWeightKg DECIMAL(12,3) DEFAULT 0,
      Status        NVARCHAR(20) DEFAULT N'DRAFT'
    );
    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_TMS_TripStops' AND xtype='U')
    CREATE TABLE WMS_TMS_TripStops (
      StopID      INT IDENTITY(1,1) PRIMARY KEY,
      TripID      INT NOT NULL,   StopNo INT NOT NULL,
      TmsOrderID  INT NOT NULL,   DistFromPrevKm DECIMAL(10,2) DEFAULT 0,
      Status      NVARCHAR(20) DEFAULT N'PENDING'
    );
  `);
  // Add product dimension columns if not exist
  await pool.request().query(`
    IF COL_LENGTH('WMS_Products','ItemLength') IS NULL ALTER TABLE WMS_Products ADD ItemLength DECIMAL(8,3) NULL;
    IF COL_LENGTH('WMS_Products','ItemWidth')  IS NULL ALTER TABLE WMS_Products ADD ItemWidth  DECIMAL(8,3) NULL;
    IF COL_LENGTH('WMS_Products','ItemHeight') IS NULL ALTER TABLE WMS_Products ADD ItemHeight DECIMAL(8,3) NULL;
  `);
  ready = true;
};

// ─── middleware ───────────────────────────────────────────────────────────────
router.use(async (req, res, next) => {
  try { await ensureTables(); next(); } catch (e) { next(e); }
});

// ═══ ORDERS ══════════════════════════════════════════════════════════════════

// POST /api/tms/import — parse Excel and insert orders+lines
router.post('/import', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาแนบไฟล์ Excel' });
    const pool = getPool();
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) return res.status(400).json({ success: false, message: 'ไฟล์ไม่มีข้อมูล' });

    const header = rows[0].map(h => String(h));
    const col = (names) => {
      for (const n of names) {
        const i = header.findIndex(h => h.toLowerCase().includes(n.toLowerCase()));
        if (i >= 0) return i;
      }
      return -1;
    };
    const C = {
      orderDate: col(['order date']) >= 0 ? col(['order date']) : 2,
      po:        col(['po']) >= 0 ? col(['po']) : 3,
      custId:    col(['cust. id', 'cust id']) >= 0 ? col(['cust. id', 'cust id']) : 4,
      custName:  col(['name']) >= 0 ? col(['name']) : 5,
      addr1: 6, addr2: 7, addr3: 8, city: 9, province: 10, postal: 12,
      orderNo:   col(['order']) >= 0 ? col(['order']) : 13,
      lineNo: 14,
      part:      col(['part']) >= 0 ? col(['part']) : 16,
      partDesc:  col(['part description']) >= 0 ? col(['part description']) : 17,
      unitWt:    col(['unit net weight']) >= 0 ? col(['unit net weight']) : 19,
      qty:       col(['order quantity']) >= 0 ? col(['order quantity']) : 20,
      uom: 21,
      shipBy:    col(['ship by']) >= 0 ? col(['ship by']) : 30,
      shipType:  col(['ประเภทการจัดส่ง']) >= 0 ? col(['ประเภทการจัดส่ง']) : 32,
      distKm:    col(['ระยะทาง']) >= 0 ? col(['ระยะทาง']) : 34,
    };

    const batch = `B${Date.now()}`;
    const ordersMap = new Map();

    for (const row of rows.slice(1)) {
      const orderNo = String(row[C.orderNo] || '').trim();
      if (!orderNo) continue;
      if (!ordersMap.has(orderNo)) {
        ordersMap.set(orderNo, {
          orderNo,
          poNo: String(row[C.po] || '').trim(),
          custCode: String(row[C.custId] || '').trim(),
          custName: String(row[C.custName] || '').trim(),
          addr: [row[C.addr1], row[C.addr2], row[C.addr3]].filter(a => a && a !== '-').join(' ').trim(),
          city: String(row[C.city] || '').trim(),
          province: String(row[C.province] || '').trim(),
          postal: String(row[C.postal] || '').trim(),
          orderDate: parseExcelDate(row[C.orderDate]),
          shipByDate: parseExcelDate(row[C.shipBy]),
          shipType: String(row[C.shipType] || '').trim(),
          distanceKm: parseFloat(row[C.distKm]) || 0,
          lines: []
        });
      }
      const qty = parseFloat(row[C.qty]) || 0;
      const wpu = parseFloat(row[C.unitWt]) || 0;
      ordersMap.get(orderNo).lines.push({
        lineNo: parseInt(row[C.lineNo]) || 0,
        partCode: String(row[C.part] || '').trim(),
        partDesc: String(row[C.partDesc] || '').trim(),
        qty, uom: String(row[C.uom] || '').trim(),
        weightPerUnit: wpu, totalWeightKg: qty * wpu
      });
    }

    // Lookup product dimensions
    const allParts = [...new Set([...ordersMap.values()].flatMap(o => o.lines.map(l => l.partCode)))].filter(Boolean);
    const dimMap = {};
    if (allParts.length) {
      const req2 = pool.request();
      const safe = allParts.slice(0, 500);
      safe.forEach((p, i) => req2.input(`p${i}`, sql.NVarChar, p));
      const inSql = safe.map((_, i) => `@p${i}`).join(',');
      const dRes = await req2.query(`SELECT ProductCode, ItemLength, ItemWidth, ItemHeight, UnitNetWeight FROM WMS_Products WHERE ProductCode IN (${inSql})`).catch(() => ({ recordset: [] }));
      dRes.recordset.forEach(p => { dimMap[p.ProductCode] = p; });
    }

    let inserted = 0;
    for (const o of ordersMap.values()) {
      const totWt = o.lines.reduce((s, l) => s + l.totalWeightKg, 0);
      const totQty = o.lines.reduce((s, l) => s + l.qty, 0);
      const r = await pool.request()
        .input('SN', sql.NVarChar, o.orderNo).input('PN', sql.NVarChar, o.poNo)
        .input('CC', sql.NVarChar, o.custCode).input('CN', sql.NVarChar, o.custName)
        .input('DA', sql.NVarChar, o.addr).input('CI', sql.NVarChar, o.city)
        .input('PR', sql.NVarChar, o.province).input('PC', sql.NVarChar, o.postal)
        .input('OD', sql.Date, o.orderDate).input('SB', sql.Date, o.shipByDate)
        .input('ST', sql.NVarChar, o.shipType).input('DK', sql.Decimal(10,2), o.distanceKm)
        .input('TW', sql.Decimal(12,3), totWt).input('TQ', sql.Decimal(12,3), totQty)
        .input('IB', sql.NVarChar, batch)
        .query(`INSERT INTO WMS_TMS_Orders (SourceOrderNo,PoNo,CustCode,CustName,DeliveryAddr,City,Province,PostalCode,OrderDate,ShipByDate,ShipType,DistanceKm,TotalWeightKg,TotalQty,ImportBatch)
                OUTPUT INSERTED.TmsOrderID
                VALUES (@SN,@PN,@CC,@CN,@DA,@CI,@PR,@PC,@OD,@SB,@ST,@DK,@TW,@TQ,@IB)`);
      const oid = r.recordset[0].TmsOrderID;
      for (const l of o.lines) {
        const d = dimMap[l.partCode] || {};
        const wpu = l.weightPerUnit || parseFloat(d.UnitNetWeight) || 0;
        await pool.request()
          .input('OID', sql.Int, oid).input('LN', sql.Int, l.lineNo)
          .input('PC', sql.NVarChar, l.partCode).input('PD', sql.NVarChar, l.partDesc)
          .input('QT', sql.Decimal(12,3), l.qty).input('UM', sql.NVarChar, l.uom)
          .input('WU', sql.Decimal(10,3), wpu).input('TW', sql.Decimal(12,3), l.qty * wpu)
          .input('IL', sql.Decimal(8,3), parseFloat(d.ItemLength) || null)
          .input('IW', sql.Decimal(8,3), parseFloat(d.ItemWidth) || null)
          .input('IH', sql.Decimal(8,3), parseFloat(d.ItemHeight) || null)
          .query(`INSERT INTO WMS_TMS_OrderLines (TmsOrderID,LineNo,PartCode,PartDesc,Qty,UOM,WeightPerUnit,TotalWeightKg,ItemLength,ItemWidth,ItemHeight)
                  VALUES (@OID,@LN,@PC,@PD,@QT,@UM,@WU,@TW,@IL,@IW,@IH)`);
      }
      inserted++;
    }
    res.json({ success: true, message: `นำเข้าสำเร็จ ${inserted} คำสั่งส่ง`, count: inserted, batch });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/tms/orders
router.get('/orders', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { status, search, batch } = req.query;
    const request = pool.request();
    let where = 'WHERE 1=1';
    if (status && status !== 'ALL') { where += ' AND o.Status=@st'; request.input('st', sql.NVarChar, status); }
    if (search) { where += ' AND (o.CustName LIKE @s OR o.SourceOrderNo LIKE @s OR o.Province LIKE @s)'; request.input('s', sql.NVarChar, `%${search}%`); }
    if (batch) { where += ' AND o.ImportBatch=@b'; request.input('b', sql.NVarChar, batch); }
    const result = await request.query(`
      SELECT o.*,
        (SELECT COUNT(*) FROM WMS_TMS_OrderLines WHERE TmsOrderID=o.TmsOrderID) AS LineCount,
        (SELECT MAX(ItemLength) FROM WMS_TMS_OrderLines WHERE TmsOrderID=o.TmsOrderID) AS MaxItemLength,
        (SELECT MAX(ItemWidth)  FROM WMS_TMS_OrderLines WHERE TmsOrderID=o.TmsOrderID) AS MaxItemWidth
      FROM WMS_TMS_Orders o ${where}
      ORDER BY o.ShipByDate ASC, o.Province ASC, o.TmsOrderID DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/tms/orders/:id/lines
router.get('/orders/:id/lines', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT * FROM WMS_TMS_OrderLines WHERE TmsOrderID=@id ORDER BY LineNo');
    res.json({ success: true, data: result.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/tms/orders/:id
router.delete('/orders/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM WMS_TMS_OrderLines WHERE TmsOrderID=@id');
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM WMS_TMS_Orders WHERE TmsOrderID=@id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/tms/orders (batch or all)
router.delete('/orders', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { batch } = req.query;
    if (batch) {
      const ids = await pool.request().input('b', sql.NVarChar, batch).query('SELECT TmsOrderID FROM WMS_TMS_Orders WHERE ImportBatch=@b');
      for (const r of ids.recordset) {
        await pool.request().input('id', sql.Int, r.TmsOrderID).query('DELETE FROM WMS_TMS_OrderLines WHERE TmsOrderID=@id');
      }
      await pool.request().input('b', sql.NVarChar, batch).query('DELETE FROM WMS_TMS_Orders WHERE ImportBatch=@b');
    } else {
      await pool.request().query('DELETE FROM WMS_TMS_OrderLines');
      await pool.request().query('DELETE FROM WMS_TMS_Orders');
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ═══ VEHICLES ════════════════════════════════════════════════════════════════

// POST /api/tms/suitable-vehicles — find vehicles that meet load constraints
router.post('/suitable-vehicles', authenticate, async (req, res) => {
  try {
    const { totalWeightKg = 0, maxLengthM = 0, maxWidthM = 0 } = req.body;
    const pool = getPool();
    const result = await pool.request()
      .input('w', sql.Decimal(12,3), parseFloat(totalWeightKg) || 0)
      .input('l', sql.Decimal(8,3), parseFloat(maxLengthM) || 0)
      .input('wd', sql.Decimal(8,3), parseFloat(maxWidthM) || 0)
      .query(`
        SELECT VehicleID, LicensePlate, VehicleName, VehicleCategory,
               PayloadKg, BedLength, BedWidth, BedHeight, VehicleStatus,
               CASE WHEN PayloadKg > 0 THEN ROUND(CAST(@w AS FLOAT)/PayloadKg*100,1) ELSE NULL END AS WeightUtilPct,
               CASE WHEN BedLength > 0  THEN ROUND(CAST(@l AS FLOAT)/BedLength*100,1) ELSE NULL END AS LengthUtilPct,
               CASE WHEN PayloadKg IS NULL OR PayloadKg >= @w THEN 1 ELSE 0 END AS OkWeight,
               CASE WHEN BedLength IS NULL OR BedLength >= @l THEN 1 ELSE 0 END AS OkLength,
               CASE WHEN BedWidth  IS NULL OR BedWidth  >= @wd THEN 1 ELSE 0 END AS OkWidth
        FROM WMS_InternalVehicles
        WHERE IsActive=1 AND VehicleStatus=N'พร้อมใช้'
        ORDER BY PayloadKg ASC
      `);
    const rows = result.recordset.map(v => ({
      ...v,
      canLoad: v.OkWeight && v.OkLength && v.OkWidth,
      reasons: [
        !v.OkWeight ? `น้ำหนักเกิน (${v.PayloadKg} kg)` : null,
        !v.OkLength ? `ความยาวเกิน (${v.BedLength} ม.)` : null,
        !v.OkWidth  ? `ความกว้างเกิน (${v.BedWidth} ม.)` : null,
      ].filter(Boolean)
    }));
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ═══ PLANS ════════════════════════════════════════════════════════════════════

// GET /api/tms/plans
router.get('/plans', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM WMS_TMS_Trips WHERE PlanID=p.PlanID) AS TripCount,
        (SELECT SUM(TotalWeightKg) FROM WMS_TMS_Trips WHERE PlanID=p.PlanID) AS TotalWeightKg
      FROM WMS_TMS_Plans p ORDER BY p.CreatedAt DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/tms/plans
router.post('/plans', authenticate, async (req, res) => {
  try {
    const { planDate, notes } = req.body;
    const pool = getPool();
    const code = `TMS${new Date().toISOString().slice(0,10).replace(/-/g,'')}${Date.now()%10000}`;
    const r = await pool.request()
      .input('code', sql.NVarChar, code).input('dt', sql.Date, planDate || null)
      .input('notes', sql.NVarChar, notes || '').input('by', sql.Int, req.user.UserID)
      .query(`INSERT INTO WMS_TMS_Plans (PlanCode,PlanDate,Notes,CreatedBy) OUTPUT INSERTED.PlanID VALUES (@code,@dt,@notes,@by)`);
    res.json({ success: true, planId: r.recordset[0].PlanID, message: 'สร้างแผนสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/tms/plans/:id
router.get('/plans/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const planRes = await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM WMS_TMS_Plans WHERE PlanID=@id');
    if (!planRes.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบแผน' });
    const tripsRes = await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM WMS_TMS_Trips WHERE PlanID=@id ORDER BY TripNo');
    const trips = tripsRes.recordset;
    for (const trip of trips) {
      const stops = await pool.request().input('tid', sql.Int, trip.TripID).query(`
        SELECT s.*, o.CustName, o.SourceOrderNo, o.DeliveryAddr, o.City, o.Province,
               o.TotalWeightKg, o.TotalQty
        FROM WMS_TMS_TripStops s
        JOIN WMS_TMS_Orders o ON s.TmsOrderID=o.TmsOrderID
        WHERE s.TripID=@tid ORDER BY s.StopNo
      `);
      trip.stops = stops.recordset;
    }
    res.json({ success: true, data: { plan: planRes.recordset[0], trips } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/tms/plans/:id/optimize — nearest-neighbor VRP
router.post('/plans/:id/optimize', authenticate, async (req, res) => {
  try {
    const { orderIds = [], vehicles = [] } = req.body;
    if (!orderIds.length || !vehicles.length) return res.status(400).json({ success: false, message: 'กรุณาเลือกคำสั่งส่งและรถ' });
    const pool = getPool();

    // Fetch orders with geocoords (use province center as fallback)
    const req2 = pool.request();
    orderIds.forEach((id, i) => req2.input(`o${i}`, sql.Int, parseInt(id)));
    const inSql = orderIds.map((_, i) => `@o${i}`).join(',');
    const ordersRes = await req2.query(`SELECT TmsOrderID, CustName, DeliveryAddr, Province, TotalWeightKg FROM WMS_TMS_Orders WHERE TmsOrderID IN (${inSql})`);
    const orders = ordersRes.recordset.map((o, i) => ({
      ...o, id: o.TmsOrderID,
      lat: 13 + Math.random() * 2, lng: 100 + Math.random() * 3,  // fallback; real GPS from geocoding
      assigned: false
    }));

    // Build trips using nearest-neighbor greedy algorithm
    const depot = { lat: 13.75, lng: 100.5 };
    const trips = [];
    let unassigned = [...orders];

    for (let vi = 0; vi < vehicles.length && unassigned.length > 0; vi++) {
      const v = vehicles[vi];
      const capacityKg = parseFloat(v.payloadKg) || Infinity;
      let curLat = depot.lat, curLng = depot.lng;
      let tripWeightKg = 0, totalDist = 0;
      const stops = [];

      while (unassigned.length > 0) {
        // Find nearest unvisited that fits
        let best = null, bestDist = Infinity, bestIdx = -1;
        unassigned.forEach((o, idx) => {
          if (tripWeightKg + o.TotalWeightKg > capacityKg) return;
          const d = haversine(curLat, curLng, o.lat, o.lng);
          if (d < bestDist) { bestDist = d; best = o; bestIdx = idx; }
        });
        if (!best) break;
        totalDist += bestDist;
        curLat = best.lat; curLng = best.lng;
        tripWeightKg += best.TotalWeightKg;
        stops.push({ order: best, dist: bestDist });
        unassigned.splice(bestIdx, 1);
      }
      // Return to depot
      totalDist += haversine(curLat, curLng, depot.lat, depot.lng);
      if (stops.length) trips.push({ vehicle: v, stops, totalDistKm: totalDist, totalWeightKg: tripWeightKg });
    }

    // Clear existing trips for this plan
    const existTrips = await pool.request().input('pid', sql.Int, req.params.id).query('SELECT TripID FROM WMS_TMS_Trips WHERE PlanID=@pid');
    for (const t of existTrips.recordset) {
      await pool.request().input('tid', sql.Int, t.TripID).query('DELETE FROM WMS_TMS_TripStops WHERE TripID=@tid');
    }
    await pool.request().input('pid', sql.Int, req.params.id).query('DELETE FROM WMS_TMS_Trips WHERE PlanID=@pid');

    // Insert new trips
    for (let ti = 0; ti < trips.length; ti++) {
      const t = trips[ti];
      const tRes = await pool.request()
        .input('pid', sql.Int, parseInt(req.params.id)).input('tn', sql.Int, ti + 1)
        .input('vid', sql.Int, parseInt(t.vehicle.vehicleId) || null)
        .input('lp', sql.NVarChar, t.vehicle.licensePlate || '')
        .input('dn', sql.NVarChar, t.vehicle.driverName || '')
        .input('pk', sql.Decimal(10,2), parseFloat(t.vehicle.payloadKg) || null)
        .input('bl', sql.Decimal(8,3), parseFloat(t.vehicle.bedLength) || null)
        .input('bw', sql.Decimal(8,3), parseFloat(t.vehicle.bedWidth) || null)
        .input('ts', sql.Int, t.stops.length)
        .input('td', sql.Decimal(10,2), Math.round(t.totalDistKm * 10) / 10)
        .input('tw', sql.Decimal(12,3), Math.round(t.totalWeightKg * 1000) / 1000)
        .query(`INSERT INTO WMS_TMS_Trips (PlanID,TripNo,VehicleID,LicensePlate,DriverName,PayloadKg,BedLength,BedWidth,TotalStops,TotalDistKm,TotalWeightKg)
                OUTPUT INSERTED.TripID
                VALUES (@pid,@tn,@vid,@lp,@dn,@pk,@bl,@bw,@ts,@td,@tw)`);
      const tripId = tRes.recordset[0].TripID;
      for (let si = 0; si < t.stops.length; si++) {
        const s = t.stops[si];
        await pool.request()
          .input('tid', sql.Int, tripId).input('sn', sql.Int, si + 1)
          .input('oid', sql.Int, s.order.TmsOrderID)
          .input('d', sql.Decimal(10,2), Math.round(s.dist * 10) / 10)
          .query('INSERT INTO WMS_TMS_TripStops (TripID,StopNo,TmsOrderID,DistFromPrevKm) VALUES (@tid,@sn,@oid,@d)');
        // Mark order as PLANNED
        await pool.request().input('oid', sql.Int, s.order.TmsOrderID).query("UPDATE WMS_TMS_Orders SET Status='PLANNED' WHERE TmsOrderID=@oid");
      }
    }
    // Update plan status
    await pool.request().input('pid', sql.Int, req.params.id).query("UPDATE WMS_TMS_Plans SET Status='DRAFT' WHERE PlanID=@pid");

    res.json({
      success: true,
      message: `จัดเส้นทางสำเร็จ ${trips.length} เที่ยว, ไม่ได้จัด ${unassigned.length} คำสั่ง`,
      tripCount: trips.length,
      unassignedCount: unassigned.length
    });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// ═══ LOADING DIAGRAM ══════════════════════════════════════════════════════════

// POST /api/tms/loading-diagram — 2D bin-pack (top-down view)
router.post('/loading-diagram', authenticate, async (req, res) => {
  try {
    const { vehicleId, orderIds = [] } = req.body;
    const pool = getPool();

    // Get vehicle bed
    const vRes = await pool.request().input('vid', sql.Int, parseInt(vehicleId))
      .query('SELECT LicensePlate,PayloadKg,BedLength,BedWidth,BedHeight FROM WMS_InternalVehicles WHERE VehicleID=@vid');
    if (!vRes.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบรถ' });
    const v = vRes.recordset[0];
    const bedL = parseFloat(v.BedLength) || 6;
    const bedW = parseFloat(v.BedWidth) || 2;

    // Get order lines with dimensions
    const req2 = pool.request();
    orderIds.forEach((id, i) => req2.input(`o${i}`, sql.Int, parseInt(id)));
    const inSql = orderIds.map((_, i) => `@o${i}`).join(',') || '0';
    const linesRes = await req2.query(`
      SELECT l.*, ord.CustName, ord.SourceOrderNo, ord.Province
      FROM WMS_TMS_OrderLines l
      JOIN WMS_TMS_Orders ord ON l.TmsOrderID=ord.TmsOrderID
      WHERE l.TmsOrderID IN (${inSql})
      ORDER BY COALESCE(l.ItemLength,0) DESC, l.TotalWeightKg DESC
    `);

    const COLORS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f97316','#6366f1'];
    const colorMap = {};
    let colorIdx = 0;
    orderIds.forEach(id => { colorMap[id] = COLORS[colorIdx++ % COLORS.length]; });

    // Expand lines by batch (group same product per order into one rectangle)
    const items = linesRes.recordset.map(l => ({
      id: `${l.TmsOrderID}_${l.LineID}`,
      label: l.PartCode || l.PartDesc?.slice(0, 15) || '?',
      custName: l.CustName,
      orderId: l.TmsOrderID,
      length: parseFloat(l.ItemLength) || 0.5,
      width: parseFloat(l.ItemWidth) || 0.3,
      qty: parseFloat(l.Qty) || 1,
      weightKg: parseFloat(l.TotalWeightKg) || 0,
      color: colorMap[l.TmsOrderID] || '#94a3b8',
    }));

    // Shelf bin-packing algorithm (top-view: length=truck length axis, width=truck width axis)
    const placed = [], unplaced = [];
    let curX = 0, curY = 0, rowMaxLen = 0;

    for (const item of items) {
      const iLen = Math.min(item.length, bedL);
      const iWid = Math.min(item.width, bedW);
      if (iLen > bedL || iWid > bedW) { unplaced.push({ ...item, reason: 'ใหญ่เกินกระบะ' }); continue; }
      if (curY + iWid > bedW) { curX += rowMaxLen; curY = 0; rowMaxLen = 0; }
      if (curX + iLen > bedL) { unplaced.push({ ...item, reason: 'ไม่มีพื้นที่' }); continue; }
      placed.push({ ...item, x: curX, y: curY });
      curY += iWid;
      rowMaxLen = Math.max(rowMaxLen, iLen);
    }

    // Weight distribution (front=cab side, rear=loading side)
    const totalWeight = placed.reduce((s, p) => s + p.weightKg, 0);
    const frontWeight = placed.filter(p => (p.x + p.length / 2) / bedL > 0.5).reduce((s, p) => s + p.weightKg, 0);
    const rearWeight = totalWeight - frontWeight;

    res.json({
      success: true,
      bed: { length: bedL, width: bedW, payloadKg: v.PayloadKg, plate: v.LicensePlate },
      placed, unplaced,
      summary: {
        totalWeightKg: Math.round(totalWeight * 10) / 10,
        frontWeightKg: Math.round(frontWeight * 10) / 10,
        rearWeightKg: Math.round(rearWeight * 10) / 10,
        utilPct: v.PayloadKg ? Math.round(totalWeight / v.PayloadKg * 100) : null,
        itemCount: placed.length,
        unplacedCount: unplaced.length
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
