-- รัน script นี้ใน SSMS ก่อน start server ครั้งแรก
-- สร้าง AppConfig table สำหรับเก็บ ROLE_ACCESS, STD_MINUTES, LOGO_URL, MENU_MAINTENANCE

IF OBJECT_ID(N'dbo.AppConfig', N'U') IS NULL
CREATE TABLE dbo.AppConfig (
  [Key]       NVARCHAR(100) NOT NULL PRIMARY KEY,
  [Value]     NVARCHAR(MAX) NULL,
  [UpdatedAt] NVARCHAR(30)  NULL
);
GO

-- สร้าง VehicleETA table (แทน Tracking sheet)
IF OBJECT_ID(N'dbo.VehicleETA', N'U') IS NULL
CREATE TABLE dbo.VehicleETA (
  [ID]          NVARCHAR(60)   NOT NULL PRIMARY KEY,
  [LicensePlate] NVARCHAR(20)  NULL,
  [Transport]   NVARCHAR(100)  NULL,
  [Lat]         FLOAT          NULL,
  [Lng]         FLOAT          NULL,
  [UpdatedAt]   NVARCHAR(30)   NULL,
  [UpdatedBy]   NVARCHAR(100)  NULL,
  [Notes]       NVARCHAR(MAX)  NULL,
  [WarehouseId] NVARCHAR(60)   NULL
);
GO

-- (Optional) สร้าง WarehouseList table
IF OBJECT_ID(N'dbo.WarehouseList', N'U') IS NULL
CREATE TABLE dbo.WarehouseList (
  [ID]        NVARCHAR(60)   NOT NULL PRIMARY KEY,
  [Name]      NVARCHAR(200)  NULL,
  [Lat]       FLOAT          NULL,
  [Lng]       FLOAT          NULL,
  [SortOrder] INT            NULL DEFAULT 0
);
GO
