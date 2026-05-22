require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');

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

app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Static files (production) ──
// serve React build และ SPA fallback
const CLIENT_DIST = path.join(__dirname, '../client/dist');
app.use(express.static(CLIENT_DIST));
app.get('*', (_, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`CS Steel WMS running on port ${PORT} [${IS_PROD ? 'production' : 'development'}]`));
