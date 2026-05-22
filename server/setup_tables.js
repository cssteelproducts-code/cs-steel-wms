require('dotenv').config();
const sql = require('mssql');

const cfg = {
  server:   process.env.MSSQL_SERVER,
  port:     parseInt(process.env.MSSQL_PORT || '1433'),
  database: process.env.MSSQL_DB,
  user:     process.env.MSSQL_USER,
  password: process.env.MSSQL_PASS,
  options:  { encrypt: false, trustServerCertificate: true },
};

const stmts = [
  {
    name: 'AppConfig',
    sql: `IF OBJECT_ID(N'dbo.AppConfig','U') IS NULL
          CREATE TABLE dbo.AppConfig (
            [Key]       NVARCHAR(100) NOT NULL PRIMARY KEY,
            [Value]     NVARCHAR(MAX) NULL,
            [UpdatedAt] NVARCHAR(30)  NULL
          )`,
  },
  {
    name: 'VehicleETA',
    sql: `IF OBJECT_ID(N'dbo.VehicleETA','U') IS NULL
          CREATE TABLE dbo.VehicleETA (
            [ID]           NVARCHAR(60)  NOT NULL PRIMARY KEY,
            [LicensePlate] NVARCHAR(20)  NULL,
            [Transport]    NVARCHAR(100) NULL,
            [Lat]          FLOAT         NULL,
            [Lng]          FLOAT         NULL,
            [UpdatedAt]    NVARCHAR(30)  NULL,
            [UpdatedBy]    NVARCHAR(100) NULL,
            [Notes]        NVARCHAR(MAX) NULL,
            [WarehouseId]  NVARCHAR(60)  NULL
          )`,
  },
  {
    name: 'WarehouseList',
    sql: `IF OBJECT_ID(N'dbo.WarehouseList','U') IS NULL
          CREATE TABLE dbo.WarehouseList (
            [ID]        NVARCHAR(60)  NOT NULL PRIMARY KEY,
            [Name]      NVARCHAR(200) NULL,
            [Lat]       FLOAT         NULL,
            [Lng]       FLOAT         NULL,
            [SortOrder] INT           NULL DEFAULT 0
          )`,
  },
];

(async () => {
  const pool = await sql.connect(cfg);
  for (const s of stmts) {
    await pool.request().query(s.sql);
    console.log('✓ ' + s.name);
  }
  console.log('เสร็จสิ้น');
  process.exit(0);
})().catch(e => { console.log('✗ ' + e.message); process.exit(1); });
