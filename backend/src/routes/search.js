const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/search?q=... — global search across trips, customers, vehicles
router.get('/', authenticate, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, trips: [], customers: [] });

    const pool = getPool();
    const like = `%${q}%`;

    const [tripRes, custRes] = await Promise.all([
      pool.request()
        .input('q', sql.NVarChar, like)
        .query(`
          SELECT TOP 8
            t.TripID, t.LicensePlate, t.Status, t.TripDate,
            vt.TypeName as VehicleType,
            c.CustomerName,
            w.WarehouseName
          FROM WMS_Trips t
          LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
          LEFT JOIN WMS_Customers c ON t.CustomerID = c.CustomerID
          LEFT JOIN WMS_Warehouses w ON t.WarehouseID = w.WarehouseID
          WHERE t.LicensePlate LIKE @q
             OR c.CustomerName LIKE @q
          ORDER BY t.TripDate DESC, t.TripID DESC
        `),
      pool.request()
        .input('q', sql.NVarChar, like)
        .query(`
          SELECT TOP 5 CustomerID, CustomerName, CustomerCode
          FROM WMS_Customers
          WHERE (CustomerName LIKE @q OR CustomerCode LIKE @q) AND IsActive = 1
          ORDER BY CustomerName
        `)
    ]);

    res.json({
      success: true,
      trips: tripRes.recordset,
      customers: custRes.recordset
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
