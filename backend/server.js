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
app.use('/api/alerts', require('./src/routes/alerts'));
app.use('/api/stock', require('./src/routes/stock'));
app.use('/api/delivery', require('./src/routes/deliveryPlan'));
app.use('/api/transfer', require('./src/routes/transfer'));
app.use('/api/search', require('./src/routes/search'));
app.use('/api/records', require('./src/routes/records'));

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

const runMigrations = async () => {
  const { getPool } = require('./src/config/db');
  const pool = getPool();
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_VehicleTypes') AND name='CutoffHour')
        ALTER TABLE WMS_VehicleTypes ADD
          StartHour INT DEFAULT 8,
          StartMinute INT DEFAULT 0,
          CutoffHour INT DEFAULT 16,
          CutoffMinute INT DEFAULT 0;
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_ETAAssignments' AND xtype='U')
        CREATE TABLE WMS_ETAAssignments (
          VehicleID NVARCHAR(100) PRIMARY KEY,
          WarehouseID INT NOT NULL,
          UpdatedAt DATETIME DEFAULT GETDATE()
        );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_ETAVehicles' AND xtype='U')
        CREATE TABLE WMS_ETAVehicles (
          VehicleID NVARCHAR(100) PRIMARY KEY,
          LicensePlate NVARCHAR(50),
          Label NVARCHAR(100),
          IsTransport BIT DEFAULT 0,
          UpdatedAt DATETIME DEFAULT GETDATE()
        );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Warehouses') AND name='RadiusKm')
        ALTER TABLE WMS_Warehouses ADD RadiusKm FLOAT DEFAULT 5;
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_TransferStations' AND xtype='U')
        CREATE TABLE WMS_TransferStations (
          StationID INT IDENTITY(1,1) PRIMARY KEY,
          StationCode NVARCHAR(20) NOT NULL,
          StationName NVARCHAR(100) NOT NULL,
          StationType NVARCHAR(10) DEFAULT 'BOTH',
          IsActive BIT DEFAULT 1,
          SortOrder INT DEFAULT 0,
          CreatedAt DATETIME DEFAULT GETDATE()
        );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_TransferJobs' AND xtype='U')
        CREATE TABLE WMS_TransferJobs (
          JobID INT IDENTITY(1,1) PRIMARY KEY,
          JobCode NVARCHAR(30) NOT NULL,
          SourceStationID INT NOT NULL,
          DestStationID INT NOT NULL,
          ProductDesc NVARCHAR(500) NOT NULL,
          PlannedBundles INT NULL,
          PlannedWeightKg DECIMAL(12,3) NULL,
          ActualBundles INT NULL,
          ActualWeightKg DECIMAL(12,3) NULL,
          Status NVARCHAR(20) DEFAULT 'PENDING',
          Priority NVARCHAR(10) DEFAULT 'NORMAL',
          Notes NVARCHAR(500) NULL,
          CreatedBy INT NULL,
          CreatedAt DATETIME DEFAULT GETDATE(),
          CompletedAt DATETIME NULL
        );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_TransferTrips' AND xtype='U')
        CREATE TABLE WMS_TransferTrips (
          TripID INT IDENTITY(1,1) PRIMARY KEY,
          JobID INT NOT NULL,
          TripNo INT NOT NULL,
          BundleCount INT NULL,
          TotalWeightKg DECIMAL(12,3) NULL,
          SourceEntryTime DATETIME NULL,
          SourceExitTime DATETIME NULL,
          DestEntryTime DATETIME NULL,
          DestExitTime DATETIME NULL,
          Status NVARCHAR(20) DEFAULT 'PENDING',
          Notes NVARCHAR(500) NULL,
          OperatorID INT NULL,
          CreatedAt DATETIME DEFAULT GETDATE()
        );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_DataStationTargets' AND xtype='U')
        CREATE TABLE WMS_DataStationTargets (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          TripID INT NOT NULL,
          StationID INT NOT NULL,
          CreatedAt DATETIME DEFAULT GETDATE()
        );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Trips') AND name='DeliveryType')
        ALTER TABLE WMS_Trips ADD DeliveryType NVARCHAR(20) NULL;
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Trips') AND name='Priority')
        ALTER TABLE WMS_Trips ADD Priority NVARCHAR(20) NULL DEFAULT N'ปกติ';
    `);
    // Set on-time windows per vehicle type — only if still at default (8), so UI changes are preserved
    await pool.request().query(`
      UPDATE WMS_VehicleTypes SET StartHour=6,StartMinute=0,CutoffHour=16,CutoffMinute=0 WHERE TypeName LIKE N'%4 ล้อ%'   AND StartHour=8 AND CutoffHour=16;
      UPDATE WMS_VehicleTypes SET StartHour=6,StartMinute=0,CutoffHour=15,CutoffMinute=30 WHERE TypeName LIKE N'%6 ล้อ%'   AND StartHour=8;
      UPDATE WMS_VehicleTypes SET StartHour=6,StartMinute=0,CutoffHour=15,CutoffMinute=0 WHERE TypeName LIKE N'%10 ล้อ%'  AND StartHour=8;
      UPDATE WMS_VehicleTypes SET StartHour=6,StartMinute=0,CutoffHour=14,CutoffMinute=0 WHERE TypeName LIKE N'%12 ล้อ%'  AND StartHour=8;
      UPDATE WMS_VehicleTypes SET StartHour=6,StartMinute=0,CutoffHour=14,CutoffMinute=0 WHERE TypeName LIKE N'%พ่วง%'    AND StartHour=8;
      UPDATE WMS_VehicleTypes SET StartHour=6,StartMinute=0,CutoffHour=14,CutoffMinute=0 WHERE TypeName LIKE N'%เทรลเลอร์%' AND StartHour=8;
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_CheckerRecord') AND name='CheckDurationMinutes')
        ALTER TABLE WMS_CheckerRecord ADD CheckDurationMinutes INT NULL;
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_CheckerRecord') AND name='CheckStartTime')
        ALTER TABLE WMS_CheckerRecord ADD CheckStartTime DATETIME NULL;
    `);
    // Ensure TRANSFER permission exists for Admin role
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM WMS_MenuPermissions mp
        JOIN WMS_Roles r ON mp.RoleID=r.RoleID
        WHERE r.RoleName='Admin' AND mp.MenuCode='TRANSFER'
      )
      INSERT INTO WMS_MenuPermissions (RoleID, MenuCode, MenuName, CanView, CanCreate, CanEdit, CanDelete)
      SELECT r.RoleID, 'TRANSFER', N'ย้ายสินค้าภายใน', 1, 1, 1, 1
      FROM WMS_Roles r WHERE r.RoleName='Admin';
    `);
    // Add VehicleTypeID to WMS_AlertConfig for per-vehicle-type OVERSTAY thresholds
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_AlertConfig') AND name='VehicleTypeID')
        ALTER TABLE WMS_AlertConfig ADD VehicleTypeID INT NULL;
    `);
    // Ensure RECORDS permission exists for Admin role
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM WMS_MenuPermissions mp
        JOIN WMS_Roles r ON mp.RoleID=r.RoleID
        WHERE r.RoleName='Admin' AND mp.MenuCode='RECORDS'
      )
      INSERT INTO WMS_MenuPermissions (RoleID, MenuCode, MenuName, CanView, CanCreate, CanEdit, CanDelete)
      SELECT r.RoleID, 'RECORDS', N'บันทึกการขึ้นสินค้า', 1, 1, 1, 1
      FROM WMS_Roles r WHERE r.RoleName='Admin';
    `);
    console.log('✅ Migrations applied');
  } catch (e) {
    console.warn('⚠ Migration warning:', e.message);
  }
};

const startServer = () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 CS Steel WMS Server running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   URL: http://localhost:${PORT}\n`);
  });

  // Connect to DB after server is listening so healthcheck doesn't time out
  connectDB()
    .then(runMigrations)
    .catch(err => {
      console.error('❌ Database connection failed:', err.message);
      process.exit(1);
    });
};

startServer();
