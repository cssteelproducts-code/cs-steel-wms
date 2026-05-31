const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const cache = require('../utils/cache');

// --- VEHICLES ---

router.get('/vehicles', async (req, res) => {
  try {
    const data = await cache.wrap('tr:vehicles', async () => {
      const result = await getPool().request().query(
        'SELECT * FROM WMS_TransferVehicles WITH (NOLOCK) WHERE IsActive=1 ORDER BY VehiclePlate'
      );
      return result.recordset;
    }, 30_000);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/vehicles', async (req, res) => {
  try {
    const { vehicleCode, vehiclePlate, vehicleName, vehicleType, vehicleStatus, statusNote, repairStartDate, repairExpectedDate } = req.body;
    if (!vehiclePlate) return res.status(400).json({ success: false, message: 'กรุณากรอกทะเบียนรถ' });
    const pool = getPool();
    const result = await pool.request()
      .input('code',   sql.NVarChar, vehicleCode || null)
      .input('plate',  sql.NVarChar, vehiclePlate.trim())
      .input('name',   sql.NVarChar, vehicleName || null)
      .input('type',   sql.NVarChar, vehicleType || null)
      .input('status', sql.NVarChar, vehicleStatus || 'READY')
      .input('note',   sql.NVarChar, statusNote || null)
      .input('rstart', sql.Date, repairStartDate || null)
      .input('rend',   sql.Date, repairExpectedDate || null)
      .query(`
        INSERT INTO WMS_TransferVehicles (VehicleCode, VehiclePlate, VehicleName, VehicleType, VehicleStatus, StatusNote, RepairStartDate, RepairExpectedDate)
        OUTPUT INSERTED.VehicleID
        VALUES (@code, @plate, @name, @type, @status, @note, @rstart, @rend)
      `);
    res.json({ success: true, vehicleId: result.recordset[0].VehicleID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/vehicles/:id', async (req, res) => {
  try {
    const { vehicleCode, vehiclePlate, vehicleName, vehicleType, vehicleStatus, statusNote, repairStartDate, repairExpectedDate, isActive } = req.body;
    const pool = getPool();
    await pool.request()
      .input('id',     sql.Int,      req.params.id)
      .input('code',   sql.NVarChar, vehicleCode || null)
      .input('plate',  sql.NVarChar, vehiclePlate)
      .input('name',   sql.NVarChar, vehicleName || null)
      .input('type',   sql.NVarChar, vehicleType || null)
      .input('status', sql.NVarChar, vehicleStatus || 'READY')
      .input('note',   sql.NVarChar, statusNote || null)
      .input('rstart', sql.Date,     repairStartDate || null)
      .input('rend',   sql.Date,     repairExpectedDate || null)
      .input('active', sql.Bit,      isActive !== false ? 1 : 0)
      .query(`UPDATE WMS_TransferVehicles
        SET VehicleCode=@code, VehiclePlate=@plate, VehicleName=@name, VehicleType=@type,
            VehicleStatus=@status, StatusNote=@note, RepairStartDate=@rstart, RepairExpectedDate=@rend, IsActive=@active
        WHERE VehicleID=@id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/vehicles/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE WMS_TransferVehicles SET IsActive=0 WHERE VehicleID=@id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- STATIONS ---

router.get('/stations', async (req, res) => {
  try {
    const data = await cache.wrap('tr:stations', async () => {
      const result = await getPool().request().query(
        'SELECT * FROM WMS_TransferStations WITH (NOLOCK) WHERE IsActive=1 ORDER BY SortOrder, StationName'
      );
      return result.recordset;
    }, 30_000);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/stations', async (req, res) => {
  try {
    const { stationCode, stationName, stationType, sortOrder } = req.body;
    const pool = getPool();
    const result = await pool.request()
      .input('code', sql.NVarChar, stationCode)
      .input('name', sql.NVarChar, stationName)
      .input('type', sql.NVarChar, stationType || 'BOTH')
      .input('sort', sql.Int, sortOrder || 0)
      .query(`
        INSERT INTO WMS_TransferStations (StationCode, StationName, StationType, SortOrder)
        OUTPUT INSERTED.StationID
        VALUES (@code, @name, @type, @sort)
      `);
    res.json({ success: true, stationId: result.recordset[0].StationID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/stations/:id', async (req, res) => {
  try {
    const { stationCode, stationName, stationType, sortOrder, isActive } = req.body;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('code', sql.NVarChar, stationCode)
      .input('name', sql.NVarChar, stationName)
      .input('type', sql.NVarChar, stationType || 'BOTH')
      .input('sort', sql.Int, sortOrder || 0)
      .input('active', sql.Bit, isActive !== false ? 1 : 0)
      .query('UPDATE WMS_TransferStations SET StationCode=@code, StationName=@name, StationType=@type, SortOrder=@sort, IsActive=@active WHERE StationID=@id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/stations/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE WMS_TransferStations SET IsActive=0 WHERE StationID=@id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- JOBS ---

router.get('/jobs/available', async (req, res) => {
  try {
    const data = await cache.wrap('tr:jobs:avail', async () => {
      const result = await getPool().request().query(`
        SELECT j.JobID, j.JobCode, j.ProductDesc, j.Priority,
          ss.StationName AS SourceStationName, ds.StationName AS DestStationName,
          j.PlannedBundles, j.PlannedWeightKg, j.ActualBundles, j.ActualWeightKg,
          ISNULL(tc.ActiveTripCount, 0) AS ActiveTripCount
        FROM WMS_TransferJobs j WITH (NOLOCK)
        LEFT JOIN WMS_TransferStations ss WITH (NOLOCK) ON j.SourceStationID=ss.StationID
        LEFT JOIN WMS_TransferStations ds WITH (NOLOCK) ON j.DestStationID=ds.StationID
        LEFT JOIN (
          SELECT JobID, COUNT(*) AS ActiveTripCount
          FROM WMS_TransferTrips WITH (NOLOCK)
          WHERE Status NOT IN ('COMPLETE','CANCELLED')
          GROUP BY JobID
        ) tc ON tc.JobID=j.JobID
        WHERE j.Status IN ('PENDING','IN_PROGRESS')
        ORDER BY
          CASE j.Priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,
          j.CreatedAt ASC
      `);
      return result.recordset;
    }, 10_000);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/jobs', async (req, res) => {
  const { status, date } = req.query;
  const cacheKey = `tr:jobs:${status||'all'}:${date||''}`;
  try {
    const data = await cache.wrap(cacheKey, async () => {
      const pool = getPool();
      const r = pool.request();
      const conditions = [];
      if (status) { r.input('status', sql.NVarChar, status); conditions.push('j.Status=@status'); }
      if (date) { r.input('date', sql.Date, date); conditions.push('CAST(j.CreatedAt AS DATE)=@date'); }
      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      const result = await r.query(`
        SELECT j.*,
          ss.StationName AS SourceStationName, ss.StationCode AS SourceStationCode,
          ds.StationName AS DestStationName, ds.StationCode AS DestStationCode,
          u.FullName AS CreatedByName,
          ISNULL(ts.TripCount, 0) AS TripCount,
          ISNULL(ts.CompletedTripCount, 0) AS CompletedTripCount,
          ts.FirstTripStart, ts.LastTripEnd
        FROM WMS_TransferJobs j WITH (NOLOCK)
        LEFT JOIN WMS_TransferStations ss WITH (NOLOCK) ON j.SourceStationID=ss.StationID
        LEFT JOIN WMS_TransferStations ds WITH (NOLOCK) ON j.DestStationID=ds.StationID
        LEFT JOIN WMS_Users u WITH (NOLOCK) ON j.CreatedBy=u.UserID
        LEFT JOIN (
          SELECT JobID,
            COUNT(*) AS TripCount,
            SUM(CASE WHEN Status='COMPLETE' THEN 1 ELSE 0 END) AS CompletedTripCount,
            MIN(SourceEntryTime) AS FirstTripStart,
            MAX(DestExitTime) AS LastTripEnd
          FROM WMS_TransferTrips WITH (NOLOCK)
          GROUP BY JobID
        ) ts ON ts.JobID=j.JobID
        ${where}
        ORDER BY j.CreatedAt DESC
      `);
      return result.recordset;
    }, 10_000);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const pool = getPool();
    const [jobResult, tripsResult] = await Promise.all([
      pool.request().input('id', sql.Int, req.params.id).query(`
        SELECT j.*,
          ss.StationName AS SourceStationName, ss.StationCode AS SourceStationCode,
          ds.StationName AS DestStationName, ds.StationCode AS DestStationCode,
          u.FullName AS CreatedByName
        FROM WMS_TransferJobs j
        LEFT JOIN WMS_TransferStations ss ON j.SourceStationID=ss.StationID
        LEFT JOIN WMS_TransferStations ds ON j.DestStationID=ds.StationID
        LEFT JOIN WMS_Users u ON j.CreatedBy=u.UserID
        WHERE j.JobID=@id
      `),
      pool.request().input('id', sql.Int, req.params.id).query(`
        SELECT t.*, u.FullName AS OperatorName, v.VehiclePlate
        FROM WMS_TransferTrips t
        LEFT JOIN WMS_Users u ON t.OperatorID=u.UserID
        LEFT JOIN WMS_TransferVehicles v ON t.VehicleID=v.VehicleID
        WHERE t.JobID=@id
        ORDER BY t.TripNo
      `)
    ]);
    if (!jobResult.recordset[0]) return res.status(404).json({ success: false, message: 'ไม่พบงาน' });
    res.json({ success: true, job: jobResult.recordset[0], trips: tripsResult.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/jobs', async (req, res) => {
  try {
    const { sourceStationId, destStationId, productDesc, plannedBundles, plannedWeightKg, priority, notes } = req.body;
    if (!sourceStationId || !destStationId || !productDesc) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็น' });
    }
    const pool = getPool();
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10).replace(/-/g, '');
    const seqResult = await pool.request()
      .query(`SELECT COUNT(*)+1 AS seq FROM WMS_TransferJobs WHERE CAST(CreatedAt AS DATE)=CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)`);
    const seq = seqResult.recordset[0].seq.toString().padStart(3, '0');
    const jobCode = `TF${today}${seq}`;

    const result = await pool.request()
      .input('code', sql.NVarChar, jobCode)
      .input('src', sql.Int, sourceStationId)
      .input('dst', sql.Int, destStationId)
      .input('prod', sql.NVarChar, productDesc)
      .input('bundles', sql.Int, plannedBundles || null)
      .input('weight', sql.Decimal(12, 3), plannedWeightKg || null)
      .input('priority', sql.NVarChar, priority || 'NORMAL')
      .input('notes', sql.NVarChar, notes || null)
      .input('createdBy', sql.Int, req.user.UserID)
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO WMS_TransferJobs (JobCode, SourceStationID, DestStationID, ProductDesc, PlannedBundles, PlannedWeightKg, Priority, Notes, CreatedBy, CreatedAt)
        OUTPUT INSERTED.JobID
        VALUES (@code, @src, @dst, @prod, @bundles, @weight, @priority, @notes, @createdBy, @createdAt)
      `);
    res.json({ success: true, jobId: result.recordset[0].JobID, jobCode });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/jobs/:id', async (req, res) => {
  try {
    const { sourceStationId, destStationId, productDesc, plannedBundles, plannedWeightKg, priority, notes } = req.body;
    if (!sourceStationId || !destStationId || !productDesc) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็น' });
    }
    const pool = getPool();
    const check = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query("SELECT Status FROM WMS_TransferJobs WHERE JobID=@id");
    if (!check.recordset[0]) return res.status(404).json({ success: false, message: 'ไม่พบงาน' });
    if (!['PENDING', 'ASSIGNED'].includes(check.recordset[0].Status)) {
      return res.status(400).json({ success: false, message: 'ไม่สามารถแก้ไขงานที่เริ่มดำเนินการแล้ว' });
    }
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('src', sql.Int, sourceStationId)
      .input('dst', sql.Int, destStationId)
      .input('prod', sql.NVarChar, productDesc)
      .input('bundles', sql.Int, plannedBundles || null)
      .input('weight', sql.Decimal(12, 3), plannedWeightKg || null)
      .input('priority', sql.NVarChar, priority || 'NORMAL')
      .input('notes', sql.NVarChar, notes || null)
      .query(`UPDATE WMS_TransferJobs
        SET SourceStationID=@src, DestStationID=@dst, ProductDesc=@prod,
            PlannedBundles=@bundles, PlannedWeightKg=@weight, Priority=@priority, Notes=@notes
        WHERE JobID=@id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/jobs/:id', async (req, res) => {
  try {
    const pool = getPool();
    const check = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query("SELECT Status FROM WMS_TransferJobs WHERE JobID=@id");
    if (!check.recordset[0]) return res.status(404).json({ success: false, message: 'ไม่พบงาน' });
    const currentStatus = check.recordset[0].Status;
    if (currentStatus === 'COMPLETE') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถลบงานที่เสร็จสิ้นแล้ว' });
    }
    if (currentStatus === 'PENDING' || currentStatus === 'CANCELLED') {
      await pool.request().input('id', sql.Int, req.params.id)
        .query("DELETE FROM WMS_TransferTrips WHERE JobID=@id");
      await pool.request().input('id', sql.Int, req.params.id)
        .query("DELETE FROM WMS_TransferJobs WHERE JobID=@id");
    } else {
      await pool.request().input('id', sql.Int, req.params.id)
        .query("UPDATE WMS_TransferTrips SET Status='CANCELLED' WHERE JobID=@id AND Status NOT IN ('COMPLETE','CANCELLED')");
      await pool.request().input('id', sql.Int, req.params.id)
        .query("UPDATE WMS_TransferJobs SET Status='CANCELLED' WHERE JobID=@id");
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/jobs/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const pool = getPool();
    const completedAt = status === 'COMPLETE' ? ', CompletedAt=DATEADD(HOUR,7,GETUTCDATE())' : '';
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('status', sql.NVarChar, status)
      .query(`UPDATE WMS_TransferJobs SET Status=@status${completedAt} WHERE JobID=@id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- TRIPS ---

router.get('/trips/active', async (req, res) => {
  const cacheKey = `tr:trips:active:${req.user.UserID}`;
  try {
    const data = await cache.wrap(cacheKey, async () => {
      const result = await getPool().request()
        .input('op', sql.Int, req.user.UserID)
        .query(`
          SELECT t.*, j.JobCode, j.ProductDesc, j.SourceStationID, j.DestStationID,
            ss.StationName AS SourceStationName, ds.StationName AS DestStationName,
            j.PlannedBundles, j.PlannedWeightKg, j.Priority,
            v.VehiclePlate, v.VehicleCode
          FROM WMS_TransferTrips t WITH (NOLOCK)
          JOIN WMS_TransferJobs j           WITH (NOLOCK) ON t.JobID=j.JobID
          LEFT JOIN WMS_TransferStations ss WITH (NOLOCK) ON j.SourceStationID=ss.StationID
          LEFT JOIN WMS_TransferStations ds WITH (NOLOCK) ON j.DestStationID=ds.StationID
          LEFT JOIN WMS_TransferVehicles v  WITH (NOLOCK) ON t.VehicleID=v.VehicleID
          WHERE t.OperatorID=@op AND t.Status NOT IN ('COMPLETE','CANCELLED')
          ORDER BY t.CreatedAt DESC
        `);
      return result.recordset;
    }, 10_000);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/trips', async (req, res) => {
  try {
    const { jobId, operatorId, vehicleId } = req.body;
    if (!jobId) return res.status(400).json({ success: false, message: 'กรุณาระบุ jobId' });
    if (!operatorId) return res.status(400).json({ success: false, message: 'กรุณาเลือกพนักงานขับรถ' });
    if (!vehicleId) return res.status(400).json({ success: false, message: 'กรุณาเลือกรถขนย้าย' });

    const pool = getPool();
    const seqResult = await pool.request()
      .input('jid', sql.Int, jobId)
      .query('SELECT ISNULL(MAX(TripNo),0)+1 AS nextNo FROM WMS_TransferTrips WHERE JobID=@jid');
    const tripNo = seqResult.recordset[0].nextNo;

    const result = await pool.request()
      .input('jid', sql.Int, jobId)
      .input('no', sql.Int, tripNo)
      .input('op', sql.Int, operatorId)
      .input('vid', sql.Int, vehicleId)
      .query(`
        INSERT INTO WMS_TransferTrips (JobID, TripNo, OperatorID, VehicleID, Status)
        OUTPUT INSERTED.TripID
        VALUES (@jid, @no, @op, @vid, 'PENDING')
      `);

    await pool.request()
      .input('jid', sql.Int, jobId)
      .query("UPDATE WMS_TransferJobs SET Status='ASSIGNED' WHERE JobID=@jid AND Status='PENDING'");

    res.json({ success: true, tripId: result.recordset[0].TripID, tripNo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/trips/:id/reassign', async (req, res) => {
  try {
    const { operatorId, vehicleId } = req.body;
    if (!operatorId || !vehicleId) return res.status(400).json({ success: false, message: 'กรุณาเลือกพนักงานและรถ' });
    const pool = getPool();
    const r = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('op', sql.Int, operatorId)
      .input('vid', sql.Int, vehicleId)
      .query("UPDATE WMS_TransferTrips SET OperatorID=@op, VehicleID=@vid WHERE TripID=@id AND Status='PENDING'");
    if (r.rowsAffected[0] === 0) {
      return res.status(400).json({ success: false, message: 'ไม่สามารถแก้ไขได้ — รอบนี้เริ่มดำเนินการแล้ว' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/trips/:id/source-entry', async (req, res) => {
  try {
    const pool = getPool();
    const r = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query("UPDATE WMS_TransferTrips SET SourceEntryTime=DATEADD(HOUR,7,GETUTCDATE()), Status='SOURCE_ENTRY' OUTPUT INSERTED.JobID WHERE TripID=@id AND Status='PENDING'");
    if (r.recordset.length > 0) {
      await pool.request()
        .input('jid', sql.Int, r.recordset[0].JobID)
        .query("UPDATE WMS_TransferJobs SET Status='IN_PROGRESS' WHERE JobID=@jid AND Status='ASSIGNED'");
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/trips/:id/source-exit', async (req, res) => {
  try {
    const { bundleCount, totalWeightKg, notes } = req.body;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('bundles', sql.Int, bundleCount)
      .input('weight', sql.Decimal(12, 3), totalWeightKg)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        UPDATE WMS_TransferTrips
        SET SourceExitTime=DATEADD(HOUR,7,GETUTCDATE()), BundleCount=@bundles, TotalWeightKg=@weight, Notes=@notes, Status='SOURCE_EXIT'
        WHERE TripID=@id AND Status='SOURCE_ENTRY'
      `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/trips/:id/dest-entry', async (req, res) => {
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query("UPDATE WMS_TransferTrips SET DestEntryTime=DATEADD(HOUR,7,GETUTCDATE()), Status='DEST_ENTRY' WHERE TripID=@id AND Status='SOURCE_EXIT'");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/trips/:id/dest-exit', async (req, res) => {
  try {
    const pool = getPool();
    const tripResult = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        UPDATE WMS_TransferTrips SET DestExitTime=DATEADD(HOUR,7,GETUTCDATE()), Status='COMPLETE'
        OUTPUT INSERTED.JobID, INSERTED.BundleCount, INSERTED.TotalWeightKg
        WHERE TripID=@id AND Status='DEST_ENTRY'
      `);

    if (tripResult.recordset.length > 0) {
      const { JobID, BundleCount, TotalWeightKg } = tripResult.recordset[0];
      await pool.request()
        .input('jid', sql.Int, JobID)
        .input('bundles', sql.Int, BundleCount || 0)
        .input('weight', sql.Decimal(12, 3), TotalWeightKg || 0)
        .query(`
          UPDATE WMS_TransferJobs
          SET ActualBundles = ISNULL(ActualBundles,0) + @bundles,
              ActualWeightKg = ISNULL(ActualWeightKg,0) + @weight
          WHERE JobID=@jid
        `);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /transfer/dashboard — performance metrics for the Transfer system
router.get('/dashboard', async (req, res) => {
  try {
    const pool = getPool();
    const todayBkk  = new Date(Date.now() + 7*3600000).toISOString().slice(0,10);
    const monthBkk  = todayBkk.slice(0,7);
    const yearBkk   = todayBkk.slice(0,4);

    const [statusSummary, timeSeries, vehicleRank, routeRank, pendingLong, avgDuration] = await Promise.all([

      // 1. สรุปจำนวนงานแต่ละสถานะ (วันนี้ / เดือนนี้ / ปีนี้ / ทั้งหมด)
      pool.request()
        .input('today', sql.NVarChar, todayBkk)
        .input('month', sql.NVarChar, monthBkk + '%')
        .input('year',  sql.NVarChar, yearBkk + '%')
        .query(`
          SELECT Status,
            COUNT(*) AS Total,
            SUM(CASE WHEN CAST(CreatedAt AS DATE) = @today THEN 1 ELSE 0 END) AS Today,
            SUM(CASE WHEN CONVERT(NVARCHAR(7), CreatedAt, 120) LIKE @month THEN 1 ELSE 0 END) AS ThisMonth,
            SUM(CASE WHEN CONVERT(NVARCHAR(4), CreatedAt, 120) LIKE @year  THEN 1 ELSE 0 END) AS ThisYear
          FROM WMS_TransferJobs
          GROUP BY Status
        `),

      // 2. งานรายวัน 30 วันล่าสุด
      pool.request().query(`
        SELECT CAST(CreatedAt AS DATE) AS Day,
          COUNT(*) AS Created,
          SUM(CASE WHEN Status='COMPLETE' THEN 1 ELSE 0 END) AS Completed
        FROM WMS_TransferJobs
        WHERE CreatedAt >= DATEADD(DAY,-29,GETDATE())
        GROUP BY CAST(CreatedAt AS DATE)
        ORDER BY Day
      `),

      // 3. รถที่ใช้บ่อย
      pool.request().query(`
        SELECT TOP 8 v.LicensePlate, v.VehicleCode,
          COUNT(DISTINCT t.TripID) AS TripCount,
          COUNT(DISTINCT t.JobID) AS JobCount
        FROM WMS_TransferTrips t
        JOIN WMS_TransferVehicles v ON t.VehicleID=v.VehicleID
        GROUP BY v.VehicleID, v.LicensePlate, v.VehicleCode
        ORDER BY TripCount DESC
      `),

      // 4. เส้นทางสถานีที่ใช้บ่อย
      pool.request().query(`
        SELECT TOP 8
          ss.StationName AS Source, ds.StationName AS Dest,
          COUNT(*) AS JobCount,
          SUM(j.ActualBundles) AS TotalBundles,
          SUM(j.ActualWeightKg) AS TotalWeight
        FROM WMS_TransferJobs j
        JOIN WMS_TransferStations ss ON j.SourceStationID=ss.StationID
        JOIN WMS_TransferStations ds ON j.DestStationID=ds.StationID
        GROUP BY ss.StationName, ds.StationName
        ORDER BY JobCount DESC
      `),

      // 5. งาน PENDING ที่ค้างนานที่สุด
      pool.request().query(`
        SELECT TOP 5 j.JobCode, j.ProductDetail,
          ss.StationName AS Source, ds.StationName AS Dest,
          j.PlannedBundles, j.CreatedAt,
          DATEDIFF(HOUR, j.CreatedAt, GETDATE()) AS HoursWaiting
        FROM WMS_TransferJobs j
        JOIN WMS_TransferStations ss ON j.SourceStationID=ss.StationID
        JOIN WMS_TransferStations ds ON j.DestStationID=ds.StationID
        WHERE j.Status IN ('PENDING','ASSIGNED')
        ORDER BY j.CreatedAt ASC
      `),

      // 6. เวลาเฉลี่ยในการเสร็จงาน (จากสร้างถึง COMPLETE)
      pool.request()
        .input('month2', sql.NVarChar, monthBkk + '%')
        .query(`
          SELECT
            AVG(DATEDIFF(MINUTE, CreatedAt, CompletedAt)) AS AvgMinThisMonth,
            MIN(DATEDIFF(MINUTE, CreatedAt, CompletedAt)) AS MinMin,
            MAX(DATEDIFF(MINUTE, CreatedAt, CompletedAt)) AS MaxMin,
            COUNT(*) AS CompletedCount
          FROM WMS_TransferJobs
          WHERE Status='COMPLETE' AND CompletedAt IS NOT NULL
            AND CONVERT(NVARCHAR(7), CreatedAt, 120) LIKE @month2
        `)
    ]);

    res.json({
      success: true,
      data: {
        statusSummary: statusSummary.recordset,
        timeSeries: timeSeries.recordset,
        vehicleRank: vehicleRank.recordset,
        routeRank: routeRank.recordset,
        pendingLong: pendingLong.recordset,
        avgDuration: avgDuration.recordset[0] || {}
      }
    });
  } catch (err) {
    console.error('Transfer dashboard:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
