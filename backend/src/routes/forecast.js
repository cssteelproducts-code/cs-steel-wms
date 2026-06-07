const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/forecast/tomorrow
// วิเคราะห์ข้อมูลย้อนหลัง 90 วัน เฉพาะวันในสัปดาห์เดียวกับพรุ่งนี้
router.get('/tomorrow', authenticate, async (req, res) => {
  try {
    const pool = getPool();

    // ดึงข้อมูลย้อนหลัง 90 วัน เฉพาะวันในสัปดาห์เดียวกับพรุ่งนี้
    const history = await pool.request().query(`
      SELECT
        t.TripID,
        t.TripDate,
        t.Status,
        t.Priority,
        t.DeliveryType,
        DATEPART(HOUR, wi.WeighDateTime) as WeighInHour,
        vt.TypeName as VehicleType,
        wo.NetWeight,
        wo.GrossWeight,
        wi.TareWeight,
        DATEDIFF(MINUTE, wi.WeighDateTime, wo.WeighDateTime) as WeighToWeighMinutes,
        c.CustomerName,
        CAST(t.TripDate AS DATE) as DateOnly
      FROM WMS_Trips t
      LEFT JOIN WMS_WeighIn wi   ON t.TripID = wi.TripID
      LEFT JOIN WMS_WeighOut wo  ON t.TripID = wo.TripID
      LEFT JOIN WMS_VehicleTypes vt ON t.VehicleTypeID = vt.TypeID
      LEFT JOIN WMS_Customers c  ON t.CustomerID = c.CustomerID
      WHERE
        DATEPART(WEEKDAY, t.TripDate) = DATEPART(WEEKDAY, DATEADD(DAY, 1, GETUTCDATE()))
        AND t.TripDate >= CAST(DATEADD(DAY, -90, GETUTCDATE()) AS DATE)
        AND t.TripDate < CAST(GETUTCDATE() AS DATE)
        AND t.Status NOT IN ('Cancelled')
      ORDER BY t.TripDate DESC
    `);

    // ข้อมูลสถานีขึ้นสินค้า (duration สำหรับ avg time)
    const stationData = await pool.request().query(`
      SELECT
        ls.StationName,
        lr.DurationMinutes,
        CAST(t.TripDate AS DATE) as DateOnly
      FROM WMS_LoadingRecord lr
      JOIN WMS_Trips t ON lr.TripID = t.TripID
      JOIN WMS_LoadingStations ls ON lr.StationID = ls.StationID
      WHERE
        DATEPART(WEEKDAY, t.TripDate) = DATEPART(WEEKDAY, DATEADD(DAY, 1, GETUTCDATE()))
        AND t.TripDate >= CAST(DATEADD(DAY, -90, GETUTCDATE()) AS DATE)
        AND t.TripDate < CAST(GETUTCDATE() AS DATE)
        AND lr.DurationMinutes IS NOT NULL
        AND lr.DurationMinutes > 0
    `);

    // ปริมาณรถต่อสถานีต่อวัน (นับทุก trip ไม่กรอง duration)
    const stationVolumeData = await pool.request().query(`
      SELECT
        ls.StationName,
        CAST(t.TripDate AS DATE) as DateOnly,
        COUNT(*) as TripCount
      FROM WMS_LoadingRecord lr
      JOIN WMS_Trips t ON lr.TripID = t.TripID
      JOIN WMS_LoadingStations ls ON lr.StationID = ls.StationID
      WHERE
        DATEPART(WEEKDAY, t.TripDate) = DATEPART(WEEKDAY, DATEADD(DAY, 1, GETUTCDATE()))
        AND t.TripDate >= CAST(DATEADD(DAY, -90, GETUTCDATE()) AS DATE)
        AND t.TripDate < CAST(GETUTCDATE() AS DATE)
      GROUP BY ls.StationName, CAST(t.TripDate AS DATE)
    `);

    const rows = history.recordset;

    if (rows.length === 0) {
      return res.json({ success: true, data: null, message: 'ไม่มีข้อมูลย้อนหลังเพียงพอ' });
    }

    // --- จำนวนรถต่อวัน ---
    const byDate = {};
    rows.forEach(r => {
      const d = r.DateOnly?.toISOString?.()?.slice(0, 10) || String(r.DateOnly);
      byDate[d] = (byDate[d] || 0) + 1;
    });
    const dayCounts = Object.values(byDate);
    const avgPerDay = Math.round(dayCounts.reduce((s, v) => s + v, 0) / dayCounts.length);
    const minPerDay = Math.min(...dayCounts);
    const maxPerDay = Math.max(...dayCounts);

    // --- ช่วงเวลาหนาแน่น (0-23) ---
    const hourBuckets = Array(24).fill(0);
    rows.forEach(r => { if (r.WeighInHour != null) hourBuckets[r.WeighInHour]++; });
    const totalHourEntries = hourBuckets.reduce((s, v) => s + v, 0) || 1;
    const hourDistribution = hourBuckets.map((count, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      count,
      pct: Math.round((count / totalHourEntries) * 100),
    }));
    const peakHour = hourDistribution.reduce((a, b) => b.count > a.count ? b : a);

    // --- ประเภทรถ ---
    const typeMap = {};
    rows.forEach(r => {
      const k = r.VehicleType || 'ไม่ระบุ';
      typeMap[k] = (typeMap[k] || 0) + 1;
    });
    const vehicleTypes = Object.entries(typeMap)
      .map(([type, count]) => ({ type, count, pct: Math.round((count / rows.length) * 100) }))
      .sort((a, b) => b.count - a.count);

    // --- ลูกค้าที่มาบ่อย ---
    const custMap = {};
    rows.forEach(r => {
      if (!r.CustomerName) return;
      custMap[r.CustomerName] = (custMap[r.CustomerName] || 0) + 1;
    });
    const topCustomers = Object.entries(custMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- น้ำหนักเฉลี่ย ---
    const withWeight = rows.filter(r => r.NetWeight != null);
    const avgNetWeight = withWeight.length
      ? Math.round(withWeight.reduce((s, r) => s + parseFloat(r.NetWeight), 0) / withWeight.length)
      : null;
    const minNetWeight = withWeight.length ? Math.round(Math.min(...withWeight.map(r => parseFloat(r.NetWeight)))) : null;
    const maxNetWeight = withWeight.length ? Math.round(Math.max(...withWeight.map(r => parseFloat(r.NetWeight)))) : null;

    // --- เวลาเฉลี่ยชั่งเข้า → ชั่งออก ---
    const withDuration = rows.filter(r => r.WeighToWeighMinutes != null && r.WeighToWeighMinutes > 0 && r.WeighToWeighMinutes < 600);
    const avgTotalMinutes = withDuration.length
      ? Math.round(withDuration.reduce((s, r) => s + r.WeighToWeighMinutes, 0) / withDuration.length)
      : null;
    const minTotalMinutes = withDuration.length ? Math.min(...withDuration.map(r => r.WeighToWeighMinutes)) : null;
    const maxTotalMinutes = withDuration.length ? Math.max(...withDuration.map(r => r.WeighToWeighMinutes)) : null;

    // --- แยกตามประเภทการส่ง ---
    const deliveryMap = {};
    rows.forEach(r => {
      const k = r.DeliveryType || 'ไม่ระบุ';
      deliveryMap[k] = (deliveryMap[k] || 0) + 1;
    });
    const deliveryTypeBreakdown = Object.entries(deliveryMap)
      .map(([type, count]) => ({ type, count, pct: Math.round((count / rows.length) * 100) }))
      .sort((a, b) => b.count - a.count);

    // --- แยกตาม Priority ---
    const priorityMap = {};
    rows.forEach(r => {
      const k = r.Priority || 'Normal';
      priorityMap[k] = (priorityMap[k] || 0) + 1;
    });
    const priorityBreakdown = Object.entries(priorityMap)
      .map(([priority, count]) => ({ priority, count, pct: Math.round((count / rows.length) * 100) }))
      .sort((a, b) => b.count - a.count);

    // --- เวลาเฉลี่ยแยกตามประเภทรถ ---
    const typeTimeMap = {};
    withDuration.forEach(r => {
      const k = r.VehicleType || 'ไม่ระบุ';
      if (!typeTimeMap[k]) typeTimeMap[k] = [];
      typeTimeMap[k].push(r.WeighToWeighMinutes);
    });
    const avgTimeByType = Object.entries(typeTimeMap)
      .map(([type, mins]) => ({
        type,
        avgMinutes: Math.round(mins.reduce((s, v) => s + v, 0) / mins.length),
        count: mins.length,
      }))
      .sort((a, b) => b.count - a.count);

    // --- แนวโน้มย้อนหลัง (ทุก occurrence ของวันในสัปดาห์นี้) ---
    const historicalTrend = Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12);

    // --- เวลาเฉลี่ยต่อสถานี ---
    const stationMap = {};
    stationData.recordset.forEach(r => {
      if (!stationMap[r.StationName]) stationMap[r.StationName] = [];
      stationMap[r.StationName].push(r.DurationMinutes);
    });
    const avgByStation = Object.entries(stationMap).map(([station, mins]) => ({
      station,
      avgMinutes: Math.round(mins.reduce((s, v) => s + v, 0) / mins.length),
      sampleCount: mins.length,
    })).sort((a, b) => b.avgMinutes - a.avgMinutes);

    // --- ปริมาณรถต่อสถานี (forecast) ---
    // สะสม TripCount ต่อสถานีต่อวัน แล้วหาค่าเฉลี่ย
    const stationVolByDay = {}; // { StationName: { date: count } }
    stationVolumeData.recordset.forEach(r => {
      const d = r.DateOnly?.toISOString?.()?.slice(0, 10) || String(r.DateOnly);
      if (!stationVolByDay[r.StationName]) stationVolByDay[r.StationName] = {};
      stationVolByDay[r.StationName][d] = r.TripCount;
    });
    const uniqueDates = new Set(stationVolumeData.recordset.map(r =>
      r.DateOnly?.toISOString?.()?.slice(0, 10) || String(r.DateOnly)
    ));
    const numDays = uniqueDates.size || 1;
    const stationLoadForecast = Object.entries(stationVolByDay).map(([station, dateMap]) => {
      const total = Object.values(dateMap).reduce((s, v) => s + v, 0);
      const avgTrips = Math.round((total / numDays) * 10) / 10;
      const maxTrips = Math.max(...Object.values(dateMap));
      const minTrips = Math.min(...Object.values(dateMap));
      return { station, avgTrips, maxTrips, minTrips, totalSamples: Object.keys(dateMap).length };
    }).sort((a, b) => b.avgTrips - a.avgTrips);
    const maxStationLoad = stationLoadForecast[0]?.avgTrips || 1;

    // --- วันในสัปดาห์พรุ่งนี้ ---
    const DOW = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowDow = DOW[tomorrowDate.getDay()];
    const tomorrowStr = tomorrowDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    res.json({
      success: true,
      data: {
        tomorrowStr,
        tomorrowDow,
        basedOnDays: dayCounts.length,
        vehicleCount: { avg: avgPerDay, min: minPerDay, max: maxPerDay },
        hourDistribution,
        peakHour,
        vehicleTypes,
        topCustomers,
        avgNetWeight, minNetWeight, maxNetWeight,
        avgTotalMinutes, minTotalMinutes, maxTotalMinutes,
        deliveryTypeBreakdown,
        priorityBreakdown,
        avgTimeByType,
        historicalTrend,
        avgByStation,
        stationLoadForecast,
        maxStationLoad,
      }
    });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/forecast/ai-insights - Claude-powered recommendations
router.post('/ai-insights', authenticate, async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.json({ success: false, message: 'ไม่ได้ตั้งค่า ANTHROPIC_API_KEY' });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const { forecastData } = req.body;
    const d = forecastData;

    const prompt = `คุณเป็น AI ผู้เชี่ยวชาญด้านการวางแผนคลังสินค้าและโลจิสติกส์สำหรับบริษัท CS Steel Products

ข้อมูลพยากรณ์สำหรับวัน${d.tomorrowDow}พรุ่งนี้ (อิงจากข้อมูลย้อนหลัง ${d.basedOnDays} สัปดาห์):

📊 ปริมาณรถ: เฉลี่ย ${d.vehicleCount.avg} คัน (ต่ำสุด ${d.vehicleCount.min} / สูงสุด ${d.vehicleCount.max})
⏰ ช่วงหนาแน่นสูงสุด: ${d.peakHour.hour} น. (${d.peakHour.pct}% ของรถทั้งหมด)
⚖️ น้ำหนักสุทธิเฉลี่ย: ${d.avgNetWeight ? d.avgNetWeight.toLocaleString() + ' กก.' : 'ไม่มีข้อมูล'}
⏱️ เวลาเฉลี่ยต่อคัน (ชั่งเข้า→ชั่งออก): ${d.avgTotalMinutes ? d.avgTotalMinutes + ' นาที' : 'ไม่มีข้อมูล'}
🚛 ประเภทรถ: ${d.vehicleTypes.slice(0, 3).map(v => `${v.type} ${v.pct}%`).join(', ')}
👥 ลูกค้าบ่อย: ${d.topCustomers.slice(0, 3).map(c => c.name).join(', ')}
🏭 เวลาเฉลี่ยต่อสถานี: ${d.avgByStation.slice(0, 4).map(s => `${s.station} ${s.avgMinutes}นาที`).join(', ')}

กรุณาวิเคราะห์และให้คำแนะนำในการวางแผนงานวันพรุ่งนี้ โดย:
1. สรุปสถานการณ์ที่คาดว่าจะเกิดขึ้น
2. แนะนำการจัดสรรกำลังคนและทรัพยากร
3. ระบุช่วงเวลาที่ต้องเตรียมพร้อมเป็นพิเศษ
4. ข้อควรระวังหรือความเสี่ยงที่อาจเกิดขึ้น

ตอบเป็นภาษาไทย กระชับ เข้าใจง่าย แบ่งเป็นหัวข้อชัดเจน`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    res.json({ success: true, insight: message.content[0].text });
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
