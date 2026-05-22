require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DB,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASS,
  options: { encrypt: false, trustServerCertificate: true },
};

const tables = [
  // Fleet & Delivery
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Fleet')
   CREATE TABLE dbo.Fleet (
     FleetID NVARCHAR(50) PRIMARY KEY,
     LicensePlate NVARCHAR(20),
     VehicleType NVARCHAR(20),
     WeightCapacityKg FLOAT,
     LengthCapacityM FLOAT,
     WidthCapacityM FLOAT,
     HeightCapacityM FLOAT,
     HomeZone NVARCHAR(100),
     HomeLat FLOAT,
     HomeLng FLOAT,
     Status NVARCHAR(20),
     Remark NVARCHAR(500),
     InsuranceCompany NVARCHAR(100),
     InsuranceExpiry NVARCHAR(20),
     PrbaCompany NVARCHAR(100),
     PrbaExpiry NVARCHAR(20),
     TaxRenewalDate NVARCHAR(20),
     HasHiab BIT DEFAULT 0,
     CreatedAt NVARCHAR(30),
     UpdatedAt NVARCHAR(30)
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='FleetMaintenance')
   CREATE TABLE dbo.FleetMaintenance (
     RecordID NVARCHAR(50) PRIMARY KEY,
     FleetID NVARCHAR(50),
     LicensePlate NVARCHAR(20),
     Type NVARCHAR(20),
     Symptom NVARCHAR(500),
     StartDate NVARCHAR(20),
     ExpectedEndDate NVARCHAR(20),
     ActualEndDate NVARCHAR(20),
     DaysParked FLOAT,
     Remark NVARCHAR(500),
     CreatedAt NVARCHAR(30)
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='DeliveryOrders')
   CREATE TABLE dbo.DeliveryOrders (
     OrderID NVARCHAR(50) PRIMARY KEY,
     OrderDate NVARCHAR(20),
     Arcode NVARCHAR(20),
     Arname NVARCHAR(200),
     DeliveryZone NVARCHAR(100),
     ProductType NVARCHAR(100),
     WeightKg FLOAT,
     LengthM FLOAT,
     WidthM FLOAT,
     HeightM FLOAT,
     QuantityPieces FLOAT,
     DeadlineDate NVARCHAR(20),
     PlanDate NVARCHAR(20),
     Priority INT DEFAULT 2,
     Status NVARCHAR(20),
     AssignedPlanID NVARCHAR(50),
     Remark NVARCHAR(500),
     Lat FLOAT,
     Lng FLOAT,
     ItemsDetail NVARCHAR(MAX),
     RequiresHiab BIT DEFAULT 0,
     IsLongDistance BIT DEFAULT 0
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='DeliveryPlans')
   CREATE TABLE dbo.DeliveryPlans (
     PlanID NVARCHAR(50) PRIMARY KEY,
     PlanDate NVARCHAR(20),
     Status NVARCHAR(20),
     FleetID NVARCHAR(50),
     LicensePlate NVARCHAR(20),
     VehicleType NVARCHAR(20),
     TotalWeightKg FLOAT,
     TotalOrders INT,
     OrdersJson NVARCHAR(MAX),
     RouteJson NVARCHAR(MAX),
     Remark NVARCHAR(500),
     CreatedBy NVARCHAR(50),
     CreatedAt NVARCHAR(30),
     UpdatedAt NVARCHAR(30)
   )`,

  // Employees & Trips
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Employees')
   CREATE TABLE dbo.Employees (
     EmpID NVARCHAR(50) PRIMARY KEY,
     EmpName NVARCHAR(100),
     NickName NVARCHAR(50),
     Position NVARCHAR(50),
     Phone NVARCHAR(20),
     Status NVARCHAR(20),
     CreatedAt NVARCHAR(30),
     UpdatedAt NVARCHAR(30)
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='TripRates')
   CREATE TABLE dbo.TripRates (
     VehicleType NVARCHAR(20) PRIMARY KEY,
     DriverRate FLOAT,
     AssistantRate FLOAT,
     UpdatedAt NVARCHAR(30)
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='TripLogs')
   CREATE TABLE dbo.TripLogs (
     LogID NVARCHAR(50) PRIMARY KEY,
     PlanID NVARCHAR(50),
     PlanDate NVARCHAR(20),
     FleetID NVARCHAR(50),
     LicensePlate NVARCHAR(20),
     VehicleType NVARCHAR(20),
     DriverEmpID NVARCHAR(50),
     DriverEmpName NVARCHAR(100),
     AssistantEmpID NVARCHAR(50),
     AssistantEmpName NVARCHAR(100),
     DriverFee FLOAT,
     AssistantFee FLOAT,
     TotalFee FLOAT,
     Status NVARCHAR(20),
     Remark NVARCHAR(500),
     CreatedBy NVARCHAR(50),
     CreatedAt NVARCHAR(30)
   )`,

  // Items & Customers
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Items')
   CREATE TABLE dbo.Items (
     ItemCode NVARCHAR(50) PRIMARY KEY,
     ItemName NVARCHAR(200),
     WeightKgPerUnit FLOAT,
     LengthM FLOAT,
     WidthM FLOAT,
     HeightM FLOAT,
     ProductType NVARCHAR(100),
     Remark NVARCHAR(500),
     WeightPerPiece FLOAT,
     PiecesPerBundle FLOAT
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Customers')
   CREATE TABLE dbo.Customers (
     Arcode NVARCHAR(20) PRIMARY KEY,
     Arname NVARCHAR(200),
     Remark NVARCHAR(500),
     CreatedAt NVARCHAR(30),
     UpdatedAt NVARCHAR(30)
   )`,

  // Warehouse
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Locations')
   CREATE TABLE dbo.Locations (
     LocationID NVARCHAR(50) PRIMARY KEY,
     Zone NVARCHAR(20),
     Rack NVARCHAR(20),
     Shelf NVARCHAR(20),
     Description NVARCHAR(200),
     MaxWeightKg FLOAT,
     Status NVARCHAR(20),
     CreatedAt NVARCHAR(30),
     UpdatedAt NVARCHAR(30)
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='TypeSKU')
   CREATE TABLE dbo.TypeSKU (
     SkuCode NVARCHAR(50) PRIMARY KEY,
     SkuName NVARCHAR(200),
     Category NVARCHAR(100),
     Unit NVARCHAR(20),
     Remark NVARCHAR(500),
     CreatedAt NVARCHAR(30),
     UpdatedAt NVARCHAR(30)
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Inventory')
   CREATE TABLE dbo.Inventory (
     RecordID NVARCHAR(50) PRIMARY KEY,
     LocationID NVARCHAR(50),
     SkuCode NVARCHAR(50),
     SkuName NVARCHAR(200),
     Quantity FLOAT,
     UpdatedAt NVARCHAR(30),
     UpdatedBy NVARCHAR(50)
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='AuditLog')
   CREATE TABLE dbo.AuditLog (
     AuditID NVARCHAR(50) PRIMARY KEY,
     LocationID NVARCHAR(50),
     SkuCode NVARCHAR(50),
     BeforeQty FLOAT,
     AfterQty FLOAT,
     Reason NVARCHAR(200),
     AuditDate NVARCHAR(30),
     AuditBy NVARCHAR(50)
   )`,

  // Transfer
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='TransferTasks')
   CREATE TABLE dbo.TransferTasks (
     TaskID NVARCHAR(50) PRIMARY KEY,
     FromLocationID NVARCHAR(50),
     ToLocationID NVARCHAR(50),
     SkuCode NVARCHAR(50),
     SkuName NVARCHAR(200),
     Quantity FLOAT,
     ActualQuantity FLOAT,
     Unit NVARCHAR(20),
     Status NVARCHAR(20),
     Priority INT,
     AssignedVehicle NVARCHAR(50),
     RequestedBy NVARCHAR(50),
     RequestedAt NVARCHAR(30),
     StartedAt NVARCHAR(30),
     CompletedAt NVARCHAR(30),
     Remark NVARCHAR(500)
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='TransferVehicles')
   CREATE TABLE dbo.TransferVehicles (
     VehicleID NVARCHAR(50) PRIMARY KEY,
     LicensePlate NVARCHAR(20),
     VehicleType NVARCHAR(50),
     DriverName NVARCHAR(100),
     Phone NVARCHAR(20),
     Status NVARCHAR(20),
     Remark NVARCHAR(200)
   )`,
];

async function main() {
  const pool = await sql.connect(config);
  let ok = 0, fail = 0;
  for (const ddl of tables) {
    try {
      await pool.request().query(ddl);
      const match = ddl.match(/name='(\w+)'/);
      console.log(`✓ ${match?.[1] || 'table'}`);
      ok++;
    } catch (e) {
      console.error(`✗ ${e.message}`);
      fail++;
    }
  }
  console.log(`\nเสร็จสิ้น: ${ok} สำเร็จ, ${fail} ล้มเหลว`);
  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
