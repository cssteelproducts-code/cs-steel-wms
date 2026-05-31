const { sql, getPool } = require('../config/db');

async function runAlertCheck() {
  const pool = getPool();
  const newAlerts = [];

  const configs = await pool.request()
    .query('SELECT * FROM WMS_AlertConfig WHERE IsActive = 1');

  for (const cfg of configs.recordset) {
    if (cfg.AlertType === 'OVERSTAY') {
      const r = pool.request().input('threshold', sql.Decimal(10, 2), cfg.ThresholdValue);
      if (cfg.WarehouseID) r.input('warehouseId', sql.Int, cfg.WarehouseID);
      if (cfg.VehicleTypeID) r.input('vehicleTypeId', sql.Int, cfg.VehicleTypeID);

      const trips = await r.query(`
        SELECT t.TripID, t.LicensePlate, t.WarehouseID, t.VehicleTypeID,
          DATEDIFF(MINUTE, t.CreatedAt, DATEADD(HOUR,7,GETUTCDATE())) AS MinutesInWarehouse
        FROM WMS_Trips t
        WHERE t.Status NOT IN ('Complete', 'Cancelled')
          AND DATEDIFF(MINUTE, t.CreatedAt, DATEADD(HOUR,7,GETUTCDATE())) > @threshold
          ${cfg.WarehouseID ? 'AND t.WarehouseID = @warehouseId' : ''}
          ${cfg.VehicleTypeID ? 'AND t.VehicleTypeID = @vehicleTypeId' : ''}
          AND NOT EXISTS (
            SELECT 1 FROM WMS_Alerts a
            WHERE a.TripID = t.TripID AND a.AlertType = 'OVERSTAY'
              AND a.IsResolved = 0
              AND CAST(a.CreatedAt AS DATE) = CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
          )
      `);

      if (trips.recordset.length > 0) {
        const batchReq = pool.request();
        const vals = trips.recordset.map((trip, i) => {
          const hrs = Math.floor(trip.MinutesInWarehouse / 60);
          const mins = trip.MinutesInWarehouse % 60;
          const t = hrs > 0 ? `${hrs} ชม. ${mins} นาที` : `${mins} นาที`;
          const msg = `ทะเบียน ${trip.LicensePlate} อยู่ในคลังนาน ${t} (เกินกำหนด ${cfg.ThresholdValue} นาที)`;
          const severity = trip.MinutesInWarehouse > cfg.ThresholdValue * 2 ? 'CRITICAL' : 'WARNING';
          batchReq.input(`sv${i}`, sql.NVarChar, severity);
          batchReq.input(`ti${i}`, sql.Int, trip.TripID);
          batchReq.input(`wi${i}`, sql.Int, trip.WarehouseID);
          batchReq.input(`ms${i}`, sql.NVarChar, msg);
          newAlerts.push(msg);
          return `('OVERSTAY', @sv${i}, @ti${i}, @wi${i}, @ms${i}, DATEADD(HOUR,7,GETUTCDATE()))`;
        });
        await batchReq.query(`INSERT INTO WMS_Alerts (AlertType, Severity, TripID, WarehouseID, Message, CreatedAt) VALUES ${vals.join(', ')}`);
      }
    }

    if (cfg.AlertType === 'OVERTIME_ENTRY') {
      const trips = await pool.request().query(`
        SELECT t.TripID, t.LicensePlate, t.WarehouseID,
          ISNULL(vt.TypeName, 'ไม่ระบุ') as TypeName,
          ISNULL(vt.StartHour, 8) as StartHour, ISNULL(vt.StartMinute, 0) as StartMinute,
          ISNULL(vt.CutoffHour, 16) as CutoffHour, ISNULL(vt.CutoffMinute, 0) as CutoffMinute,
          DATEPART(HOUR, wi.WeighDateTime)*60 +
            DATEPART(MINUTE, wi.WeighDateTime) as LocalMin
        FROM WMS_Trips t
        JOIN WMS_WeighIn wi ON wi.TripID = t.TripID
        LEFT JOIN WMS_VehicleTypes vt ON vt.TypeID = t.VehicleTypeID
        WHERE t.TripDate >= DATEADD(DAY,-1, CAST(GETUTCDATE() AS DATE))
          AND t.Status NOT IN ('Cancelled')
          AND NOT EXISTS (
            SELECT 1 FROM WMS_Alerts a
            WHERE a.TripID = t.TripID AND a.AlertType = 'OVERTIME_ENTRY'
              AND a.CreatedAt >= CAST(DATEADD(HOUR,7,GETUTCDATE()) AS DATE)
          )
      `);
      const overtime = trips.recordset.filter(r => {
        const start = r.StartHour * 60 + r.StartMinute;
        const cutoff = r.CutoffHour * 60 + r.CutoffMinute;
        return r.LocalMin < start || r.LocalMin > cutoff;
      });
      if (overtime.length > 0) {
        const batchReq = pool.request();
        const vals = overtime.map((trip, i) => {
          const h = String(Math.floor(trip.LocalMin / 60)).padStart(2, '0');
          const m = String(trip.LocalMin % 60).padStart(2, '0');
          const s = `${String(trip.StartHour).padStart(2,'0')}:${String(trip.StartMinute).padStart(2,'0')}`;
          const c = `${String(trip.CutoffHour).padStart(2,'0')}:${String(trip.CutoffMinute).padStart(2,'0')}`;
          const msg = `ทะเบียน ${trip.LicensePlate} (${trip.TypeName}) เข้าคลังนอกเวลา ${h}:${m} น. (กำหนด ${s}–${c} น.)`;
          batchReq.input(`ti${i}`, sql.Int, trip.TripID);
          batchReq.input(`wi${i}`, sql.Int, trip.WarehouseID);
          batchReq.input(`ms${i}`, sql.NVarChar, msg);
          newAlerts.push(msg);
          return `('OVERTIME_ENTRY', 'WARNING', @ti${i}, @wi${i}, @ms${i}, DATEADD(HOUR,7,GETUTCDATE()))`;
        });
        await batchReq.query(`INSERT INTO WMS_Alerts (AlertType, Severity, TripID, WarehouseID, Message, CreatedAt) VALUES ${vals.join(', ')}`);
      }
    }

    if (cfg.AlertType === 'OVERWEIGHT') {
      const trips = await pool.request()
        .input('threshold', sql.Decimal(10, 2), cfg.ThresholdValue)
        .query(`
          SELECT t.TripID, t.LicensePlate, t.WarehouseID, wo.NetWeight
          FROM WMS_Trips t
          JOIN WMS_WeighOut wo ON wo.TripID = t.TripID
          WHERE t.Status = 'Complete'
            AND t.CompletedAt >= DATEADD(HOUR, 5, GETUTCDATE())
            AND wo.NetWeight > @threshold
            AND NOT EXISTS (
              SELECT 1 FROM WMS_Alerts a
              WHERE a.TripID = t.TripID AND a.AlertType = 'OVERWEIGHT'
            )
        `);

      if (trips.recordset.length > 0) {
        const batchReq = pool.request();
        const vals = trips.recordset.map((trip, i) => {
          const msg = `ทะเบียน ${trip.LicensePlate} น้ำหนักสุทธิ ${trip.NetWeight.toFixed(2)} กก. เกินพิกัด ${cfg.ThresholdValue} กก.`;
          batchReq.input(`ti${i}`, sql.Int, trip.TripID);
          batchReq.input(`wi${i}`, sql.Int, trip.WarehouseID);
          batchReq.input(`ms${i}`, sql.NVarChar, msg);
          newAlerts.push(msg);
          return `('OVERWEIGHT', 'WARNING', @ti${i}, @wi${i}, @ms${i}, DATEADD(HOUR,7,GETUTCDATE()))`;
        });
        await batchReq.query(`INSERT INTO WMS_Alerts (AlertType, Severity, TripID, WarehouseID, Message, CreatedAt) VALUES ${vals.join(', ')}`);
      }
    }
  }

  // Vehicle expiry alerts
  try { await checkVehicleExpiry(pool); } catch (e) { console.error('Vehicle expiry check failed:', e.message); }

  return newAlerts.length;
}

async function checkVehicleExpiry(pool) {
  try {
    const tableCheck = await pool.request()
      .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='WMS_InternalVehicles'`);
    if (!tableCheck.recordset.length) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const [vehiclesRes, alertsRes] = await Promise.all([
      pool.request().query('SELECT * FROM WMS_InternalVehicles WHERE IsActive=1'),
      // Batch-fetch all recent vehicle alerts in ONE query instead of N×M queries
      pool.request().query(`
        SELECT AlertType, TripID, CONVERT(NVARCHAR(10), CreatedAt, 23) as AlertDate
        FROM WMS_Alerts
        WHERE AlertType LIKE 'VEH_%'
          AND CreatedAt >= DATEADD(DAY, -8, GETUTCDATE())
      `)
    ]);

    // Build a Set for O(1) duplicate checks: "AlertType:VehicleID:YYYY-MM-DD"
    const alertSet = new Set(alertsRes.recordset.map(a => `${a.AlertType}:${a.TripID}:${a.AlertDate}`));

    const EXPIRY_FIELDS = [
      { field: 'ActExpiry',        type: 'VEH_ACT_EXP',   label: 'พ.ร.บ.' },
      { field: 'InsuranceExpiry',  type: 'VEH_INS_EXP',   label: 'ประกันภัย' },
      { field: 'InspectionExpiry', type: 'VEH_INSP_EXP',  label: 'ตรวจสภาพ' },
      { field: 'OtherDocExpiry',   type: 'VEH_OTHER_EXP', label: null },
      { field: 'TaxExpiry',        type: 'VEH_TAX_EXP',   label: 'ภาษีรถ' },
    ];
    const MILESTONES = [90, 60, 30];

    const inserts = []; // collect all needed inserts, fire in one batch per type

    for (const v of vehiclesRes.recordset) {
      for (const ef of EXPIRY_FIELDS) {
        const expiryDate = v[ef.field];
        if (!expiryDate) continue;

        const expiry = new Date(expiryDate);
        expiry.setHours(0, 0, 0, 0);
        const daysLeft = Math.round((expiry - today) / 86400000);
        const label = ef.label || v.OtherDocName || 'เอกสาร';
        const vName = v.VehicleName ? ` (${v.VehicleName})` : '';

        if (daysLeft > 92) continue;

        // Milestone alerts at 90, 60, 30 days — check against in-memory Set
        for (const m of MILESTONES) {
          if (daysLeft >= m - 2 && daysLeft <= m + 2) {
            const mType = `${ef.type}_M${m}`;
            // Check last 7 days for this milestone alert
            let hasRecent = false;
            for (let d = 0; d <= 7; d++) {
              const ds = new Date(today - d * 86400000).toISOString().slice(0, 10);
              if (alertSet.has(`${mType}:${v.VehicleID}:${ds}`)) { hasRecent = true; break; }
            }
            if (!hasRecent) {
              const expStr = expiry.toLocaleDateString('th-TH');
              const msg = `รถ ${v.LicensePlate}${vName} — ${label} สิ้นอายุในอีก ${daysLeft} วัน (${expStr})`;
              inserts.push({ type: mType, vid: v.VehicleID, msg, sev: m <= 30 ? 'CRITICAL' : 'WARNING' });
              alertSet.add(`${mType}:${v.VehicleID}:${todayStr}`); // prevent duplicate within same run
            }
          }
        }

        // Daily alerts when < 30 days remaining (or expired)
        if (daysLeft < 30) {
          if (!alertSet.has(`${ef.type}:${v.VehicleID}:${todayStr}`)) {
            let msg;
            if (daysLeft < 0) msg = `🚨 รถ ${v.LicensePlate}${vName} — ${label} หมดอายุไปแล้ว ${Math.abs(daysLeft)} วัน!`;
            else if (daysLeft === 0) msg = `🚨 รถ ${v.LicensePlate}${vName} — ${label} หมดอายุวันนี้!`;
            else msg = `รถ ${v.LicensePlate}${vName} — ${label} สิ้นอายุในอีก ${daysLeft} วัน`;
            inserts.push({ type: ef.type, vid: v.VehicleID, msg, sev: 'CRITICAL' });
            alertSet.add(`${ef.type}:${v.VehicleID}:${todayStr}`);
          }
        }
      }
    }

    // Fire all inserts in one batch
    if (inserts.length > 0) {
      const batchReq = pool.request();
      const vals = inserts.map((ins, i) => {
        batchReq.input(`tp${i}`, sql.NVarChar, ins.type);
        batchReq.input(`vid${i}`, sql.Int, ins.vid);
        batchReq.input(`msg${i}`, sql.NVarChar, ins.msg);
        batchReq.input(`sev${i}`, sql.NVarChar, ins.sev);
        return `(@tp${i},@sev${i},@vid${i},@msg${i},DATEADD(HOUR,7,GETUTCDATE()))`;
      });
      await batchReq.query(`INSERT INTO WMS_Alerts (AlertType,Severity,TripID,Message,CreatedAt) VALUES ${vals.join(',')}`);
    }
  } catch (e) { console.error('checkVehicleExpiry error:', e.message); }
}

module.exports = { runAlertCheck };
