import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { warehouseApi } from '../api';
import { RefreshCw, LogOut, Trash2, CheckCircle } from 'lucide-react';

const todayStr = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const AUDIT_SUBS = [
  { key: 'audit',     label: 'Audit'    },
  { key: 'locations', label: 'Locations'},
  { key: 'typesku',   label: 'TypeSKU'  },
  { key: 'report',    label: 'Report'   },
];
const TRANSFER_SUBS = [
  { key: 'monitor', label: 'Monitor'         },
  { key: 'work',    label: 'งาน'             },
  { key: 'number',  label: 'หมายเลข'        },
  { key: 'order',   label: 'สั่งค้า'        },
  { key: 'round',   label: 'รอบสน / แจ้งมา' },
];

function SubTabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding: '5px 16px', border: '1px solid #e5e7eb', borderRadius: 6,
          background: active === t.key ? '#1a1a1a' : '#fff',
          color: active === t.key ? '#fff' : '#6b7280',
          fontSize: 12, fontWeight: active === t.key ? 600 : 400, cursor: 'pointer',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function Warehouse() {
  const nav = useNavigate();
  const [main, setMain] = useState('forecast');
  const [auditSub, setAuditSub] = useState('audit');
  const [transferSub, setTransferSub] = useState('monitor');
  const [tick, setTick] = useState(0);

  return (
    <div style={{ minHeight: '100%', background: '#f9fafb', fontFamily: "'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 8 }}>
              🏭 คลังสินค้าสำเร็จรูป
            </h2>
            <p style={{ fontSize: 11, color: '#9ca3af' }}>ผู้ควบคุม / ระบบผลิต</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setTick(n => n + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={() => nav(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: '#CC0000', color: '#fff', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
              <LogOut size={13} /> ออก
            </button>
          </div>
        </div>

        {/* Main tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'forecast',      label: 'Forecast',      icon: '📈', sub: false },
            { key: 'internalaudit', label: 'InternalAudit', icon: '📋', sub: true  },
            { key: 'transfer',      label: 'Transfer',      icon: '↔',  sub: true  },
          ].map(t => {
            const active = main === t.key;
            return (
              <button key={t.key} onClick={() => setMain(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
                border: `1px solid ${active ? '#CC0000' : '#e5e7eb'}`, borderRadius: 8,
                background: active ? '#CC0000' : '#fff', color: active ? '#fff' : '#374151',
                fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer',
              }}>
                <span>{t.icon}</span>
                {t.label}
                {t.sub && <span style={{ fontSize: 10, color: active ? 'rgba(255,255,255,.6)' : '#bbb' }}>เมนูย่อย</span>}
              </button>
            );
          })}
        </div>

        {main === 'internalaudit' && <SubTabBar tabs={AUDIT_SUBS}    active={auditSub}    onChange={setAuditSub} />}
        {main === 'transfer'      && <SubTabBar tabs={TRANSFER_SUBS} active={transferSub} onChange={setTransferSub} />}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px' }}>
        {main === 'forecast'      && <ForecastTab key={tick} />}
        {main === 'internalaudit' && auditSub === 'audit'     && <AuditTab />}
        {main === 'internalaudit' && auditSub === 'locations'  && <LocationsTab />}
        {main === 'internalaudit' && auditSub === 'typesku'    && <TypeSKUTab />}
        {main === 'internalaudit' && auditSub === 'report'     && <ReportTab />}
        {main === 'transfer'      && transferSub === 'monitor' && <TransferMonitor key={tick} />}
        {main === 'transfer'      && transferSub !== 'monitor' && <PlaceholderTab label={TRANSFER_SUBS.find(s => s.key === transferSub)?.label} />}
      </div>
    </div>
  );
}

/* ─── Forecast ─────────────────────────────────────────────────────────── */
function ForecastTab() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowLabel = `${String(tomorrow.getDate()).padStart(2, '0')}/${String(tomorrow.getMonth() + 1).padStart(2, '0')}/${tomorrow.getFullYear()}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>📦 พยากรณ์การรับมอบวันพรุ่งนี้</span>
        <span style={{ background: '#CC0000', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 6 }}>{tomorrowLabel}</span>
      </div>

      {/* Warning */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e', display: 'flex', gap: 8 }}>
        ⚠️ ปัจจุบันคุณกำลังดูภาพถ่ายค่า พยากรณ์แต่ละแผนกยังไม่มีข้อมูลสะสม กรุณาใช้ข้อมูลเพื่อตรวจสอบเบื้องต้นเท่านั้น
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          { icon: '🔴', label: 'ขาดข้อบกพร่อง',     sub: 'แต่ละวัน' },
          { icon: '✅', label: 'ยืนยันจัดส่ง',       sub: 'รายการ'  },
          { icon: '🔶', label: 'เสนอต้องสั่งซื้อ',   sub: 'รายการ'  },
          { icon: '🛒', label: 'จัดซื้อสำหรับวันนี้', sub: 'รายการ' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 26 }}>{c.icon}</span>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.1 }}>0</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</div>
              <div style={{ fontSize: 10, color: '#d1d5db' }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Line chart placeholder */}
      <Section title="📊 ช่วงเวลาที่สินค้าร้อนแรงที่สุด" empty />

      {['สถานที่สินค้าขาวรับแรงหนัก', 'ประเภทที่สินค้าร้อนแรงเข้า', 'บริษัทที่สินค้าร้อนแรงเข้า'].map(s => (
        <Section key={s} title={`📌 ${s}`} empty />
      ))}

      {/* Bar chart placeholder */}
      <Section title="📈 แนวโน้ม 14 วันย้อนหลัง (จำนวนมาตร)" empty />

      {/* Today comparison */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
          📋 ตามวันนี้ (สาร์ต) — เที่ยบกับพยากรณ์
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {['ประจำหน้าขาย', 'คำสั่งมาใหม่', 'สต็อก', 'คง เพิ่ม'].map((l, i) => (
            <div key={l} style={{ textAlign: 'center', padding: '14px 0', borderRight: i < 3 ? '1px solid #f5f5f5' : 'none' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a' }}>0</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, empty }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{title}</div>
      {empty && <div style={{ padding: '32px', textAlign: 'center', color: '#d1d5db', fontSize: 12 }}>ยังไม่มีข้อมูล</div>}
    </div>
  );
}

/* ─── InternalAudit > Audit ─────────────────────────────────────────────── */
function AuditTab() {
  const qc = useQueryClient();
  const [month, setMonth]       = useState(thisMonth());
  const [locationId, setLoc]    = useState('');
  const [itemCode, setItem]     = useState('');
  const [remark, setRemark]     = useState('');
  const [msg, setMsg]           = useState({ text: '', ok: false });

  const { data: locData } = useQuery({ queryKey: ['locations'], queryFn: warehouseApi.getLocations });
  const { data: auditData } = useQuery({ queryKey: ['audit', month], queryFn: () => warehouseApi.getAudit({ month }) });

  const locations = locData?.locations || [];
  const logs = auditData?.logs || [];
  const progress = locations.length ? Math.round((logs.length / locations.length) * 100) : 0;
  const monthDisplay = month ? new Date(month + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' }) : '';

  const save = useMutation({
    mutationFn: () => warehouseApi.addAudit({ locationId, skuCode: itemCode, beforeQty: 0, afterQty: 0, reason: remark }),
    onSuccess: res => {
      if (res.success) {
        setMsg({ text: 'บันทึกสำเร็จ', ok: true });
        setLoc(''); setItem(''); setRemark('');
        qc.invalidateQueries(['audit']);
      } else setMsg({ text: res.message || 'เกิดข้อผิดพลาด', ok: false });
    },
    onError: () => setMsg({ text: 'ไม่สามารถเชื่อมต่อ Server', ok: false }),
  });

  return (
    <div>
      {/* Month selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>ผลการตรวจ &gt; เลือกผลการตรวจ</span>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', fontSize: 12, outline: 'none' }}
        />
        {monthDisplay && <span style={{ fontSize: 12, color: '#9ca3af' }}>{monthDisplay}</span>}
      </div>

      {/* Progress */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
            📊 ความคืบหน้าตรวจสอบ เดือน {month} / เลือกข้อมูลตรวจ → {month}
          </span>
          <span style={{ fontSize: 12, background: '#CC0000', color: '#fff', padding: '2px 10px', borderRadius: 6 }}>
            {logs.length}/{locations.length} ({progress}%)
          </span>
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: 6, height: 8, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, background: '#CC0000', height: '100%', borderRadius: 6, transition: 'width .3s' }} />
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
          ตรวจสอบ {locations.length} LOCATION / แสดงจำนวน ({locations.length} กลุ่ม)
        </div>
      </div>

      {/* Form */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 14 }}>🔍 ตรวจสอบ Location / มีผู้ดูแล</div>

        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>LocationID * <span style={{ color: '#9ca3af' }}>(ค้นหา ID)</span></p>
          <input list="loc-options"
            placeholder="พิมพ์ LOCATIONID... / LOCATIONID ที่ไม่มีเจ้าหน้าที่"
            value={locationId} onChange={e => setLoc(e.target.value)}
            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
          <datalist id="loc-options">
            {locations.map(l => <option key={l.locationId} value={l.locationId} />)}
          </datalist>
        </div>

        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Itemcode * <span style={{ color: '#9ca3af' }}>(กรุณากรอก)</span></p>
          <input placeholder="เช่น S048-12-6088 / สแกน: S048-12-6088"
            value={itemCode} onChange={e => setItem(e.target.value)}
            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>หมายเหตุ <span style={{ color: '#9ca3af' }}>(ผลลัพธ์)</span></p>
          <input placeholder="ไม่พบสิ่ง / ผลที่ต้องการจะอยู่ในคั้น"
            value={remark} onChange={e => setRemark(e.target.value)}
            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {msg.text && (
          <div style={{ marginBottom: 10, background: msg.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: msg.ok ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
            {msg.ok && <CheckCircle size={14} />} {msg.text}
          </div>
        )}

        <button type="button"
          onClick={() => { setMsg({ text: '', ok: false }); save.mutate(); }}
          disabled={save.isPending || !locationId}
          style={{ width: '100%', padding: '14px', background: save.isPending || !locationId ? '#d1d5db' : '#CC0000', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: save.isPending || !locationId ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          ✓ บันทึกผลการตรวจ {save.isPending ? '...' : ''}
        </button>
      </div>

      {/* Results table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
          📋 ผลการตรวจเดือนนี้ (ล่าสุด Location) — {logs.length} รายการ
        </div>
        {logs.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#d1d5db', fontSize: 13 }}>ยังไม่มีข้อมูล</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['LocationID', 'ตำแหน่ง / TypeSKU', 'ItemCode', 'Type', 'สถ.', 'ผล/ตรวจ', ''].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', borderBottom: '1px solid #f0f0f0', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={l.auditId || i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{l.locationId}</td>
                    <td style={{ padding: '8px 14px', color: '#6b7280', fontSize: 12 }}>{l.location || '-'}</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 12, color: '#2563eb' }}>{l.skuCode || '-'}</td>
                    <td style={{ padding: '8px 14px', fontSize: 12 }}>{l.category || 'ชนิด'}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{ fontSize: 11, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 5, padding: '2px 7px' }}>ชนิด</span>
                    </td>
                    <td style={{ padding: '8px 14px', color: '#9ca3af', fontSize: 12 }}>{l.reason || '-'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Pill label="ตรวจ"  bg="#f0fdf4" color="#16a34a" border="#bbf7d0" />
                        <Pill label="สินค้า" bg="#eff6ff" color="#2563eb" border="#bfdbfe" />
                        <Pill label="ยกเลิก" bg="#fef2f2" color="#dc2626" border="#fecaca" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({ label, bg, color, border }) {
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', background: bg, color, border: `1px solid ${border}`, borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

/* ─── InternalAudit > Locations ─────────────────────────────────────────── */
function LocationsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['locations'], queryFn: warehouseApi.getLocations });
  const [form, setForm]       = useState({ zone: '', rack: '', shelf: '', description: '', maxWeightKg: '', status: 'ว่าง' });
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const upsert = useMutation({
    mutationFn: d => editing ? warehouseApi.updateLocation(d) : warehouseApi.addLocation(d),
    onSuccess: res => { if (res.success) { setShowForm(false); setEditing(null); qc.invalidateQueries(['locations']); } },
  });
  const del = useMutation({ mutationFn: warehouseApi.deleteLocation, onSuccess: () => qc.invalidateQueries(['locations']) });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const locations = data?.locations || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>📍 Locations ({locations.length})</span>
        <button type="button" onClick={() => { setForm({ zone: '', rack: '', shelf: '', description: '', maxWeightKg: '', status: 'ว่าง' }); setEditing(null); setShowForm(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#CC0000', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
          + เพิ่ม Location
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8, marginBottom: 12 }}>
            {[['zone','Zone'],['rack','Rack'],['shelf','Shelf'],['description','คำอธิบาย']].map(([k, p]) => (
              <input key={k} placeholder={p} value={form[k]} onChange={set(k)}
                style={{ border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 12px', fontSize: 13, outline: 'none' }}
              />
            ))}
            <input type="number" placeholder="น้ำหนักสูงสุด กก." value={form.maxWeightKg} onChange={set('maxWeightKg')}
              style={{ border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 12px', fontSize: 13, outline: 'none' }}
            />
            <select value={form.status} onChange={set('status')}
              style={{ border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 12px', fontSize: 13, outline: 'none' }}>
              {['ว่าง', 'ใช้งาน', 'เต็ม', 'ปิด'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => upsert.mutate({ ...form, locationId: editing })} disabled={upsert.isPending}
              style={{ background: '#CC0000', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>
              บันทึก
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
              style={{ background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Zone', 'Rack', 'Shelf', 'คำอธิบาย', 'น้ำหนักสูงสุด', 'สถานะ', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', borderBottom: '1px solid #f0f0f0', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#d1d5db', fontSize: 13 }}>ยังไม่มีข้อมูล</td></tr>
              ) : locations.map((l, i) => (
                <tr key={l.locationId} style={{ borderBottom: i < locations.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                  <td style={{ padding: '8px 14px', fontWeight: 600 }}>{l.zone}</td>
                  <td style={{ padding: '8px 14px' }}>{l.rack}</td>
                  <td style={{ padding: '8px 14px' }}>{l.shelf}</td>
                  <td style={{ padding: '8px 14px', color: '#9ca3af', fontSize: 12 }}>{l.description}</td>
                  <td style={{ padding: '8px 14px' }}>{l.maxWeightKg?.toLocaleString()} กก.</td>
                  <td style={{ padding: '8px 14px' }}>
                    <StatusBadge status={l.status} />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => { setForm({ ...l }); setEditing(l.locationId); setShowForm(true); }}
                        style={{ fontSize: 11, padding: '3px 8px', background: '#fff', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 5, cursor: 'pointer' }}>
                        แก้ไข
                      </button>
                      <button type="button" onClick={() => { if (confirm('ลบ Location นี้?')) del.mutate(l.locationId); }}
                        style={{ fontSize: 11, padding: '3px 8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Trash2 size={10} /> ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { 'ว่าง': ['#f0fdf4','#16a34a','#bbf7d0'], 'ใช้งาน': ['#eff6ff','#2563eb','#bfdbfe'], 'เต็ม': ['#fffbeb','#92400e','#fde68a'], 'ปิด': ['#f9fafb','#6b7280','#e5e7eb'] };
  const [bg, color, border] = map[status] || map['ว่าง'];
  return <span style={{ fontSize: 11, background: bg, color, border: `1px solid ${border}`, borderRadius: 5, padding: '2px 8px' }}>{status}</span>;
}

/* ─── InternalAudit > TypeSKU ──────────────────────────────────────────── */
function TypeSKUTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['skus'], queryFn: warehouseApi.getSkus });
  const [form, setForm]       = useState({ skuCode: '', skuName: '', category: '', unit: '', remark: '' });
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const upsert = useMutation({
    mutationFn: d => editing ? warehouseApi.updateSku(d) : warehouseApi.addSku(d),
    onSuccess: res => { if (res.success) { setShowForm(false); setEditing(null); qc.invalidateQueries(['skus']); } },
  });
  const del = useMutation({ mutationFn: warehouseApi.deleteSku, onSuccess: () => qc.invalidateQueries(['skus']) });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const skus = data?.skus || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>📦 TypeSKU ({skus.length})</span>
        <button type="button" onClick={() => { setForm({ skuCode: '', skuName: '', category: '', unit: '', remark: '' }); setEditing(null); setShowForm(true); }}
          style={{ background: '#CC0000', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
          + เพิ่ม SKU
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginBottom: 12 }}>
            {[['skuCode','รหัส SKU'],['skuName','ชื่อ SKU'],['category','หมวดหมู่'],['unit','หน่วย (ชิ้น/กก./ม้วน...)'],['remark','หมายเหตุ']].map(([k, p]) => (
              <input key={k} placeholder={p} value={form[k]} onChange={set(k)} disabled={k === 'skuCode' && !!editing}
                style={{ border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 12px', fontSize: 13, outline: 'none', background: k === 'skuCode' && editing ? '#f9fafb' : '#fff' }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => upsert.mutate({ ...form, skuCode: editing || form.skuCode })} disabled={upsert.isPending}
              style={{ background: '#CC0000', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>
              บันทึก
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
              style={{ background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['รหัส SKU', 'ชื่อ', 'หมวดหมู่', 'หน่วย', 'หมายเหตุ', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', borderBottom: '1px solid #f0f0f0', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skus.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#d1d5db', fontSize: 13 }}>ยังไม่มีข้อมูล</td></tr>
              ) : skus.map((s, i) => (
                <tr key={s.skuCode} style={{ borderBottom: i < skus.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                  <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>{s.skuCode}</td>
                  <td style={{ padding: '8px 14px' }}>{s.skuName}</td>
                  <td style={{ padding: '8px 14px', color: '#6b7280' }}>{s.category}</td>
                  <td style={{ padding: '8px 14px' }}>{s.unit}</td>
                  <td style={{ padding: '8px 14px', color: '#9ca3af', fontSize: 12 }}>{s.remark}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => { setForm({ ...s }); setEditing(s.skuCode); setShowForm(true); }}
                        style={{ fontSize: 11, padding: '3px 8px', background: '#fff', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 5, cursor: 'pointer' }}>
                        แก้ไข
                      </button>
                      <button type="button" onClick={() => { if (confirm('ลบ SKU นี้?')) del.mutate(s.skuCode); }}
                        style={{ fontSize: 11, padding: '3px 8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Trash2 size={10} /> ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── InternalAudit > Report ────────────────────────────────────────────── */
function ReportTab() {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '60px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
      <div style={{ fontSize: 14, color: '#9ca3af' }}>Report ยังไม่พร้อมใช้งาน</div>
    </div>
  );
}

/* ─── Transfer > Monitor ────────────────────────────────────────────────── */
function TransferMonitor() {
  const [date, setDate] = useState(todayStr());
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory', date],
    queryFn: () => warehouseApi.getInventory({ date }),
  });
  const items = data?.inventory || [];

  const LEGEND = [
    { label: 'Unit',          bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
    { label: 'ไม่ถึง STD',   bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
    { label: 'เกิน STD',     bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    { label: 'งานที่ยังไม่ได้', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  ];

  return (
    <div>
      {/* Controls */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ border: '1px solid #e5e7eb', borderRadius: 7, padding: '6px 12px', fontSize: 13, outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {LEGEND.map(p => (
              <span key={p.label} style={{ fontSize: 11, background: p.bg, color: p.color, border: `1px solid ${p.border}`, borderRadius: 5, padding: '3px 9px' }}>
                {p.label}
              </span>
            ))}
          </div>
          <button type="button" onClick={() => refetch()}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
            <RefreshCw size={12} /> โหลดใหม่
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Monitor', 'งาน', 'หมายเลข', 'สั่งค้า', 'รอบสน / แจ้งมา'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid #f0f0f0', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>กำลังโหลด...</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '60px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 8, color: '#d1d5db' }}>✓</div>
                    <div style={{ fontSize: 13, color: '#bbb' }}>ไม่มีข้อมูลในวันที่นี้</div>
                  </td>
                </tr>
              ) : items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '8px 16px', fontFamily: 'monospace' }}>{item.skuCode}</td>
                  <td style={{ padding: '8px 16px' }}>{item.quantity}</td>
                  <td style={{ padding: '8px 16px' }}>{item.locationId}</td>
                  <td style={{ padding: '8px 16px' }}>{item.unit}</td>
                  <td style={{ padding: '8px 16px', color: '#9ca3af', fontSize: 11 }}>{item.updatedAt?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Transfer other sub-tabs placeholder ───────────────────────────────── */
function PlaceholderTab({ label }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '60px', textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🚧</div>
      <div style={{ fontSize: 14, color: '#9ca3af' }}>{label} ยังไม่พร้อมใช้งาน</div>
    </div>
  );
}
