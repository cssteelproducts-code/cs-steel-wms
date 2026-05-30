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

  return newAlerts.length;
}

module.exports = { runAlertCheck };
