require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const { startSSHTunnel } = require('./src/db/tunnel');

const authRouter          = require('./src/routes/auth');
const trucksRouter        = require('./src/routes/trucks');
const dashboardRouter     = require('./src/routes/dashboard');
const trackingRouter      = require('./src/routes/tracking');
const utilsRouter         = require('./src/routes/utils');
const fleetRouter         = require('./src/routes/fleet');
const ordersRouter        = require('./src/routes/orders');
const employeesRouter     = require('./src/routes/employees');
const itemsRouter         = require('./src/routes/items');
const customersRouter     = require('./src/routes/customers');
const warehouseRouter     = require('./src/routes/warehouse');
const transferRouter      = require('./src/routes/transfer');
const transportCostRouter = require('./src/routes/transportcost');
const plansRouter         = require('./src/routes/plans');
const callRouter          = require('./src/routes/call');

const app  = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// CORS: dev เปิด localhost:5173, production เปิดทุก origin (same-server request ไม่ผ่าน CORS)
app.use(cors({
  origin: IS_PROD ? true : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ── API routes ──
app.use('/api/call',          callRouter);  // GAS-style universal dispatcher
app.use('/api/auth',          authRouter);
app.use('/api/trucks',        trucksRouter);
app.use('/api/dashboard',     dashboardRouter);
app.use('/api/tracking',      trackingRouter);
app.use('/api/utils',         utilsRouter);
app.use('/api/fleet',         fleetRouter);
app.use('/api/orders',        ordersRouter);
app.use('/api/employees',     employeesRouter);
app.use('/api/items',         itemsRouter);
app.use('/api/customers',     customersRouter);
app.use('/api/warehouse',     warehouseRouter);
app.use('/api/transfer',      transferRouter);
app.use('/api/transportcost', transportCostRouter);
app.use('/api/plans',         plansRouter);

app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString(), db: process.env.MSSQL_DB || '-', server: process.env.MSSQL_SERVER || '-' }));

app.get('/api/debug-date', async (_, res) => {
  try {
    const { getTodayStr, getYearStr } = require('./src/routes/utils');
    const { query } = require('./src/db/connection');
    const today = getTodayStr();
    const year  = getYearStr();
    const trucks = await query('SELECT TOP 5 [ID],[Date],[Status],[LicensePlate],[CheckinTimestamp] FROM dbo.Trucks ORDER BY [CheckinTimestamp] DESC').catch(e => ({ error: e.message }));
    res.json({ today, year, trucks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/myip', async (_, res) => {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const d = await r.json();
    return res.json({ outboundIp: d.ip });
  } catch (e) { return res.json({ error: e.message }); }
});

// ── Static files ──
// ถ้ามี public/index.html (GAS-migrated) ให้ serve ก่อน, ไม่งั้น fallback React build
const PUBLIC_DIR  = path.join(__dirname, 'public');
const CLIENT_DIST = path.join(__dirname, '../client/dist');

const fs = require('fs');
if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
} else {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (_, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

async function main() {
  if (process.env.SSH_TUNNEL_HOST) {
    try {
      await startSSHTunnel();
    } catch (e) {
      console.error('[tunnel] failed to start SSH tunnel:', e.message);
    }
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`CS Steel WMS running on port ${PORT} [${IS_PROD ? 'production' : 'development'}]`));
}
main();
