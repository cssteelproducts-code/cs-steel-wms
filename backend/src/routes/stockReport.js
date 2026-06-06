const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Parse Excel buffer → array of row objects
function parseStockExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

// Aggregate rows into dashboard data
function aggregate(rows) {
  const byCategory = {};   // Gname → { qty, weight, skus }
  const byWarehouse = {};  // Warehouse → { qty, weight }
  const byLocation = {};   // Warehouse+Location → { qty, weight, items }
  const byDate = {};       // Docdate → { qty, weight }
  const skuSet = new Set();
  let totalQty = 0, totalWeight = 0;
  let openingQty = 0, openingWeight = 0;
  let movInQty = 0, movInWeight = 0;
  let movOutQty = 0, movOutWeight = 0;

  for (const r of rows) {
    const cat = r['Gname'] || r['GategoryCode'] || 'ไม่ระบุ';
    const wh = r['Warehouse'] || 'ไม่ระบุ';
    const loc = r['Location'] || '';
    const qty = parseFloat(r['Quantity']) || 0;
    const uwt = parseFloat(r['UnitNetWeight']) || 0;
    const weight = qty * uwt / 1000; // kg → ton
    const mov = String(r['Mov'] || '').trim();
    const sku = r['Itemcode'] || '';
    const rawDate = r['Docdate'];
    const dateKey = rawDate
      ? (rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : String(rawDate).slice(0, 10))
      : null;

    if (sku) skuSet.add(sku);
    totalQty += qty;
    totalWeight += weight;

    // Opening vs movements
    if (mov === '00') { openingQty += qty; openingWeight += weight; }
    else if (qty > 0) { movInQty += qty; movInWeight += weight; }
    else { movOutQty += Math.abs(qty); movOutWeight += Math.abs(weight); }

    // By category
    if (!byCategory[cat]) byCategory[cat] = { qty: 0, weight: 0, skus: new Set() };
    byCategory[cat].qty += qty;
    byCategory[cat].weight += weight;
    if (sku) byCategory[cat].skus.add(sku);

    // By warehouse
    if (!byWarehouse[wh]) byWarehouse[wh] = { qty: 0, weight: 0 };
    byWarehouse[wh].qty += qty;
    byWarehouse[wh].weight += weight;

    // By location
    const locKey = `${wh}|${loc}`;
    if (!byLocation[locKey]) byLocation[locKey] = { warehouse: wh, location: loc, qty: 0, weight: 0, items: {} };
    byLocation[locKey].qty += qty;
    byLocation[locKey].weight += weight;
    if (sku) {
      if (!byLocation[locKey].items[sku]) byLocation[locKey].items[sku] = { name: r['ItemName'] || sku, qty: 0, weight: 0 };
      byLocation[locKey].items[sku].qty += qty;
      byLocation[locKey].items[sku].weight += weight;
    }

    // By date
    if (dateKey && mov !== '00') {
      if (!byDate[dateKey]) byDate[dateKey] = { qty: 0, weight: 0 };
      byDate[dateKey].qty += qty;
      byDate[dateKey].weight += weight;
    }
  }

  // Serialize Sets
  const categoryChart = Object.entries(byCategory)
    .map(([name, v]) => ({ name, qty: +v.qty.toFixed(0), weight: +v.weight.toFixed(2), skuCount: v.skus.size }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20);

  const warehouseChart = Object.entries(byWarehouse)
    .map(([name, v]) => ({ name, qty: +v.qty.toFixed(0), weight: +v.weight.toFixed(2) }))
    .sort((a, b) => b.weight - a.weight);

  const locationTable = Object.values(byLocation)
    .map(l => ({
      warehouse: l.warehouse,
      location: l.location,
      qty: +l.qty.toFixed(0),
      weight: +l.weight.toFixed(2),
      topItems: Object.values(l.items)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5)
        .map(i => ({ ...i, qty: +i.qty.toFixed(0), weight: +i.weight.toFixed(2) })),
    }))
    .sort((a, b) => b.weight - a.weight);

  const dateChart = Object.entries(byDate)
    .map(([date, v]) => ({ date, qty: +v.qty.toFixed(0), weight: +v.weight.toFixed(2) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30); // last 30 days

  return {
    summary: {
      totalRows: rows.length,
      skuCount: skuSet.size,
      totalQty: +totalQty.toFixed(0),
      totalWeightTon: +totalWeight.toFixed(2),
      openingQty: +openingQty.toFixed(0),
      openingWeightTon: +openingWeight.toFixed(2),
      movInQty: +movInQty.toFixed(0),
      movInWeightTon: +movInWeight.toFixed(2),
      movOutQty: +movOutQty.toFixed(0),
      movOutWeightTon: +movOutWeight.toFixed(2),
    },
    categoryChart,
    warehouseChart,
    locationTable,
    dateChart,
  };
}

// POST /api/stock-report/upload
router.post('/upload', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'กรุณาแนบไฟล์ Excel' });
  try {
    const rows = parseStockExcel(req.file.buffer);
    const data = aggregate(rows);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('stock-report parse error:', err);
    res.status(500).json({ message: 'ไม่สามารถอ่านไฟล์ได้: ' + err.message });
  }
});

module.exports = router;
