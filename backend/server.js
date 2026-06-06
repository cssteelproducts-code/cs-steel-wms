process.env.TZ = 'Asia/Bangkok';
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
app.set('trust proxy', 1);
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 600, skip: (req) => req.path === '/health' }));

// Logging & parsing
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(require('compression')());
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
app.use('/api/stock-count', require('./src/routes/stockCount'));
app.use('/api/delivery', require('./src/routes/deliveryPlan'));
app.use('/api/transfer', require('./src/routes/transfer'));
app.use('/api/search', require('./src/routes/search'));
app.use('/api/shift-plan', require('./src/routes/shiftPlan'));
app.use('/api/records', require('./src/routes/records'));
app.use('/api/forecast', require('./src/routes/forecast'));
app.use('/api/location-check', require('./src/routes/locationCheck'));
app.use('/api/tms', require('./src/routes/tms'));

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
          VehicleID INT NULL,
          CreatedAt DATETIME DEFAULT GETDATE()
        );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_TransferVehicles' AND xtype='U')
        CREATE TABLE WMS_TransferVehicles (
          VehicleID INT IDENTITY(1,1) PRIMARY KEY,
          VehiclePlate NVARCHAR(20) NOT NULL,
          VehicleName NVARCHAR(100) NULL,
          IsActive BIT DEFAULT 1,
          CreatedAt DATETIME DEFAULT GETDATE()
        );
    `);
    // Add vehicle status columns (migration for existing installs)
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_TransferVehicles') AND name='VehicleCode')
        ALTER TABLE WMS_TransferVehicles ADD VehicleCode NVARCHAR(20) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_TransferVehicles') AND name='VehicleType')
        ALTER TABLE WMS_TransferVehicles ADD VehicleType NVARCHAR(50) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_TransferVehicles') AND name='VehicleStatus')
        ALTER TABLE WMS_TransferVehicles ADD VehicleStatus NVARCHAR(20) NOT NULL DEFAULT 'READY';
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_TransferVehicles') AND name='StatusNote')
        ALTER TABLE WMS_TransferVehicles ADD StatusNote NVARCHAR(500) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_TransferVehicles') AND name='RepairStartDate')
        ALTER TABLE WMS_TransferVehicles ADD RepairStartDate DATE NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_TransferVehicles') AND name='RepairExpectedDate')
        ALTER TABLE WMS_TransferVehicles ADD RepairExpectedDate DATE NULL;
    `);
    // Seed initial transfer vehicles from Excel data
    const seedVehicles = [
      { code: 'FG03', plate: '81-3359', type: '10 ล้อ' },
      { code: 'FG04', plate: '78-7301', type: '6 ล้อ' },
      { code: 'FG05', plate: '79-2671', type: '10 ล้อ' },
      { code: 'FG06', plate: '78-7298', type: '6 ล้อ' },
      { code: 'FG07', plate: '78-7300', type: '10 ล้อ' },
      { code: 'FG08', plate: '78-7302', type: '6 ล้อ' },
      { code: 'FG09', plate: '60-8708', type: '10 ล้อ' },
      { code: 'FL5',  plate: 'TMC',     type: '10 ล้อ' },
      { code: 'FL7',  plate: 'NISSAN',  type: '10 ล้อ' },
    ];
    for (const v of seedVehicles) {
      const exists = await pool.request()
        .input('plate', sql.NVarChar, v.plate)
        .query('SELECT 1 FROM WMS_TransferVehicles WHERE VehiclePlate=@plate');
      if (!exists.recordset.length) {
        await pool.request()
          .input('code', sql.NVarChar, v.code)
          .input('plate', sql.NVarChar, v.plate)
          .input('type', sql.NVarChar, v.type)
          .query('INSERT INTO WMS_TransferVehicles (VehicleCode,VehiclePlate,VehicleType) VALUES (@code,@plate,@type)');
      }
    }
    console.log('✅ TransferVehicles seeded');
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
    // Performance indexes for common query patterns
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Trips_Status' AND object_id=OBJECT_ID('WMS_Trips'))
        CREATE INDEX IX_Trips_Status ON WMS_Trips (Status) INCLUDE (TripDate, LicensePlate, VehicleTypeID, CustomerID, WarehouseID, Priority, CreatedAt, CompletedAt);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Trips_TripDate' AND object_id=OBJECT_ID('WMS_Trips'))
        CREATE INDEX IX_Trips_TripDate ON WMS_Trips (TripDate, Status);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_LoadingRecord_TripID' AND object_id=OBJECT_ID('WMS_LoadingRecord'))
        CREATE INDEX IX_LoadingRecord_TripID ON WMS_LoadingRecord (TripID) INCLUDE (StationID, EntryTime, ExitTime, DurationMinutes, Round);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_LoadingRecord_StationID' AND object_id=OBJECT_ID('WMS_LoadingRecord'))
        CREATE INDEX IX_LoadingRecord_StationID ON WMS_LoadingRecord (StationID, ExitTime) INCLUDE (TripID, EntryTime);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_WeighIn_TripID' AND object_id=OBJECT_ID('WMS_WeighIn'))
        CREATE INDEX IX_WeighIn_TripID ON WMS_WeighIn (TripID);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_WeighOut_TripID' AND object_id=OBJECT_ID('WMS_WeighOut'))
        CREATE INDEX IX_WeighOut_TripID ON WMS_WeighOut (TripID);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CheckerRecord_TripID' AND object_id=OBJECT_ID('WMS_CheckerRecord'))
        CREATE INDEX IX_CheckerRecord_TripID ON WMS_CheckerRecord (TripID);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Alerts_Unread' AND object_id=OBJECT_ID('WMS_Alerts'))
        CREATE INDEX IX_Alerts_Unread ON WMS_Alerts (IsRead, IsResolved) INCLUDE (AlertType, TripID, CreatedAt);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_DataStation_TripID' AND object_id=OBJECT_ID('WMS_DataStation'))
        CREATE INDEX IX_DataStation_TripID ON WMS_DataStation (TripID);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Trips_LicensePlate' AND object_id=OBJECT_ID('WMS_Trips'))
        CREATE INDEX IX_Trips_LicensePlate ON WMS_Trips (LicensePlate) INCLUDE (Status, TripDate, CreatedAt);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Customers_Search' AND object_id=OBJECT_ID('WMS_Customers'))
        CREATE INDEX IX_Customers_Search ON WMS_Customers (CustomerName, CustomerCode) WHERE IsActive = 1;
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
    // StockCount tables
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_StockCountSessions' AND xtype='U')
      CREATE TABLE WMS_StockCountSessions (
        SessionID INT IDENTITY(1,1) PRIMARY KEY,
        SessionName NVARCHAR(200) NOT NULL,
        WarehouseCode NVARCHAR(20),
        Status NVARCHAR(20) DEFAULT 'DRAFT',
        Notes NVARCHAR(500),
        CreatedBy NVARCHAR(100),
        CreatedAt DATETIME DEFAULT GETDATE(),
        OpenedAt DATETIME,
        CompletedAt DATETIME,
        IsActive BIT DEFAULT 1
      );`);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_StockCountItems' AND xtype='U')
      CREATE TABLE WMS_StockCountItems (
        ItemID INT IDENTITY(1,1) PRIMARY KEY,
        SessionID INT NOT NULL,
        Warehouse NVARCHAR(20),
        Location NVARCHAR(50),
        ItemCode NVARCHAR(50),
        ItemName NVARCHAR(300),
        TypeSKU NVARCHAR(50),
        CategoryCode NVARCHAR(20),
        CategoryName NVARCHAR(100),
        SizeCode NVARCHAR(100),
        SystemQty DECIMAL(12,2) DEFAULT 0,
        SystemWeight DECIMAL(12,2),
        IsLocked BIT DEFAULT 0,
        NeedsRecount BIT DEFAULT 0,
        LockedAt DATETIME,
        LockedBy NVARCHAR(100)
      );`);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_StockCountEntries' AND xtype='U')
      CREATE TABLE WMS_StockCountEntries (
        EntryID INT IDENTITY(1,1) PRIMARY KEY,
        ItemID INT NOT NULL,
        SessionID INT NOT NULL,
        Round INT DEFAULT 1,
        CountedQty DECIMAL(12,2) NOT NULL,
        CountedBy NVARCHAR(100),
        CountedAt DATETIME DEFAULT GETDATE(),
        Notes NVARCHAR(300)
      );`);
    console.log('✅ StockCount tables ready');
    // Ensure STOCKCOUNT_OFFICE permission exists for Admin role
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM WMS_MenuPermissions mp
        JOIN WMS_Roles r ON mp.RoleID=r.RoleID
        WHERE r.RoleName='Admin' AND mp.MenuCode='STOCKCOUNT_OFFICE'
      )
      INSERT INTO WMS_MenuPermissions (RoleID, MenuCode, MenuName, CanView, CanCreate, CanEdit, CanDelete)
      SELECT r.RoleID, 'STOCKCOUNT_OFFICE', N'จัดการรอบตรวจนับ', 1, 1, 1, 1
      FROM WMS_Roles r WHERE r.RoleName='Admin';
    `);
    // Ensure STOCKCOUNT_FIELD permission exists for Admin role
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM WMS_MenuPermissions mp
        JOIN WMS_Roles r ON mp.RoleID=r.RoleID
        WHERE r.RoleName='Admin' AND mp.MenuCode='STOCKCOUNT_FIELD'
      )
      INSERT INTO WMS_MenuPermissions (RoleID, MenuCode, MenuName, CanView, CanCreate, CanEdit, CanDelete)
      SELECT r.RoleID, 'STOCKCOUNT_FIELD', N'ตรวจนับ (หน้างาน)', 1, 1, 1, 1
      FROM WMS_Roles r WHERE r.RoleName='Admin';
    `);
    // Ensure FREIGHT_CALC permission exists for Admin role
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM WMS_MenuPermissions mp
        JOIN WMS_Roles r ON mp.RoleID=r.RoleID
        WHERE r.RoleName='Admin' AND mp.MenuCode='FREIGHT_CALC'
      )
      INSERT INTO WMS_MenuPermissions (RoleID, MenuCode, MenuName, CanView, CanCreate, CanEdit, CanDelete)
      SELECT r.RoleID, 'FREIGHT_CALC', N'คำนวณค่าขนส่ง', 1, 1, 1, 1
      FROM WMS_Roles r WHERE r.RoleName='Admin';
    `);
    console.log('✅ Migrations applied');
  } catch (e) {
    console.warn('⚠ Migration warning:', e.message);
  }

  // Critical standalone migrations (each in own try/catch so others still run)
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_TransferTrips') AND name='VehicleID')
        ALTER TABLE WMS_TransferTrips ADD VehicleID INT NULL;
    `);
    console.log('✅ TransferTrips.VehicleID column ready');
  } catch (e) {
    console.warn('⚠ TransferTrips.VehicleID migration:', e.message);
  }

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Trips') AND name='SOWaitStartedAt')
        ALTER TABLE WMS_Trips ADD SOWaitStartedAt DATETIME NULL;
    `);
    console.log('✅ SOWaitStartedAt column ready');
  } catch (e) {
    console.warn('⚠ SOWaitStartedAt migration:', e.message);
  }

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_LoadingRecord') AND name='Round')
        ALTER TABLE WMS_LoadingRecord ADD Round INT NULL DEFAULT 1;
    `);
    console.log('✅ LoadingRecord.Round column ready');
  } catch (e) {
    console.warn('⚠ Round migration:', e.message);
  }

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Users') AND name='SessionDurationHours')
        ALTER TABLE WMS_Users ADD SessionDurationHours INT NULL;
    `);
    console.log('✅ SessionDurationHours column ready');
  } catch (e) {
    console.warn('⚠ SessionDurationHours migration:', e.message);
  }

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='WMS_Products')
        CREATE TABLE WMS_Products (
          ProductID       INT IDENTITY(1,1) PRIMARY KEY,
          ProductCode     NVARCHAR(50)  NOT NULL UNIQUE,
          ProductName     NVARCHAR(200) NOT NULL,
          SKUType         NVARCHAR(50)  NULL,
          CategoryCode    NVARCHAR(10)  NULL,
          CategoryName    NVARCHAR(100) NULL,
          MaterialType    NVARCHAR(20)  NULL,
          FormCode        NVARCHAR(20)  NULL,
          SizeCode        NVARCHAR(50)  NULL,
          Thickness       DECIMAL(8,2)  NULL,
          TargetGroup     NVARCHAR(100) NULL,
          UnitNetWeight   DECIMAL(10,3) NULL,
          IsActive        BIT DEFAULT 1,
          CreatedAt       DATETIME DEFAULT GETDATE(),
          UpdatedAt       DATETIME NULL
        );
    `);
    console.log('✅ WMS_Products table ready');
  } catch (e) {
    console.warn('⚠ WMS_Products migration:', e.message);
  }

  // Add missing columns to existing WMS_Products table
  const productsAlters = [
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Products') AND name='SKUType')
       ALTER TABLE WMS_Products ADD SKUType NVARCHAR(50) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Products') AND name='CategoryCode')
       ALTER TABLE WMS_Products ADD CategoryCode NVARCHAR(10) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Products') AND name='CategoryName')
       ALTER TABLE WMS_Products ADD CategoryName NVARCHAR(100) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Products') AND name='MaterialType')
       ALTER TABLE WMS_Products ADD MaterialType NVARCHAR(20) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Products') AND name='FormCode')
       ALTER TABLE WMS_Products ADD FormCode NVARCHAR(20) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Products') AND name='SizeCode')
       ALTER TABLE WMS_Products ADD SizeCode NVARCHAR(50) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Products') AND name='Thickness')
       ALTER TABLE WMS_Products ADD Thickness DECIMAL(8,2) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Products') AND name='TargetGroup')
       ALTER TABLE WMS_Products ADD TargetGroup NVARCHAR(100) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Products') AND name='UnitNetWeight')
       ALTER TABLE WMS_Products ADD UnitNetWeight DECIMAL(10,3) NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Products') AND name='UpdatedAt')
       ALTER TABLE WMS_Products ADD UpdatedAt DATETIME NULL`,
  ];
  await Promise.all(productsAlters.map(q =>
    pool.request().query(q).catch(e => console.warn('⚠ Products alter:', e.message))
  ));
  console.log('✅ WMS_Products columns ready');

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='WMS_LocationTypes')
        CREATE TABLE WMS_LocationTypes (
          TypeID    INT IDENTITY(1,1) PRIMARY KEY,
          TypeCode  NVARCHAR(20)  NOT NULL UNIQUE,
          TypeName  NVARCHAR(50)  NOT NULL,
          SortOrder INT DEFAULT 0,
          IsActive  BIT DEFAULT 1
        );
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='WMS_Locations')
        CREATE TABLE WMS_Locations (
          LocationID     INT IDENTITY(1,1) PRIMARY KEY,
          WarehouseID    INT NULL,
          LocationCode   NVARCHAR(20)  NOT NULL,
          LocationName   NVARCHAR(100) NOT NULL,
          LocationTypeID INT NULL,
          IsActive       BIT DEFAULT 1
        );
    `);
    console.log('✅ WMS_LocationTypes + WMS_Locations ready');
  } catch (e) {
    console.warn('⚠ WMS_Products migration:', e.message);
  }

  // Performance indexes
  const indexes = [
    [`IX_Trips_TripDate_Status`, `WMS_Trips`, `TripDate, Status`],
    [`IX_Trips_Status_TripDate`, `WMS_Trips`, `Status, TripDate`],
    [`IX_LoadingRecord_TripID_ExitTime`, `WMS_LoadingRecord`, `TripID, ExitTime`],
    [`IX_LoadingRecord_StationID_Exit`, `WMS_LoadingRecord`, `StationID, ExitTime`],
    [`IX_DataStationTargets_TripID`, `WMS_DataStationTargets`, `TripID`],
    [`IX_DataStationTargets_StationID`, `WMS_DataStationTargets`, `StationID`],
    [`IX_WeighIn_TripID`, `WMS_WeighIn`, `TripID`],
    [`IX_WeighOut_TripID`, `WMS_WeighOut`, `TripID`],
    [`IX_Alerts_IsRead_IsResolved`, `WMS_Alerts`, `IsRead, IsResolved`],
    [`IX_CheckerRecord_TripID`, `WMS_CheckerRecord`, `TripID`],
    [`IX_Users_IsActive`, `WMS_Users`, `IsActive, UserID`],
  ];
  for (const [name, table, cols] of indexes) {
    try {
      await pool.request().query(
        `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='${name}' AND object_id=OBJECT_ID('${table}'))
           CREATE INDEX ${name} ON ${table}(${cols});`
      );
    } catch (e) {
      console.warn(`⚠ Index ${name}:`, e.message);
    }
  }
  console.log('✅ Performance indexes ready');

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_ShiftPlanConfig' AND xtype='U')
        CREATE TABLE WMS_ShiftPlanConfig (
          ConfigID INT IDENTITY(1,1) PRIMARY KEY,
          ConfigKey NVARCHAR(50) NOT NULL DEFAULT 'default',
          ConfigJSON NVARCHAR(MAX) NOT NULL,
          UpdatedAt DATETIME DEFAULT GETDATE()
        );
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_ShiftPlanRecords' AND xtype='U')
        CREATE TABLE WMS_ShiftPlanRecords (
          RecordID INT IDENTITY(1,1) PRIMARY KEY,
          RecordDate DATE NOT NULL,
          EndTime NVARCHAR(10) NOT NULL,
          OTEmp INT DEFAULT 0,
          OTHrs1 DECIMAL(10,2) DEFAULT 0,
          OTHrs2 DECIMAL(10,2) DEFAULT 0,
          CreatedAt DATETIME DEFAULT GETDATE()
        );
    `);
    console.log('✅ WMS_ShiftPlan tables ready');
  } catch (e) { console.warn('⚠ ShiftPlan migration:', e.message); }

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Customers') AND name='ARCode')
        ALTER TABLE WMS_Customers ADD ARCode NVARCHAR(50) NULL;
    `);
    console.log('✅ WMS_Customers.ARCode column ready');
  } catch (e) { console.warn('⚠ ARCode migration:', e.message); }

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Roles') AND name='SortOrder')
        ALTER TABLE WMS_Roles ADD SortOrder INT NOT NULL DEFAULT 0;
    `);
    console.log('✅ WMS_Roles.SortOrder column ready');
  } catch (e) {
    console.warn('⚠ WMS_Roles.SortOrder migration:', e.message);
  }

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Users') AND name='UserLevel')
        ALTER TABLE WMS_Users ADD UserLevel INT NOT NULL DEFAULT 0;
    `);
    console.log('✅ WMS_Users.UserLevel column ready');
  } catch (e) {
    console.warn('⚠ WMS_Users.UserLevel migration:', e.message);
  }

  // Fix WMS_StockCountEntries schema (drop if missing SessionID column so it recreates correctly)
  try {
    await pool.request().query(`
      IF OBJECT_ID('WMS_StockCountEntries','U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id=OBJECT_ID('WMS_StockCountEntries') AND name='SessionID'
        )
        BEGIN
          DROP TABLE WMS_StockCountEntries;
        END
      END
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_StockCountEntries' AND xtype='U')
      CREATE TABLE WMS_StockCountEntries (
        EntryID INT IDENTITY(1,1) PRIMARY KEY, ItemID INT NOT NULL, SessionID INT NOT NULL,
        Round INT DEFAULT 1, CountedQty DECIMAL(12,2) NOT NULL,
        CountedBy NVARCHAR(100), CountedAt DATETIME DEFAULT GETDATE(), Notes NVARCHAR(300)
      );
    `);
    console.log('✅ WMS_StockCountEntries schema OK');
  } catch (e) {
    console.warn('⚠ WMS_StockCountEntries schema migration:', e.message);
  }

  // Fix WMS_StockCountItems schema (old schema had CountID/ProductID, new needs SessionID)
  try {
    await pool.request().query(`
      IF OBJECT_ID('WMS_StockCountItems','U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='SessionID'
        )
        BEGIN
          IF OBJECT_ID('WMS_StockCountEntries','U') IS NOT NULL
          BEGIN
            DROP TABLE WMS_StockCountEntries;
          END
          DROP TABLE WMS_StockCountItems;
        END
      END
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_StockCountSessions' AND xtype='U')
      CREATE TABLE WMS_StockCountSessions (
        SessionID INT IDENTITY(1,1) PRIMARY KEY, SessionName NVARCHAR(200) NOT NULL,
        WarehouseCode NVARCHAR(20), Status NVARCHAR(20) DEFAULT 'DRAFT', Notes NVARCHAR(500),
        CreatedBy NVARCHAR(100), CreatedAt DATETIME DEFAULT GETDATE(),
        OpenedAt DATETIME, CompletedAt DATETIME, IsActive BIT DEFAULT 1
      );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_StockCountItems' AND xtype='U')
      CREATE TABLE WMS_StockCountItems (
        ItemID INT IDENTITY(1,1) PRIMARY KEY, SessionID INT NOT NULL,
        Warehouse NVARCHAR(20), Location NVARCHAR(50), ItemCode NVARCHAR(50),
        ItemName NVARCHAR(300), TypeSKU NVARCHAR(50), CategoryCode NVARCHAR(20),
        CategoryName NVARCHAR(100), SizeCode NVARCHAR(100),
        SystemQty DECIMAL(12,2) DEFAULT 0, SystemWeight DECIMAL(12,2),
        IsLocked BIT DEFAULT 0, NeedsRecount BIT DEFAULT 0,
        LockedAt DATETIME, LockedBy NVARCHAR(100)
      );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_StockCountEntries' AND xtype='U')
      CREATE TABLE WMS_StockCountEntries (
        EntryID INT IDENTITY(1,1) PRIMARY KEY, ItemID INT NOT NULL, SessionID INT NOT NULL,
        Round INT DEFAULT 1, CountedQty DECIMAL(12,2) NOT NULL,
        CountedBy NVARCHAR(100), CountedAt DATETIME DEFAULT GETDATE(), Notes NVARCHAR(300)
      );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_StockCountItems_SessionID' AND object_id=OBJECT_ID('WMS_StockCountItems'))
        CREATE INDEX IX_StockCountItems_SessionID ON WMS_StockCountItems (SessionID);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('WMS_StockCountItems') AND name='Thickness')
        ALTER TABLE WMS_StockCountItems ADD Thickness NVARCHAR(50) NULL;
    `);
    console.log('✅ WMS_StockCountItems schema OK');
  } catch (e) {
    console.warn('⚠ WMS_StockCountItems schema migration:', e.message);
  }

  // TMS tables
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_TMS_Orders' AND xtype='U')
      CREATE TABLE WMS_TMS_Orders (
        TmsOrderID    INT IDENTITY(1,1) PRIMARY KEY,
        SourceOrderNo NVARCHAR(50), PoNo NVARCHAR(100),
        CustCode      NVARCHAR(50), CustName NVARCHAR(200),
        DeliveryAddr  NVARCHAR(500), City NVARCHAR(100),
        Province      NVARCHAR(100), PostalCode NVARCHAR(20),
        OrderDate     DATE, ShipByDate DATE,
        ShipType      NVARCHAR(100), DistanceKm DECIMAL(10,2) DEFAULT 0,
        TotalWeightKg DECIMAL(12,3) DEFAULT 0,
        TotalQty      DECIMAL(12,3) DEFAULT 0,
        Status        NVARCHAR(20) DEFAULT N'PENDING',
        ImportBatch   NVARCHAR(100),
        CreatedAt     DATETIME DEFAULT GETDATE()
      );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_TMS_OrderLines' AND xtype='U')
      CREATE TABLE WMS_TMS_OrderLines (
        LineID        INT IDENTITY(1,1) PRIMARY KEY,
        TmsOrderID    INT NOT NULL, LineNo INT DEFAULT 0,
        PartCode      NVARCHAR(100), PartDesc NVARCHAR(300),
        Qty           DECIMAL(12,3) DEFAULT 0,
        UOM           NVARCHAR(20),
        WeightPerUnit DECIMAL(10,3) DEFAULT 0,
        TotalWeightKg DECIMAL(12,3) DEFAULT 0,
        ItemLength    DECIMAL(8,3), ItemWidth DECIMAL(8,3), ItemHeight DECIMAL(8,3)
      );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_TMS_OL_OrderID' AND object_id=OBJECT_ID('WMS_TMS_OrderLines'))
        CREATE INDEX IX_TMS_OL_OrderID ON WMS_TMS_OrderLines(TmsOrderID);
    `);
    await pool.request().query(`
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
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_TMS_Trips' AND xtype='U')
      CREATE TABLE WMS_TMS_Trips (
        TripID        INT IDENTITY(1,1) PRIMARY KEY,
        PlanID        INT NOT NULL, TripNo INT DEFAULT 1,
        VehicleID     INT, LicensePlate NVARCHAR(20),
        DriverName    NVARCHAR(100), PayloadKg DECIMAL(10,2),
        BedLength     DECIMAL(8,3), BedWidth DECIMAL(8,3),
        TotalStops    INT DEFAULT 0, TotalDistKm DECIMAL(10,2) DEFAULT 0,
        TotalWeightKg DECIMAL(12,3) DEFAULT 0,
        Status        NVARCHAR(20) DEFAULT N'DRAFT'
      );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='WMS_TMS_TripStops' AND xtype='U')
      CREATE TABLE WMS_TMS_TripStops (
        StopID         INT IDENTITY(1,1) PRIMARY KEY,
        TripID         INT NOT NULL, StopNo INT NOT NULL,
        TmsOrderID     INT NOT NULL, DistFromPrevKm DECIMAL(10,2) DEFAULT 0,
        Status         NVARCHAR(20) DEFAULT N'PENDING'
      );
    `);
    await pool.request().query(`
      IF OBJECT_ID('WMS_Products','U') IS NOT NULL BEGIN
        IF COL_LENGTH('WMS_Products','ItemLength') IS NULL ALTER TABLE WMS_Products ADD ItemLength DECIMAL(8,3) NULL;
        IF COL_LENGTH('WMS_Products','ItemWidth')  IS NULL ALTER TABLE WMS_Products ADD ItemWidth  DECIMAL(8,3) NULL;
        IF COL_LENGTH('WMS_Products','ItemHeight') IS NULL ALTER TABLE WMS_Products ADD ItemHeight DECIMAL(8,3) NULL;
      END
    `);
    console.log('✅ TMS tables ready');
  } catch (e) {
    console.warn('⚠ TMS tables migration:', e.message);
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
    .then(() => {
      const { runAlertCheck } = require('./src/jobs/alertJob');
      const ALERT_INTERVAL_MS = 5 * 60 * 1000; // ทุก 5 นาที
      runAlertCheck().catch(() => {});
      setInterval(() => runAlertCheck().catch(() => {}), ALERT_INTERVAL_MS);
      console.log('⏰ Alert auto-check started (every 5 min)');
    })
    .catch(err => {
      console.error('❌ Database connection failed:', err.message);
      process.exit(1);
    });
};

startServer();
