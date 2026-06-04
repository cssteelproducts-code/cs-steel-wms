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
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
};

// Thai province → approximate centroid coordinates
const PROVINCE_COORDS = {
  'กรุงเทพมหานคร': [13.75, 100.52], 'กรุงเทพ': [13.75, 100.52],
  'นนทบุรี': [13.86, 100.51], 'ปทุมธานี': [14.01, 100.53],
  'สมุทรปราการ': [13.60, 100.60], 'สมุทรสาคร': [13.55, 100.28],
  'สมุทรสงคราม': [13.41, 100.00], 'นครปฐม': [13.82, 100.04],
  'ราชบุรี': [13.54, 99.82], 'กาญจนบุรี': [14.00, 99.54],
  'เพชรบุรี': [13.11, 99.94], 'ประจวบคีรีขันธ์': [11.81, 99.80],
  'ชลบุรี': [13.36, 100.99], 'ระยอง': [12.68, 101.28],
  'จันทบุรี': [12.61, 102.10], 'ตราด': [12.24, 102.52],
  'ฉะเชิงเทรา': [13.69, 101.08], 'ปราจีนบุรี': [14.05, 101.37],
  'สระแก้ว': [13.82, 102.06], 'นครราชสีมา': [14.97, 102.10],
  'บุรีรัมย์': [14.99, 103.11], 'สุรินทร์': [14.88, 103.49],
  'ศรีสะเกษ': [15.12, 104.32], 'อุบลราชธานี': [15.23, 104.87],
  'ยโสธร': [15.79, 104.15], 'ชัยภูมิ': [15.81, 102.03],
  'อำนาจเจริญ': [15.86, 104.63], 'หนองบัวลำภู': [17.20, 102.44],
  'ขอนแก่น': [16.44, 102.83], 'อุดรธานี': [17.41, 102.79],
  'เลย': [17.49, 101.72], 'หนองคาย': [17.88, 102.74],
  'มหาสารคาม': [16.18, 103.30], 'ร้อยเอ็ด': [16.05, 103.65],
  'กาฬสินธุ์': [16.43, 103.51], 'สกลนคร': [17.15, 104.14],
  'นครพนม': [17.39, 104.77], 'มุกดาหาร': [16.54, 104.73],
  'เชียงใหม่': [18.79, 98.99], 'เชียงราย': [19.91, 99.84],
  'แม่ฮ่องสอน': [19.30, 97.97], 'น่าน': [18.78, 100.78],
  'พะเยา': [19.16, 99.90], 'แพร่': [18.14, 100.13],
  'ลำปาง': [18.29, 99.49], 'ลำพูน': [18.57, 99.01],
  'อุตรดิตถ์': [17.63, 100.10], 'ตาก': [16.88, 99.13],
  'สุโขทัย': [17.01, 99.83], 'พิษณุโลก': [16.82, 100.26],
  'กำแพงเพชร': [16.48, 99.52], 'พิจิตร': [16.44, 100.35],
  'เพชรบูรณ์': [16.42, 101.16], 'นครสวรรค์': [15.70, 100.12],
  'อุทัยธานี': [15.38, 100.03], 'ชัยนาท': [15.18, 100.13],
  'สิงห์บุรี': [14.89, 100.40], 'อ่างทอง': [14.59, 100.45],
  'ลพบุรี': [14.80, 100.65], 'สระบุรี': [14.53, 100.91],
  'นครนายก': [14.20, 101.21], 'สุพรรณบุรี': [14.47, 100.12],
  'พระนครศรีอยุธยา': [14.35, 100.56], 'อยุธยา': [14.35, 100.56],
  'สุราษฎร์ธานี': [9.14, 99.33], 'นครศรีธรรมราช': [8.43, 99.96],
  'กระบี่': [8.09, 98.91], 'พังงา': [8.45, 98.53],
  'ภูเก็ต': [7.89, 98.40], 'ตรัง': [7.56, 99.61],
  'พัทลุง': [7.61, 100.08], 'สตูล': [6.62, 100.07],
  'สงขลา': [7.19, 100.59], 'ปัตตานี': [6.87, 101.25],
  'ยะลา': [6.54, 101.28], 'นราธิวาส': [6.43, 101.82],
  'ระนอง': [9.96, 98.63], 'ชุมพร': [10.49, 99.18],
};

const provinceCoords = (province) => {
  if (!province) return [13.75, 100.5];
  for (const [key, coords] of Object.entries(PROVINCE_COORDS)) {
    if (province.includes(key) || key.includes(province)) return coords;
  }
  return [13.75, 100.5]; // Bangkok default
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── ensure tables (promise-guarded, runs once) ───────────────────────────────
let _ensurePromise = null;
const ensureTables = () => {
  if (!_ensurePromise) {
    _ensurePromise = _doEnsure().catch(e => { _ensurePromise = null; throw e; });
  }
  return _ensurePromise;
};

const _doEnsure = async () => {
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
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_TMS_OL_OrderID' AND object_id=OBJECT_ID('WMS_TMS_OrderLines'))
      CREATE INDEX IX_TMS_OL_OrderID ON WMS_TMS_OrderLines(TmsOrderID);
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
    IF COL_LENGTH('WMS_Products','ItemLength') IS NULL ALTER TABLE WMS_Products ADD ItemLength DECIMAL(8,3) NULL;
    IF COL_LENGTH('WMS_Products','ItemWidth')  IS NULL ALTER TABLE WMS_Products ADD ItemWidth  DECIMAL(8,3) NULL;
    IF COL_LENGTH('WMS_Products','ItemHeight') IS NULL ALTER TABLE WMS_Products ADD ItemHeight DECIMAL(8,3) NULL;
  `);
};

router.use(async (req, res, next) => {
  try { await ensureTables(); next(); } catch (e) { next(e); }
});

// ═══ IMPORT ═══════════════════════════════════════════════════════════════════

router.post('/import', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาแนบไฟล์ Excel' });
    const pool = getPool();
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) return res.status(400).json({ success: false, message: 'ไฟล์ไม่มีข้อมูล' });

    const header = rows[0].map(h => String(h));
    const col = (...names) => {
      for (const n of names) {
        const i = header.findIndex(h => h.toLowerCase().includes(n.toLowerCase()));
        if (i >= 0) return i;
      }
      return -1;
    };
    const C = {
      orderDate: col('order date') >= 0 ? col('order date') : 2,
      po:        col('po') >= 0 ? col('po') : 3,
      custId:    col('cust. id', 'cust id') >= 0 ? col('cust. id', 'cust id') : 4,
      custName:  col('name') >= 0 ? col('name') : 5,
      addr1: 6, addr2: 7, addr3: 8, city: 9, province: 10, postal: 12,
      orderNo:   col('order') >= 0 ? col('order') : 13,
      lineNo: 14,
      part:      col('part') >= 0 ? col('part') : 16,
      partDesc:  col('part description') >= 0 ? col('part description') : 17,
      unitWt:    col('unit net weight') >= 0 ? col('unit net weight') : 19,
      qty:       col('order quantity') >= 0 ? col('order quantity') : 20,
      uom: 21,
      shipBy:    col('ship by') >= 0 ? col('ship by') : 30,
      shipType:  col('ประเภทการจัดส่ง') >= 0 ? col('ประเภทการจัดส่ง') : 32,
      distKm:    col('ระยะทาง') >= 0 ? col('ระยะทาง') : 34,
    };

    const batch = `B${Date.now()}`;
    const ordersMap = new Map();
    for (const row of rows.slice(1)) {
      const orderNo = String(row[C.orderNo] || '').trim();
      if (!orderNo) continue;
      if (!ordersMap.has(orderNo)) {
        ordersMap.set(orderNo, {
          orderNo, poNo: String(row[C.po] || '').trim(),
          custCode: String(row[C.custId] || '').trim(), custName: String(row[C.custName] || '').trim(),
          addr: [row[C.addr1], row[C.addr2], row[C.addr3]].filter(a => a && a !== '-').join(' ').trim(),
          city: String(row[C.city] || '').trim(), province: String(row[C.province] || '').trim(),
          postal: String(row[C.postal] || '').trim(),
          orderDate: parseExcelDate(row[C.orderDate]), shipByDate: parseExcelDate(row[C.shipBy]),
          shipType: String(row[C.shipType] || '').trim(), distanceKm: parseFloat(row[C.distKm]) || 0,
          lines: []
        });
      }
      const qty = parseFloat(row[C.qty]) || 0;
      const wpu = parseFloat(row[C.unitWt]) || 0;
      ordersMap.get(orderNo).lines.push({
        lineNo: parseInt(row[C.lineNo]) || 0, partCode: String(row[C.part] || '').trim(),
        partDesc: String(row[C.partDesc] || '').trim(), qty, uom: String(row[C.uom] || '').trim(),
        weightPerUnit: wpu, totalWeightKg: qty * wpu
      });
    }

    // Lookup product dimensions in one query
    const allParts = [...new Set([...ordersMap.values()].flatMap(o => o.lines.map(l => l.partCode)))].filter(Boolean);
    const dimMap = {};
    if (allParts.length) {
      const dimReq = pool.request();
      const safe = allParts.slice(0, 500);
      safe.forEach((p, i) => dimReq.input(`p${i}`, sql.NVarChar, p));
      const dRes = await dimReq.query(`SELECT ProductCode,ItemLength,ItemWidth,ItemHeight,UnitNetWeight FROM WMS_Products WHERE ProductCode IN (${safe.map((_,i)=>`@p${i}`).join(',')})`).catch(() => ({ recordset: [] }));
      dRes.recordset.forEach(p => { dimMap[p.ProductCode] = p; });
    }

    // Batch insert orders in parallel
    const orderArr = [...ordersMap.values()];
    const insertedIds = await Promise.all(orderArr.map(async o => {
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
        .query(`INSERT INTO WMS_TMS_Orders (SourceOrderNo,PoNo,CustCode,CustName,DeliveryAddr,City,Province,PostalCode,OrderDate,ShipByDate,ShipType,DistanceKm,TotalWeightKg,TotalQty,ImportBatch) OUTPUT INSERTED.TmsOrderID VALUES (@SN,@PN,@CC,@CN,@DA,@CI,@PR,@PC,@OD,@SB,@ST,@DK,@TW,@TQ,@IB)`);
      return { orderNo: o.orderNo, id: r.recordset[0].TmsOrderID, lines: o.lines };
    }));

    // Collect all lines and batch insert in chunks of 50
    const allLines = insertedIds.flatMap(({ id, lines }) =>
      lines.map(l => {
        const d = dimMap[l.partCode] || {};
        const wpu = l.weightPerUnit || parseFloat(d.UnitNetWeight) || 0;
        return { oid: id, lineNo: l.lineNo, partCode: l.partCode, partDesc: l.partDesc,
          qty: l.qty, uom: l.uom, wpu, twKg: l.qty * wpu,
          il: parseFloat(d.ItemLength) || null, iw: parseFloat(d.ItemWidth) || null, ih: parseFloat(d.ItemHeight) || null };
      })
    );

    const CHUNK = 50;
    for (let i = 0; i < allLines.length; i += CHUNK) {
      const chunk = allLines.slice(i, i + CHUNK);
      const req2 = pool.request();
      const vals = chunk.map((l, k) => {
        req2.input(`oid${k}`, sql.Int, l.oid).input(`ln${k}`, sql.Int, l.lineNo)
          .input(`pc${k}`, sql.NVarChar, l.partCode).input(`pd${k}`, sql.NVarChar, l.partDesc)
          .input(`qt${k}`, sql.Decimal(12,3), l.qty).input(`um${k}`, sql.NVarChar, l.uom)
          .input(`wu${k}`, sql.Decimal(10,3), l.wpu).input(`tw${k}`, sql.Decimal(12,3), l.twKg)
          .input(`il${k}`, sql.Decimal(8,3), l.il).input(`iw${k}`, sql.Decimal(8,3), l.iw)
          .input(`ih${k}`, sql.Decimal(8,3), l.ih);
        return `(@oid${k},@ln${k},@pc${k},@pd${k},@qt${k},@um${k},@wu${k},@tw${k},@il${k},@iw${k},@ih${k})`;
      }).join(',');
      await req2.query(`INSERT INTO WMS_TMS_OrderLines (TmsOrderID,LineNo,PartCode,PartDesc,Qty,UOM,WeightPerUnit,TotalWeightKg,ItemLength,ItemWidth,ItemHeight) VALUES ${vals}`);
    }

    res.json({ success: true, message: `นำเข้าสำเร็จ ${insertedIds.length} คำสั่งส่ง`, count: insertedIds.length, batch });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// ═══ ORDERS ═══════════════════════════════════════════════════════════════════

router.get('/orders', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { status, search, batch } = req.query;
    const request = pool.request();
    let where = 'WHERE 1=1';
    if (status && status !== 'ALL') { where += ' AND o.Status=@st'; request.input('st', sql.NVarChar, status); }
    if (search) { where += ' AND (o.CustName LIKE @s OR o.SourceOrderNo LIKE @s OR o.Province LIKE @s)'; request.input('s', sql.NVarChar, `%${search}%`); }
    if (batch) { where += ' AND o.ImportBatch=@b'; request.input('b', sql.NVarChar, batch); }
    // Single JOIN with GROUP BY — eliminates correlated subqueries
    const result = await request.query(`
      SELECT o.*, COALESCE(agg.LineCount,0) AS LineCount, agg.MaxItemLength, agg.MaxItemWidth
      FROM WMS_TMS_Orders o
      LEFT JOIN (
        SELECT TmsOrderID, COUNT(*) AS LineCount,
               MAX(ItemLength) AS MaxItemLength, MAX(ItemWidth) AS MaxItemWidth
        FROM WMS_TMS_OrderLines GROUP BY TmsOrderID
      ) agg ON agg.TmsOrderID = o.TmsOrderID
      ${where}
      ORDER BY o.ShipByDate ASC, o.Province ASC, o.TmsOrderID DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/orders/:id/lines', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT * FROM WMS_TMS_OrderLines WHERE TmsOrderID=@id ORDER BY LineNo');
    res.json({ success: true, data: result.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/orders/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM WMS_TMS_OrderLines WHERE TmsOrderID=@id');
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM WMS_TMS_Orders WHERE TmsOrderID=@id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/orders', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { batch } = req.query;
    if (batch) {
      // Single set-based delete — no loop
      await pool.request().input('b', sql.NVarChar, batch)
        .query('DELETE l FROM WMS_TMS_OrderLines l JOIN WMS_TMS_Orders o ON l.TmsOrderID=o.TmsOrderID WHERE o.ImportBatch=@b');
      await pool.request().input('b', sql.NVarChar, batch).query('DELETE FROM WMS_TMS_Orders WHERE ImportBatch=@b');
    } else {
      await pool.request().query('DELETE FROM WMS_TMS_OrderLines');
      await pool.request().query('DELETE FROM WMS_TMS_Orders');
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ═══ VEHICLES ════════════════════════════════════════════════════════════════

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
               CASE WHEN BedLength > 0 THEN ROUND(CAST(@l AS FLOAT)/BedLength*100,1) ELSE NULL END AS LengthUtilPct,
               CASE WHEN PayloadKg IS NULL OR PayloadKg >= @w THEN 1 ELSE 0 END AS OkWeight,
               CASE WHEN BedLength IS NULL OR BedLength >= @l THEN 1 ELSE 0 END AS OkLength,
               CASE WHEN @wd = 0 OR BedWidth IS NULL OR BedWidth >= @wd THEN 1 ELSE 0 END AS OkWidth
        FROM WMS_InternalVehicles WHERE IsActive=1 AND VehicleStatus=N'พร้อมใช้'
        ORDER BY PayloadKg ASC
      `);
    const rows = result.recordset.map(v => ({
      ...v,
      canLoad: v.OkWeight && v.OkLength && v.OkWidth,
      widthUnknown: parseFloat(maxWidthM) === 0,
      reasons: [
        !v.OkWeight ? `น้ำหนักเกิน (รับได้ ${v.PayloadKg?.toLocaleString()} kg)` : null,
        !v.OkLength ? `ยาวเกิน (กระบะ ${v.BedLength} ม.)` : null,
        !v.OkWidth  ? `กว้างเกิน (กระบะ ${v.BedWidth} ม.)` : null,
      ].filter(Boolean)
    }));
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ═══ PLANS ════════════════════════════════════════════════════════════════════

router.get('/plans', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT p.*, COUNT(t.TripID) AS TripCount, SUM(t.TotalWeightKg) AS TotalWeightKg
      FROM WMS_TMS_Plans p LEFT JOIN WMS_TMS_Trips t ON t.PlanID=p.PlanID
      GROUP BY p.PlanID,p.PlanCode,p.PlanDate,p.Status,p.Notes,p.CreatedBy,p.CreatedAt
      ORDER BY p.CreatedAt DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

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

router.get('/plans/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const planRes = await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT * FROM WMS_TMS_Plans WHERE PlanID=@id');
    if (!planRes.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบแผน' });

    const tripsRes = await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT * FROM WMS_TMS_Trips WHERE PlanID=@id ORDER BY TripNo');
    const trips = tripsRes.recordset;

    if (trips.length > 0) {
      // Single JOIN query replaces N+1 per-trip stop queries
      const tripIds = trips.map(t => t.TripID);
      const stopReq = pool.request();
      tripIds.forEach((id, i) => stopReq.input(`t${i}`, sql.Int, id));
      const inSql = tripIds.map((_, i) => `@t${i}`).join(',');
      const stopsRes = await stopReq.query(`
        SELECT s.*, o.CustName, o.SourceOrderNo, o.DeliveryAddr, o.City, o.Province,
               o.TotalWeightKg, o.TotalQty
        FROM WMS_TMS_TripStops s JOIN WMS_TMS_Orders o ON s.TmsOrderID=o.TmsOrderID
        WHERE s.TripID IN (${inSql}) ORDER BY s.TripID, s.StopNo
      `);
      const stopsByTrip = {};
      stopsRes.recordset.forEach(s => {
        (stopsByTrip[s.TripID] = stopsByTrip[s.TripID] || []).push(s);
      });
      trips.forEach(t => { t.stops = stopsByTrip[t.TripID] || []; });
    } else {
      trips.forEach(t => { t.stops = []; });
    }

    res.json({ success: true, data: { plan: planRes.recordset[0], trips } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/plans/:id/optimize', authenticate, async (req, res) => {
  try {
    const { orderIds = [], vehicles = [] } = req.body;
    if (!orderIds.length || !vehicles.length) return res.status(400).json({ success: false, message: 'กรุณาเลือกคำสั่งส่งและรถ' });
    const pool = getPool();

    const req2 = pool.request();
    orderIds.forEach((id, i) => req2.input(`o${i}`, sql.Int, parseInt(id)));
    const inSql = orderIds.map((_, i) => `@o${i}`).join(',');
    const ordersRes = await req2.query(`SELECT TmsOrderID, CustName, Province, TotalWeightKg, DistanceKm FROM WMS_TMS_Orders WHERE TmsOrderID IN (${inSql})`);

    // Use province centroid coordinates (not random)
    const orders = ordersRes.recordset.map(o => {
      const [lat, lng] = provinceCoords(o.Province);
      return { ...o, id: o.TmsOrderID, lat, lng };
    });

    const depot = [13.75, 100.5]; // Bangkok depot default
    const trips = [];
    let unassigned = [...orders];

    for (let vi = 0; vi < vehicles.length && unassigned.length > 0; vi++) {
      const v = vehicles[vi];
      const capacityKg = parseFloat(v.payloadKg) || Infinity;
      let [curLat, curLng] = depot;
      let tripWeightKg = 0, totalDist = 0;
      const stops = [];

      while (unassigned.length > 0) {
        let best = null, bestDist = Infinity, bestIdx = -1;
        unassigned.forEach((o, idx) => {
          if (tripWeightKg + parseFloat(o.TotalWeightKg || 0) > capacityKg) return;
          const d = haversine(curLat, curLng, o.lat, o.lng);
          if (d < bestDist) { bestDist = d; best = o; bestIdx = idx; }
        });
        if (!best) break;
        totalDist += bestDist;
        curLat = best.lat; curLng = best.lng;
        tripWeightKg += parseFloat(best.TotalWeightKg || 0);
        stops.push({ order: best, dist: parseFloat(bestDist.toFixed(1)) });
        unassigned.splice(bestIdx, 1);
      }
      totalDist += haversine(curLat, curLng, depot[0], depot[1]);
      if (stops.length) trips.push({ vehicle: v, stops, totalDistKm: parseFloat(totalDist.toFixed(1)), totalWeightKg: tripWeightKg });
    }

    // Clear existing trips
    const existTrips = await pool.request().input('pid', sql.Int, req.params.id)
      .query('SELECT TripID FROM WMS_TMS_Trips WHERE PlanID=@pid');
    if (existTrips.recordset.length) {
      const existIds = existTrips.recordset.map(t => t.TripID);
      const delReq = pool.request();
      existIds.forEach((id, i) => delReq.input(`t${i}`, sql.Int, id));
      await delReq.query(`DELETE FROM WMS_TMS_TripStops WHERE TripID IN (${existIds.map((_,i)=>`@t${i}`).join(',')})`);
      await pool.request().input('pid', sql.Int, req.params.id).query('DELETE FROM WMS_TMS_Trips WHERE PlanID=@pid');
    }

    // Insert trips (few, sequential is fine) + batch stops per trip
    const plannedOrderIds = [];
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
        .input('ts', sql.Int, t.stops.length).input('td', sql.Decimal(10,2), t.totalDistKm)
        .input('tw', sql.Decimal(12,3), parseFloat(t.totalWeightKg.toFixed(3)))
        .query(`INSERT INTO WMS_TMS_Trips (PlanID,TripNo,VehicleID,LicensePlate,DriverName,PayloadKg,BedLength,BedWidth,TotalStops,TotalDistKm,TotalWeightKg) OUTPUT INSERTED.TripID VALUES (@pid,@tn,@vid,@lp,@dn,@pk,@bl,@bw,@ts,@td,@tw)`);
      const tripId = tRes.recordset[0].TripID;

      if (t.stops.length > 0) {
        // Batch insert all stops for this trip
        const stopReq = pool.request();
        const vals = t.stops.map((s, si) => {
          stopReq.input(`st${si}`, sql.Int, tripId).input(`sn${si}`, sql.Int, si + 1)
            .input(`oid${si}`, sql.Int, s.order.TmsOrderID).input(`d${si}`, sql.Decimal(10,2), s.dist);
          return `(@st${si},@sn${si},@oid${si},@d${si})`;
        }).join(',');
        await stopReq.query(`INSERT INTO WMS_TMS_TripStops (TripID,StopNo,TmsOrderID,DistFromPrevKm) VALUES ${vals}`);
        plannedOrderIds.push(...t.stops.map(s => s.order.TmsOrderID));
      }
    }

    // Single UPDATE for all planned orders
    if (plannedOrderIds.length > 0) {
      const updReq = pool.request();
      plannedOrderIds.forEach((id, i) => updReq.input(`u${i}`, sql.Int, id));
      await updReq.query(`UPDATE WMS_TMS_Orders SET Status='PLANNED' WHERE TmsOrderID IN (${plannedOrderIds.map((_,i)=>`@u${i}`).join(',')})`);
    }

    await pool.request().input('pid', sql.Int, req.params.id)
      .query("UPDATE WMS_TMS_Plans SET Status='OPTIMIZED' WHERE PlanID=@pid");

    res.json({
      success: true,
      message: `จัดเส้นทางสำเร็จ ${trips.length} เที่ยว${unassigned.length ? `, ไม่ได้จัด ${unassigned.length} คำสั่ง` : ''}`,
      tripCount: trips.length, unassignedCount: unassigned.length
    });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// ═══ LOADING DIAGRAM ══════════════════════════════════════════════════════════

router.post('/loading-diagram', authenticate, async (req, res) => {
  try {
    const { vehicleId, orderIds = [] } = req.body;
    const pool = getPool();

    const vRes = await pool.request().input('vid', sql.Int, parseInt(vehicleId))
      .query('SELECT LicensePlate,PayloadKg,BedLength,BedWidth,BedHeight FROM WMS_InternalVehicles WHERE VehicleID=@vid');
    if (!vRes.recordset.length) return res.status(404).json({ success: false, message: 'ไม่พบรถ' });
    const v = vRes.recordset[0];
    const bedL = parseFloat(v.BedLength) || 6;
    const bedW = parseFloat(v.BedWidth) || 2;

    const req2 = pool.request();
    const safeIds = orderIds.filter(Boolean);
    if (!safeIds.length) return res.json({ success: true, bed: { length: bedL, width: bedW, payloadKg: v.PayloadKg, plate: v.LicensePlate }, placed: [], unplaced: [], summary: { totalWeightKg: 0, frontWeightKg: 0, rearWeightKg: 0, utilPct: null, itemCount: 0, unplacedCount: 0 } });
    safeIds.forEach((id, i) => req2.input(`o${i}`, sql.Int, parseInt(id)));
    const inSql = safeIds.map((_, i) => `@o${i}`).join(',');
    const linesRes = await req2.query(`
      SELECT l.LineID, l.TmsOrderID, l.PartCode, l.PartDesc, l.Qty, l.TotalWeightKg, l.ItemLength, l.ItemWidth, ord.CustName
      FROM WMS_TMS_OrderLines l JOIN WMS_TMS_Orders ord ON l.TmsOrderID=ord.TmsOrderID
      WHERE l.TmsOrderID IN (${inSql})
      ORDER BY COALESCE(l.ItemLength,0) DESC, l.TotalWeightKg DESC
    `);

    const COLORS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f97316','#6366f1'];
    const colorMap = {};
    let ci = 0;
    safeIds.forEach(id => { colorMap[id] = COLORS[ci++ % COLORS.length]; });

    const items = linesRes.recordset.map(l => ({
      id: `${l.TmsOrderID}_${l.LineID}`, label: l.PartCode || '?', custName: l.CustName,
      orderId: l.TmsOrderID, length: parseFloat(l.ItemLength) || 0.5, width: parseFloat(l.ItemWidth) || 0.3,
      weightKg: parseFloat(l.TotalWeightKg) || 0, color: colorMap[l.TmsOrderID] || '#94a3b8',
    }));

    const placed = [], unplaced = [];
    let curX = 0, curY = 0, rowMaxLen = 0;
    for (const item of items) {
      const iLen = Math.min(item.length, bedL), iWid = Math.min(item.width, bedW);
      if (item.length > bedL || item.width > bedW) { unplaced.push({ ...item, reason: 'ใหญ่เกินกระบะ' }); continue; }
      if (curY + iWid > bedW) { curX += rowMaxLen; curY = 0; rowMaxLen = 0; }
      if (curX + iLen > bedL) { unplaced.push({ ...item, reason: 'ไม่มีพื้นที่' }); continue; }
      placed.push({ ...item, x: curX, y: curY });
      curY += iWid;
      rowMaxLen = Math.max(rowMaxLen, iLen);
    }

    const totalWeight = placed.reduce((s, p) => s + p.weightKg, 0);
    const frontWeight = placed.filter(p => (p.x + p.length / 2) / bedL > 0.5).reduce((s, p) => s + p.weightKg, 0);

    res.json({
      success: true,
      bed: { length: bedL, width: bedW, payloadKg: v.PayloadKg, plate: v.LicensePlate },
      placed, unplaced,
      summary: {
        totalWeightKg: Math.round(totalWeight * 10) / 10,
        frontWeightKg: Math.round(frontWeight * 10) / 10,
        rearWeightKg: Math.round((totalWeight - frontWeight) * 10) / 10,
        utilPct: v.PayloadKg ? Math.round(totalWeight / v.PayloadKg * 100) : null,
        itemCount: placed.length, unplacedCount: unplaced.length
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
