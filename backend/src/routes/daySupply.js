const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { authenticate } = require('../middleware/auth');
const { getPool } = require('../config/db');
const sql = require('mssql');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// ─── Parse Excel → compute period data ───────────────────────────────────────
function parseAndCompute(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  const stockMap  = {};  // TypeSUK → { nw, skuSet }
  const salesMap  = {};  // TypeSUK → nw
  const saleDates = [];

  for (const r of rows) {
    const docType  = String(r['DocType'] || r['Doctype'] || '').trim();
    const typeSUK  = String(r['TypeSUK'] || r['TypeSuk'] || '').trim() || 'ไม่ระบุ';
    const qty      = parseFloat(r['Quantity']) || 0;
    const uwt      = parseFloat(r['UnitNetWeight']) || 0;
    const nw       = qty * uwt;
    const sku      = String(r['Itemcode'] || '').trim();
    const rawDate  = r['Docdate'];
    const dateStr  = rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : (rawDate ? String(rawDate).slice(0, 10) : null);

    if (docType === 'คงเหลือปัจจุบัน') {
      if (!stockMap[typeSUK]) stockMap[typeSUK] = { nw: 0, skuSet: new Set() };
      stockMap[typeSUK].nw += nw;
      if (sku) stockMap[typeSUK].skuSet.add(sku);
    }
    if (docType === 'เบิกไปขาย') {
      salesMap[typeSUK] = (salesMap[typeSUK] || 0) + nw;
      if (dateStr) saleDates.push(dateStr);
    }
  }

  // Detect period from sales date range
  saleDates.sort();
  const periodStart = saleDates[0] || null;
  const periodEnd   = saleDates[saleDates.length - 1] || null;
  const periodDays  = periodStart && periodEnd
    ? Math.max(1, Math.round((new Date(periodEnd) - new Date(periodStart)) / 86400000) + 1)
    : 6;

  // Friendly label e.g. "16-21 Jun 26"
  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    const day = dt.getDate();
    const mon = dt.toLocaleString('en', { month: 'short' });
    const yr  = String(dt.getFullYear()).slice(2);
    return `${day} ${mon} ${yr}`;
  };
  const periodLabel = periodStart
    ? `${fmtDate(periodStart)}-${fmtDate(periodEnd)}`
    : 'ไม่ระบุช่วงเวลา';

  // Build rows by TypeSUK
  const typeOrder = ['สินค้าโป๊ว', 'NewItem', 'ขายดี', 'ขายน้อยขายต่อเนื่อง', 'ขายน้อยขายไม่ต่อเนื่อง'];
  const allTypes = [...new Set([...typeOrder, ...Object.keys(stockMap), ...Object.keys(salesMap)])];

  const report = allTypes.map(ts => {
    const stockNW  = stockMap[ts]?.nw   || 0;
    const skuCount = stockMap[ts]?.skuSet.size || 0;
    const salesNW  = salesMap[ts]       || 0;
    const dailySales = salesNW / periodDays;
    const daySupply = dailySales > 0 ? stockNW / dailySales : null;
    return { typeSUK: ts, stockNW, skuCount, salesNW, periodDays, daySupply };
  }).filter(r => r.stockNW > 0 || r.salesNW > 0);

  return { periodLabel, periodStart, periodEnd, periodDays, report };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function ensureTables(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name='WMS_DaySupply_Periods' AND type='U')
    CREATE TABLE WMS_DaySupply_Periods (
      PeriodID    INT IDENTITY(1,1) PRIMARY KEY,
      PeriodLabel NVARCHAR(100) NOT NULL,
      PeriodStart DATE,
      PeriodEnd   DATE,
      PeriodDays  INT,
      FileName    NVARCHAR(255),
      UploadedBy  NVARCHAR(100),
      UploadedAt  DATETIME DEFAULT GETDATE()
    )`);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name='WMS_DaySupply_Rows' AND type='U')
    CREATE TABLE WMS_DaySupply_Rows (
      RowID      INT IDENTITY(1,1) PRIMARY KEY,
      PeriodID   INT NOT NULL,
      TypeSUK    NVARCHAR(100),
      SkuCount   INT DEFAULT 0,
      StockNW    DECIMAL(18,2) DEFAULT 0,
      SalesNW    DECIMAL(18,2) DEFAULT 0,
      DaySupply  DECIMAL(10,2),
      FOREIGN KEY (PeriodID) REFERENCES WMS_DaySupply_Periods(PeriodID) ON DELETE CASCADE
    )`);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/day-supply/upload
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'กรุณาแนบไฟล์ Excel' });
  try {
    const pool = getPool();
    await ensureTables(pool);
    const { periodLabel, periodStart, periodEnd, periodDays, report } = parseAndCompute(req.file.buffer);

    // Check duplicate period
    const dup = await pool.request()
      .input('lbl', sql.NVarChar, periodLabel)
      .query('SELECT PeriodID FROM WMS_DaySupply_Periods WHERE PeriodLabel=@lbl');
    if (dup.recordset.length) {
      return res.status(409).json({ message: `Period "${periodLabel}" มีอยู่แล้ว ลบก่อนถ้าต้องการอัพโหลดใหม่` });
    }

    // Insert period
    const pr = await pool.request()
      .input('lbl', sql.NVarChar, periodLabel)
      .input('ps',  sql.Date, periodStart)
      .input('pe',  sql.Date, periodEnd)
      .input('pd',  sql.Int,  periodDays)
      .input('fn',  sql.NVarChar, req.file.originalname)
      .input('ub',  sql.NVarChar, req.user?.username || '')
      .query(`INSERT INTO WMS_DaySupply_Periods (PeriodLabel,PeriodStart,PeriodEnd,PeriodDays,FileName,UploadedBy)
              OUTPUT INSERTED.PeriodID VALUES (@lbl,@ps,@pe,@pd,@fn,@ub)`);
    const periodID = pr.recordset[0].PeriodID;

    // Insert rows
    for (const r of report) {
      await pool.request()
        .input('pid', sql.Int,         periodID)
        .input('ts',  sql.NVarChar,    r.typeSUK)
        .input('sc',  sql.Int,         r.skuCount)
        .input('sn',  sql.Decimal(18,2), r.stockNW)
        .input('sl',  sql.Decimal(18,2), r.salesNW)
        .input('ds',  sql.Decimal(10,2), r.daySupply)
        .query(`INSERT INTO WMS_DaySupply_Rows (PeriodID,TypeSUK,SkuCount,StockNW,SalesNW,DaySupply)
                VALUES (@pid,@ts,@sc,@sn,@sl,@ds)`);
    }

    res.json({ success: true, periodID, periodLabel, rowCount: report.length });
  } catch (err) {
    console.error('day-supply upload error:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/day-supply  → full pivot report (all periods × TypeSUK)
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    await ensureTables(pool);

    const periods = await pool.request().query(
      'SELECT * FROM WMS_DaySupply_Periods ORDER BY PeriodStart, PeriodID');
    const rows = await pool.request().query(
      'SELECT r.*, p.PeriodLabel FROM WMS_DaySupply_Rows r JOIN WMS_DaySupply_Periods p ON r.PeriodID=p.PeriodID ORDER BY p.PeriodStart, p.PeriodID, r.TypeSUK');

    // Build pivot: typeSUK → periodLabel → values
    const typeOrder = ['สินค้าโป๊ว', 'NewItem', 'ขายดี', 'ขายน้อยขายต่อเนื่อง', 'ขายน้อยขายไม่ต่อเนื่อง'];
    const allTypes = [...new Set([...typeOrder, ...rows.recordset.map(r => r.TypeSUK)])];

    const pivot = allTypes.map(ts => {
      const entry = { typeSUK: ts, periods: {} };
      rows.recordset.filter(r => r.TypeSUK === ts).forEach(r => {
        entry.periods[r.PeriodLabel] = {
          stockNW: r.StockNW, salesNW: r.SalesNW, daySupply: r.DaySupply, skuCount: r.SkuCount,
        };
      });
      return entry;
    }).filter(e => Object.keys(e.periods).length > 0);

    res.json({ periods: periods.recordset, pivot });
  } catch (err) {
    console.error('day-supply get error:', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/day-supply/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    await pool.request().input('id', sql.Int, parseInt(req.params.id))
      .query('DELETE FROM WMS_DaySupply_Periods WHERE PeriodID=@id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/day-supply/export/:id  → Excel file for one period
router.get('/export/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const period = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT * FROM WMS_DaySupply_Periods WHERE PeriodID=@id');
    if (!period.recordset.length) return res.status(404).json({ message: 'ไม่พบ Period' });

    const rows = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT * FROM WMS_DaySupply_Rows WHERE PeriodID=@id ORDER BY TypeSUK');

    const p = period.recordset[0];
    const wb = XLSX.utils.book_new();
    const reportRows = [
      ['', 'STOCK คงเหลือ', p.PeriodLabel, '', `Day Supply`],
      ['', 'ยอดคงเหลือ (NW kg)', 'ยอดขาย (NW kg)', 'จำนวนวัน', 'Day Supply (วัน)'],
    ];
    for (const r of rows.recordset) {
      reportRows.push([r.TypeSUK, r.StockNW, r.SalesNW, r.PeriodDays ?? p.PeriodDays, r.DaySupply ?? '-']);
    }
    const ws = XLSX.utils.aoa_to_sheet(reportRows);
    ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'DaySupply');

    // All periods pivot sheet
    const allRows = await pool.request().query(
      'SELECT r.*, p.PeriodLabel FROM WMS_DaySupply_Rows r JOIN WMS_DaySupply_Periods p ON r.PeriodID=p.PeriodID ORDER BY p.PeriodStart, p.PeriodID, r.TypeSUK');
    const allPeriods = await pool.request().query('SELECT * FROM WMS_DaySupply_Periods ORDER BY PeriodStart, PeriodID');

    const periodLabels = allPeriods.recordset.map(p2 => p2.PeriodLabel);
    const pivotHeader = ['TypeSUK', ...periodLabels.flatMap(lbl => [`Stock NW\n${lbl}`, `Sales NW\n${lbl}`, `DaySupply\n${lbl}`])];
    const allTypes = [...new Set(allRows.recordset.map(r => r.TypeSUK))];
    const pivotData = allTypes.map(ts => {
      const cells = [ts];
      for (const lbl of periodLabels) {
        const match = allRows.recordset.find(r => r.TypeSUK === ts && r.PeriodLabel === lbl);
        cells.push(match?.StockNW ?? '', match?.SalesNW ?? '', match?.DaySupply ?? '');
      }
      return cells;
    });

    const ws2 = XLSX.utils.aoa_to_sheet([pivotHeader, ...pivotData]);
    XLSX.utils.book_append_sheet(wb, ws2, 'All Periods');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fname = `DaySupply_${p.PeriodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('day-supply export error:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/day-supply/export-all → Full pivot Excel (all periods)
router.get('/export-all', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const allPeriods = await pool.request().query('SELECT * FROM WMS_DaySupply_Periods ORDER BY PeriodStart, PeriodID');
    const allRows    = await pool.request().query(
      'SELECT r.*, p.PeriodLabel FROM WMS_DaySupply_Rows r JOIN WMS_DaySupply_Periods p ON r.PeriodID=p.PeriodID ORDER BY p.PeriodStart, p.PeriodID');

    const periodLabels = allPeriods.recordset.map(p => p.PeriodLabel);
    const typeOrder = ['สินค้าโป๊ว', 'NewItem', 'ขายดี', 'ขายน้อยขายต่อเนื่อง', 'ขายน้อยขายไม่ต่อเนื่อง'];
    const allTypesSet = [...new Set([...typeOrder, ...allRows.recordset.map(r => r.TypeSUK)])];
    const allTypes = allTypesSet.filter(ts => allRows.recordset.some(r => r.TypeSUK === ts));

    const wb = XLSX.utils.book_new();

    // Sheet 1: Stock NW pivot
    const stockHeader = ['TypeSUK', ...periodLabels];
    const stockRows   = allTypes.map(ts => [
      ts, ...periodLabels.map(lbl => {
        const m = allRows.recordset.find(r => r.TypeSUK === ts && r.PeriodLabel === lbl);
        return m?.StockNW ?? '';
      })
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([stockHeader, ...stockRows]);
    ws1['!cols'] = [{ wch: 30 }, ...periodLabels.map(() => ({ wch: 16 }))];
    XLSX.utils.book_append_sheet(wb, ws1, 'Stock NW');

    // Sheet 2: Day Supply pivot
    const dsHeader = ['TypeSUK', ...periodLabels];
    const dsRows   = allTypes.map(ts => [
      ts, ...periodLabels.map(lbl => {
        const m = allRows.recordset.find(r => r.TypeSUK === ts && r.PeriodLabel === lbl);
        return m?.DaySupply ?? '';
      })
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([dsHeader, ...dsRows]);
    ws2['!cols'] = [{ wch: 30 }, ...periodLabels.map(() => ({ wch: 16 }))];
    XLSX.utils.book_append_sheet(wb, ws2, 'Day Supply');

    // Sheet 3: Sales NW pivot
    const slHeader = ['TypeSUK', ...periodLabels];
    const slRows   = allTypes.map(ts => [
      ts, ...periodLabels.map(lbl => {
        const m = allRows.recordset.find(r => r.TypeSUK === ts && r.PeriodLabel === lbl);
        return m?.SalesNW ?? '';
      })
    ]);
    const ws3 = XLSX.utils.aoa_to_sheet([slHeader, ...slRows]);
    ws3['!cols'] = [{ wch: 30 }, ...periodLabels.map(() => ({ wch: 16 }))];
    XLSX.utils.book_append_sheet(wb, ws3, 'Sales NW');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="DaySupply_AllPeriods.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('day-supply export-all error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
