require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }));

// Logging & parsing
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'CS Steel WMS', time: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/master', require('./src/routes/master'));
app.use('/api/trips', require('./src/routes/trips'));
app.use('/api/weigh-in', require('./src/routes/weighIn'));
app.use('/api/data-station', require('./src/routes/dataStation'));
app.use('/api/loading-station', require('./src/routes/loadingStation'));
app.use('/api/weigh-out', require('./src/routes/weighOut'));
app.use('/api/checker', require('./src/routes/checker'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/eta', require('./src/routes/eta'));
app.use('/api/users', require('./src/routes/users'));

// Serve React frontend (production build)
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 CS Steel WMS Server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   URL: http://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();
