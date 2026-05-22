const router = require('express').Router();
const { query, execute } = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

const DEFAULT_COST_SETTINGS = {
  fuelCostPerLiter: 35,
  avgFuelEfficiencyKmL: 5,
  zones: [
    { name: 'กรุงเทพฯ',         distKm: 30,  baseCost: 800,  perKgRate: 2 },
    { name: 'ปริมณฑล',          distKm: 60,  baseCost: 1200, perKgRate: 2.5 },
    { name: 'ต่างจังหวัด',     distKm: 150, baseCost: 2500, perKgRate: 3 },
    { name: 'ไกล (>200 กม.)',   distKm: 250, baseCost: 4000, perKgRate: 4 },
  ],
  vehicleSurcharge: {
    '4 ล้อ':  0,
    '6 ล้อ':  500,
    '8 ล้อ':  1000,
    '10 ล้อ': 1500,
    '12 ล้อ': 2000,
    'เทเลอร์': 3000,
    'พ่วง':   3500,
  },
};

async function getCostSettings() {
  const rows = await query("SELECT [Value] FROM dbo.AppConfig WHERE [Key]=N'COST_SETTINGS'");
  if (rows.length && rows[0].Value) {
    try { return JSON.parse(rows[0].Value); } catch { return DEFAULT_COST_SETTINGS; }
  }
  return DEFAULT_COST_SETTINGS;
}

// GET /api/transportcost/settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getCostSettings();
    return res.json({ success: true, settings });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/transportcost/settings/save
router.post('/settings/save', async (req, res) => {
  try {
    const { settings } = req.body;
    const json = JSON.stringify(settings);
    const existing = await query("SELECT [Key] FROM dbo.AppConfig WHERE [Key]=N'COST_SETTINGS'");
    if (existing.length) {
      await execute("UPDATE dbo.AppConfig SET [Value]=@v,[UpdatedAt]=@ua WHERE [Key]=N'COST_SETTINGS'",
        { v: json, ua: new Date().toISOString() });
    } else {
      await execute("INSERT INTO dbo.AppConfig ([Key],[Value],[UpdatedAt]) VALUES (N'COST_SETTINGS',@v,@ua)",
        { v: json, ua: new Date().toISOString() });
    }
    return res.json({ success: true, message: 'บันทึกการตั้งค่าค่าขนส่งสำเร็จ' });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

// POST /api/transportcost/calculate
router.post('/calculate', async (req, res) => {
  try {
    const { zone, weightKg, vehicleType, distKm, quantity } = req.body;
    const settings = await getCostSettings();

    let zoneConfig = settings.zones.find(z => z.name === zone);
    if (!zoneConfig && distKm) {
      zoneConfig = { distKm: parseFloat(distKm), baseCost: 800, perKgRate: 2 };
    }
    if (!zoneConfig) return res.json({ success: false, message: 'ไม่พบโซน' });

    const effectiveDist = distKm ? parseFloat(distKm) : zoneConfig.distKm;
    const fuelCost = (effectiveDist / settings.avgFuelEfficiencyKmL) * settings.fuelCostPerLiter;
    const weightCost = (parseFloat(weightKg) || 0) * (zoneConfig.perKgRate || 2);
    const surcharge  = settings.vehicleSurcharge?.[vehicleType] || 0;
    const baseCost   = zoneConfig.baseCost || 0;
    const totalCost  = Math.ceil(baseCost + weightCost + fuelCost + surcharge);
    const qty = parseFloat(quantity) || 1;

    return res.json({
      success: true,
      breakdown: {
        baseCost:   Math.ceil(baseCost),
        weightCost: Math.ceil(weightCost),
        fuelCost:   Math.ceil(fuelCost),
        surcharge:  Math.ceil(surcharge),
        totalCost,
        perUnit:    Math.ceil(totalCost / qty),
        distKm:     effectiveDist,
      },
    });
  } catch (e) { return res.json({ success: false, message: e.message }); }
});

module.exports = router;
