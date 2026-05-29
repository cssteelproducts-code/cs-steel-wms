require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { sql, connectDB, getPool } = require('../config/db');
const bcrypt = require('bcryptjs');

const initDatabase = async () => {
  await connectDB();
  const pool = getPool();

  console.log('🔧 Initializing database tables...');

  const queries = `
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_Warehouses' AND xtype='U')
    CREATE TABLE WMS_Warehouses (
      WarehouseID INT IDENTITY(1,1) PRIMARY KEY,
      WarehouseCode NVARCHAR(20) NOT NULL,
      WarehouseName NVARCHAR(100) NOT NULL,
      Location NVARCHAR(200),
      GpsLat FLOAT,
      GpsLng FLOAT,
      IsActive BIT DEFAULT 1,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_Customers' AND xtype='U')
    CREATE TABLE WMS_Customers (
      CustomerID INT IDENTITY(1,1) PRIMARY KEY,
      CustomerCode NVARCHAR(20) NOT NULL,
      CustomerName NVARCHAR(200) NOT NULL,
      Phone NVARCHAR(20),
      Address NVARCHAR(500),
      IsActive BIT DEFAULT 1,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_VehicleTypes' AND xtype='U')
    CREATE TABLE WMS_VehicleTypes (
      TypeID INT IDENTITY(1,1) PRIMARY KEY,
      TypeName NVARCHAR(50) NOT NULL,
      Description NVARCHAR(200),
      IsActive BIT DEFAULT 1
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_LoadingStations' AND xtype='U')
    CREATE TABLE WMS_LoadingStations (
      StationID INT IDENTITY(1,1) PRIMARY KEY,
      StationCode NVARCHAR(20) NOT NULL,
      StationName NVARCHAR(100) NOT NULL,
      WarehouseID INT,
      IsActive BIT DEFAULT 1,
      SortOrder INT DEFAULT 0,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_Roles' AND xtype='U')
    CREATE TABLE WMS_Roles (
      RoleID INT IDENTITY(1,1) PRIMARY KEY,
      RoleName NVARCHAR(50) NOT NULL,
      Description NVARCHAR(200),
      SortOrder INT DEFAULT 0,
      IsActive BIT DEFAULT 1
    );
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id=OBJECT_ID('WMS_Roles') AND name='SortOrder')
      ALTER TABLE WMS_Roles ADD SortOrder INT DEFAULT 0;

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_Users' AND xtype='U')
    CREATE TABLE WMS_Users (
      UserID INT IDENTITY(1,1) PRIMARY KEY,
      Username NVARCHAR(50) NOT NULL,
      Password NVARCHAR(200) NOT NULL,
      FullName NVARCHAR(100) NOT NULL,
      Email NVARCHAR(100),
      RoleID INT,
      WarehouseID INT,
      IsActive BIT DEFAULT 1,
      CreatedAt DATETIME DEFAULT GETDATE(),
      LastLogin DATETIME
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_MenuPermissions' AND xtype='U')
    CREATE TABLE WMS_MenuPermissions (
      PermissionID INT IDENTITY(1,1) PRIMARY KEY,
      RoleID INT NOT NULL,
      MenuCode NVARCHAR(50) NOT NULL,
      MenuName NVARCHAR(100),
      CanView BIT DEFAULT 0,
      CanCreate BIT DEFAULT 0,
      CanEdit BIT DEFAULT 0,
      CanDelete BIT DEFAULT 0
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_Trips' AND xtype='U')
    CREATE TABLE WMS_Trips (
      TripID INT IDENTITY(1,1) PRIMARY KEY,
      TripDate DATE NOT NULL,
      LicensePlate NVARCHAR(20) NOT NULL,
      VehicleTypeID INT,
      WarehouseID INT,
      CustomerID INT,
      Status NVARCHAR(20) DEFAULT 'WeighIn',
      CompletedAt DATETIME,
      CreatedAt DATETIME DEFAULT GETDATE(),
      CreatedBy INT
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_WeighIn' AND xtype='U')
    CREATE TABLE WMS_WeighIn (
      WeighInID INT IDENTITY(1,1) PRIMARY KEY,
      TripID INT NOT NULL,
      WeighDateTime DATETIME NOT NULL,
      TareWeight DECIMAL(10,2),
      Notes NVARCHAR(500),
      OperatorID INT,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_DataStation' AND xtype='U')
    CREATE TABLE WMS_DataStation (
      DataStationID INT IDENTITY(1,1) PRIMARY KEY,
      TripID INT NOT NULL,
      TargetStationID INT,
      PickDocumentNo NVARCHAR(100),
      ReceivedTime DATETIME DEFAULT GETDATE(),
      Notes NVARCHAR(500),
      OperatorID INT
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_LoadingRecord' AND xtype='U')
    CREATE TABLE WMS_LoadingRecord (
      RecordID INT IDENTITY(1,1) PRIMARY KEY,
      TripID INT NOT NULL,
      StationID INT NOT NULL,
      EntryTime DATETIME NOT NULL,
      ExitTime DATETIME,
      DurationMinutes INT,
      Notes NVARCHAR(500),
      OperatorID INT
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_CheckerRecord' AND xtype='U')
    CREATE TABLE WMS_CheckerRecord (
      CheckerID INT IDENTITY(1,1) PRIMARY KEY,
      TripID INT NOT NULL,
      CheckTime DATETIME DEFAULT GETDATE(),
      IsApproved BIT DEFAULT 0,
      Remarks NVARCHAR(500),
      OperatorID INT
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_WeighOut' AND xtype='U')
    CREATE TABLE WMS_WeighOut (
      WeighOutID INT IDENTITY(1,1) PRIMARY KEY,
      TripID INT NOT NULL,
      WeighDateTime DATETIME NOT NULL,
      GrossWeight DECIMAL(10,2),
      TareWeight DECIMAL(10,2),
      NetWeight DECIMAL(10,2),
      Notes NVARCHAR(500),
      OperatorID INT,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_AlertConfig' AND xtype='U')
    CREATE TABLE WMS_AlertConfig (
      ConfigID INT IDENTITY(1,1) PRIMARY KEY,
      AlertType NVARCHAR(50) NOT NULL,
      WarehouseID INT NULL,
      ThresholdValue DECIMAL(10,2) NOT NULL,
      IsActive BIT DEFAULT 1,
      UpdatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_Alerts' AND xtype='U')
    CREATE TABLE WMS_Alerts (
      AlertID INT IDENTITY(1,1) PRIMARY KEY,
      AlertType NVARCHAR(50) NOT NULL,
      Severity NVARCHAR(20) DEFAULT 'WARNING',
      TripID INT NULL,
      WarehouseID INT NULL,
      Message NVARCHAR(500) NOT NULL,
      IsRead BIT DEFAULT 0,
      IsResolved BIT DEFAULT 0,
      CreatedAt DATETIME DEFAULT GETDATE(),
      ResolvedAt DATETIME NULL
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_Products' AND xtype='U')
    CREATE TABLE WMS_Products (
      ProductID INT IDENTITY(1,1) PRIMARY KEY,
      ProductCode NVARCHAR(50) NOT NULL,
      ProductName NVARCHAR(200) NOT NULL,
      Unit NVARCHAR(50) DEFAULT N'ตัน',
      Category NVARCHAR(100),
      Description NVARCHAR(500),
      IsActive BIT DEFAULT 1,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_Stock' AND xtype='U')
    CREATE TABLE WMS_Stock (
      StockID INT IDENTITY(1,1) PRIMARY KEY,
      WarehouseID INT NOT NULL,
      ProductID INT NOT NULL,
      Quantity DECIMAL(12,3) DEFAULT 0,
      LastUpdated DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_StockTransactions' AND xtype='U')
    CREATE TABLE WMS_StockTransactions (
      TxID INT IDENTITY(1,1) PRIMARY KEY,
      WarehouseID INT NOT NULL,
      ProductID INT NOT NULL,
      TxType NVARCHAR(20) NOT NULL,
      Quantity DECIMAL(12,3) NOT NULL,
      RefDocNo NVARCHAR(100),
      TripID INT NULL,
      Remark NVARCHAR(500),
      OperatorID INT,
      TxDate DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_StockCount' AND xtype='U')
    CREATE TABLE WMS_StockCount (
      CountID INT IDENTITY(1,1) PRIMARY KEY,
      CountCode NVARCHAR(50) NOT NULL,
      WarehouseID INT NOT NULL,
      CountDate DATE NOT NULL,
      Status NVARCHAR(20) DEFAULT 'DRAFT',
      Remark NVARCHAR(500),
      OperatorID INT,
      ConfirmedBy INT NULL,
      ConfirmedAt DATETIME NULL,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_StockCountItems' AND xtype='U')
    CREATE TABLE WMS_StockCountItems (
      ItemID INT IDENTITY(1,1) PRIMARY KEY,
      CountID INT NOT NULL,
      ProductID INT NOT NULL,
      SystemQty DECIMAL(12,3) DEFAULT 0,
      ActualQty DECIMAL(12,3) NULL,
      Remark NVARCHAR(200)
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_DeliveryOrders' AND xtype='U')
    CREATE TABLE WMS_DeliveryOrders (
      OrderID INT IDENTITY(1,1) PRIMARY KEY,
      OrderCode NVARCHAR(50) NOT NULL,
      CustomerID INT NULL,
      WarehouseID INT NOT NULL,
      ProductID INT NULL,
      Quantity DECIMAL(12,3) DEFAULT 0,
      Unit NVARCHAR(50) DEFAULT N'ตัน',
      DeliveryAddress NVARCHAR(500),
      DeliveryLat FLOAT,
      DeliveryLng FLOAT,
      RequestedDate DATE NOT NULL,
      TimeWindowStart NVARCHAR(10),
      TimeWindowEnd NVARCHAR(10),
      Status NVARCHAR(20) DEFAULT 'PENDING',
      Notes NVARCHAR(500),
      CreatedBy INT,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_DeliveryPlans' AND xtype='U')
    CREATE TABLE WMS_DeliveryPlans (
      PlanID INT IDENTITY(1,1) PRIMARY KEY,
      PlanCode NVARCHAR(50) NOT NULL,
      WarehouseID INT NOT NULL,
      PlanDate DATE NOT NULL,
      Status NVARCHAR(20) DEFAULT 'DRAFT',
      Notes NVARCHAR(500),
      CreatedBy INT,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_DeliveryRoutes' AND xtype='U')
    CREATE TABLE WMS_DeliveryRoutes (
      RouteID INT IDENTITY(1,1) PRIMARY KEY,
      PlanID INT NOT NULL,
      LicensePlate NVARCHAR(20),
      DriverName NVARCHAR(100),
      CapacityTon DECIMAL(10,2),
      TotalDistKm DECIMAL(10,2),
      TotalQty DECIMAL(12,3),
      Status NVARCHAR(20) DEFAULT 'PENDING'
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_DeliveryRouteStops' AND xtype='U')
    CREATE TABLE WMS_DeliveryRouteStops (
      StopID INT IDENTITY(1,1) PRIMARY KEY,
      RouteID INT NOT NULL,
      OrderID INT NOT NULL,
      StopSequence INT NOT NULL,
      DistFromPrevKm DECIMAL(10,2),
      EstimatedArrival NVARCHAR(10),
      ActualArrival DATETIME,
      Status NVARCHAR(20) DEFAULT 'PENDING'
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_TransferVehicles' AND xtype='U')
    CREATE TABLE WMS_TransferVehicles (
      VehicleID INT IDENTITY(1,1) PRIMARY KEY,
      VehiclePlate NVARCHAR(20) NOT NULL,
      VehicleName NVARCHAR(100),
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_TransferStations' AND xtype='U')
    CREATE TABLE WMS_TransferStations (
      StationID INT IDENTITY(1,1) PRIMARY KEY,
      StationCode NVARCHAR(20) NOT NULL,
      StationName NVARCHAR(100) NOT NULL,
      StationType NVARCHAR(20) DEFAULT 'BOTH',
      SortOrder INT DEFAULT 0,
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME DEFAULT GETDATE()
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_TransferJobs' AND xtype='U')
    CREATE TABLE WMS_TransferJobs (
      JobID INT IDENTITY(1,1) PRIMARY KEY,
      JobCode NVARCHAR(30) NOT NULL,
      SourceStationID INT,
      DestStationID INT,
      ProductDesc NVARCHAR(200) NOT NULL,
      PlannedBundles INT,
      PlannedWeightKg DECIMAL(12,3),
      ActualBundles INT DEFAULT 0,
      ActualWeightKg DECIMAL(12,3) DEFAULT 0,
      Priority NVARCHAR(20) DEFAULT 'NORMAL',
      Status NVARCHAR(20) DEFAULT 'PENDING',
      Notes NVARCHAR(500),
      CreatedBy INT,
      CreatedAt DATETIME DEFAULT GETDATE(),
      CompletedAt DATETIME
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WMS_TransferTrips' AND xtype='U')
    CREATE TABLE WMS_TransferTrips (
      TripID INT IDENTITY(1,1) PRIMARY KEY,
      JobID INT NOT NULL,
      TripNo INT NOT NULL DEFAULT 1,
      OperatorID INT,
      VehicleID INT,
      Status NVARCHAR(20) DEFAULT 'PENDING',
      SourceEntryTime DATETIME,
      SourceExitTime DATETIME,
      DestEntryTime DATETIME,
      DestExitTime DATETIME,
      BundleCount INT,
      TotalWeightKg DECIMAL(12,3),
      Notes NVARCHAR(500),
      CreatedAt DATETIME DEFAULT GETDATE()
    );
  `;

  // Execute table creation queries one by one
  const tableStatements = queries.split(/(?=IF NOT EXISTS)/g).filter(s => s.trim());
  for (const stmt of tableStatements) {
    if (stmt.trim()) {
      await pool.request().query(stmt);
    }
  }

  console.log('✅ Tables created/verified');

  // Seed Roles
  const roles = [
    { name: 'Admin', desc: 'ผู้ดูแลระบบ - สิทธิ์เต็ม' },
    { name: 'Manager', desc: 'ผู้จัดการ - ดูรายงาน' },
    { name: 'WeighIn', desc: 'พนักงานสถานีชั่งเข้า' },
    { name: 'DataStation', desc: 'พนักงานสถานี Data' },
    { name: 'LoadingStation', desc: 'พนักงานสถานีขึ้นสินค้า' },
    { name: 'Checker', desc: 'พนักงานตรวจสอบ' },
    { name: 'WeighOut', desc: 'พนักงานสถานีชั่งออก' }
  ];

  for (const role of roles) {
    const exists = await pool.request()
      .input('RoleName', sql.NVarChar, role.name)
      .query('SELECT RoleID FROM WMS_Roles WHERE RoleName = @RoleName');
    if (exists.recordset.length === 0) {
      await pool.request()
        .input('RoleName', sql.NVarChar, role.name)
        .input('Description', sql.NVarChar, role.desc)
        .query('INSERT INTO WMS_Roles (RoleName, Description) VALUES (@RoleName, @Description)');
    }
  }

  // Seed Vehicle Types
  const vehicleTypes = ['รถ 4 ล้อ', 'รถ 6 ล้อ', 'รถ 10 ล้อ', 'รถ 10 ล้อพ่วง', 'รถเทรลเลอร์', 'รถ 18 ล้อ'];
  for (const vt of vehicleTypes) {
    const exists = await pool.request()
      .input('TypeName', sql.NVarChar, vt)
      .query('SELECT TypeID FROM WMS_VehicleTypes WHERE TypeName = @TypeName');
    if (exists.recordset.length === 0) {
      await pool.request()
        .input('TypeName', sql.NVarChar, vt)
        .query('INSERT INTO WMS_VehicleTypes (TypeName) VALUES (@TypeName)');
    }
  }

  // Seed default admin user
  const adminExists = await pool.request()
    .input('Username', sql.NVarChar, 'admin')
    .query('SELECT UserID FROM WMS_Users WHERE Username = @Username');

  if (adminExists.recordset.length === 0) {
    const hashedPassword = await bcrypt.hash('Admin@1234', 10);
    const adminRole = await pool.request()
      .input('RoleName', sql.NVarChar, 'Admin')
      .query('SELECT RoleID FROM WMS_Roles WHERE RoleName = @RoleName');

    if (adminRole.recordset.length > 0) {
      await pool.request()
        .input('Username', sql.NVarChar, 'admin')
        .input('Password', sql.NVarChar, hashedPassword)
        .input('FullName', sql.NVarChar, 'System Administrator')
        .input('RoleID', sql.Int, adminRole.recordset[0].RoleID)
        .query(`
          INSERT INTO WMS_Users (Username, Password, FullName, RoleID, IsActive)
          VALUES (@Username, @Password, @FullName, @RoleID, 1)
        `);
      console.log('✅ Default admin user created (admin / Admin@1234)');
    }
  }

  // Seed Admin permissions (all menus)
  const menus = [
    { code: 'DASHBOARD', name: 'Dashboard' },
    { code: 'WEIGH_IN', name: 'สถานีชั่งเข้า' },
    { code: 'DATA_STATION', name: 'สถานี Data' },
    { code: 'LOADING_STATION', name: 'สถานีขึ้นสินค้า' },
    { code: 'CHECKER', name: 'สถานีเช็คเกอร์' },
    { code: 'WEIGH_OUT', name: 'สถานีชั่งออก' },
    { code: 'ETA', name: 'ETA / GPS ติดตามรถ' },
    { code: 'TRIP_MONITOR', name: 'Monitor รถในคลัง' },
    { code: 'USERS', name: 'จัดการผู้ใช้' },
    { code: 'MASTER', name: 'ข้อมูลหลัก' },
    { code: 'REPORTS', name: 'รายงาน' },
    { code: 'ALERTS', name: 'การแจ้งเตือน' },
    { code: 'STOCK', name: 'สต็อกสินค้า' },
    { code: 'DELIVERY_PLAN', name: 'แผนจัดส่ง' },
    { code: 'TRANSFER', name: 'ย้ายสินค้าภายใน' }
  ];

  const adminRoleRow = await pool.request()
    .input('RoleName', sql.NVarChar, 'Admin')
    .query('SELECT RoleID FROM WMS_Roles WHERE RoleName = @RoleName');

  if (adminRoleRow.recordset.length > 0) {
    const adminRoleId = adminRoleRow.recordset[0].RoleID;
    for (const menu of menus) {
      const permExists = await pool.request()
        .input('RoleID', sql.Int, adminRoleId)
        .input('MenuCode', sql.NVarChar, menu.code)
        .query('SELECT PermissionID FROM WMS_MenuPermissions WHERE RoleID = @RoleID AND MenuCode = @MenuCode');
      if (permExists.recordset.length === 0) {
        await pool.request()
          .input('RoleID', sql.Int, adminRoleId)
          .input('MenuCode', sql.NVarChar, menu.code)
          .input('MenuName', sql.NVarChar, menu.name)
          .query(`
            INSERT INTO WMS_MenuPermissions (RoleID, MenuCode, MenuName, CanView, CanCreate, CanEdit, CanDelete)
            VALUES (@RoleID, @MenuCode, @MenuName, 1, 1, 1, 1)
          `);
      }
    }
  }

  // Seed default alert configs
  const alertDefaults = [
    { type: 'OVERSTAY', threshold: 240 },   // 4 hours
    { type: 'OVERWEIGHT', threshold: 30000 } // 30,000 kg
  ];
  for (const ac of alertDefaults) {
    const acExists = await pool.request()
      .input('AlertType', sql.NVarChar, ac.type)
      .query('SELECT ConfigID FROM WMS_AlertConfig WHERE AlertType = @AlertType AND WarehouseID IS NULL');
    if (acExists.recordset.length === 0) {
      await pool.request()
        .input('AlertType', sql.NVarChar, ac.type)
        .input('Threshold', sql.Decimal(10, 2), ac.threshold)
        .query('INSERT INTO WMS_AlertConfig (AlertType, ThresholdValue) VALUES (@AlertType, @Threshold)');
    }
  }

  console.log('✅ Database initialization complete!');
  process.exit(0);
};

initDatabase().catch(err => {
  console.error('❌ Init failed:', err);
  process.exit(1);
});
