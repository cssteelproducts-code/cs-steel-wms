import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trucksApi } from '../api';
import { ArrowLeft, Search, MapPin, Clock, Plus, CheckCircle } from 'lucide-react';

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/* station card */
function StationCard({ station, stationNum, truckId, onUpdated }) {
  const qc = useQueryClient();
  const [entryTime, setEntryTime] = useState(station.entryTime || '');
  const [exitTime,  setExitTime]  = useState(station.exitTime  || '');

  const saveEntry = useMutation({
    mutationFn: () => trucksApi.datastation({ truckId, stationId: station.stationId, entryTime: entryTime || nowTime() }),
    onSuccess: (res) => { if (res.success) { qc.invalidateQueries(['trucks']); onUpdated?.(); } },
  });
  const saveExit = useMutation({
    mutationFn: () => trucksApi.stationExit({ truckId, stationId: station.stationId, exitTime: exitTime || nowTime() }),
    onSuccess: (res) => { if (res.success) { qc.invalidateQueries(['trucks']); onUpdated?.(); } },
  });

  const hasEntry = !!station.entryTime;
  const hasExit  = !!station.exitTime;

  return (
    <div style={{ border:'1px solid #f0d0d0', borderRadius:12, overflow:'hidden', background:'#fff' }}>
      {/* station number */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 18px', borderBottom:'1px solid #f0d0d0' }}>
        <MapPin size={15} color="#CC0000" fill="#CC0000"/>
        <span style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>{stationNum}</span>
        {hasEntry && hasExit && (
          <span style={{ marginLeft:'auto', fontSize:11, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:6, padding:'2px 10px' }}>เสร็จสิ้น</span>
        )}
        {hasEntry && !hasExit && (
          <span style={{ marginLeft:'auto', fontSize:11, background:'#fff0f0', color:'#CC0000', border:'1px solid #f0d0d0', borderRadius:6, padding:'2px 10px' }}>กำลังขึ้นสินค้า</span>
        )}
      </div>

      <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:14 }}>
        {/* Entry time */}
        <div>
          <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>
            เวลาเข้า <span style={{ fontSize:11, color:'#b09898' }}>ဝင်ချိန်မှတ်တမ်း</span>
          </div>
          {hasEntry ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:15, fontWeight:700, color:'#16a34a' }}>
              <CheckCircle size={16}/> {station.entryTime}
            </div>
          ) : (
            <button
              onClick={() => saveEntry.mutate()}
              disabled={saveEntry.isPending}
              style={{ width:'100%', padding:'14px', background:'#CC0000', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Clock size={15}/> บันทึกเวลาเข้า
              </div>
              <div style={{ fontSize:11, fontWeight:400, opacity:.8 }}>ဝင်ချိန်မှတ်တမ်း</div>
            </button>
          )}
        </div>

        {/* Exit time */}
        <div>
          <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>
            เวลาออก <span style={{ fontSize:11, color:'#b09898' }}>ထွက်ချိန်မှတ်တမ်း</span>
          </div>
          {hasExit ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:15, fontWeight:700, color:'#16a34a' }}>
              <CheckCircle size={16}/> {station.exitTime}
            </div>
          ) : hasEntry ? (
            <button
              onClick={() => saveExit.mutate()}
              disabled={saveExit.isPending}
              style={{ width:'100%', padding:'14px', background:'#fff', color:'#CC0000', border:'2px solid #CC0000', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Clock size={15}/> บันทึกเวลาออก
              </div>
              <div style={{ fontSize:11, fontWeight:400, opacity:.7 }}>ထွက်ချိန်မှတ်တမ်း</div>
            </button>
          ) : (
            <div style={{ background:'#fafafa', border:'1px solid #f0d0d0', borderRadius:10, padding:'14px', textAlign:'center' }}>
              <p style={{ fontSize:13, color:'#bbb' }}>รอบันทึกเวลาเข้าก่อน</p>
              <p style={{ fontSize:11, color:'#ddd' }}>ဝင်ချိန်မှတ်တမ်းမပြုမီ</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DataStation() {
  const nav = useNavigate();
  const qc  = useQueryClient();
  const [search, setSearch]   = useState('');
  const [searched, setSearched] = useState('');
  const [stations, setStations] = useState([{ stationId: Date.now(), entryTime:'', exitTime:'' }]);

  const { data } = useQuery({ queryKey:['trucks'], queryFn: trucksApi.getAll });

  const allTrucks = data?.trucks || [];
  const found = searched
    ? allTrucks.find(t => t.licensePlate?.toLowerCase() === searched.toLowerCase() || t.licensePlate?.toLowerCase().includes(searched.toLowerCase()))
    : null;

  function addStation() {
    setStations(s => [...s, { stationId: Date.now(), entryTime:'', exitTime:'' }]);
  }

  function doSearch() { setSearched(search); setStations([{ stationId: Date.now(), entryTime:'', exitTime:'' }]); }

  return (
    <div style={{ minHeight:'100%', background:'#fff', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'16px 24px', borderBottom:'1px solid #f0d0d0' }}>
        <button type="button" onClick={() => nav(-1)} style={{ background:'none', border:'none', cursor:'pointer', color:'#CC0000', display:'flex', padding:4, marginTop:2 }}>
          <ArrowLeft size={20}/>
        </button>
        <div>
          <h2 style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', lineHeight:1.3 }}>🏗️ สถานีขึ้นสินค้า</h2>
          <p style={{ fontSize:11, color:'#b09898' }}>ကုန်တင်ဂေဟာကောင်တာ</p>
        </div>
      </div>

      <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:20, maxWidth:720 }}>

        {/* Search */}
        <div>
          <p style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:4 }}>
            ทะเบียนรถ <span style={{ fontSize:11, color:'#b09898', fontWeight:400 }}>ကားဆိုင်ရာနံပါတ်</span>
          </p>
          <div style={{ display:'flex', gap:0, borderRadius:10, overflow:'hidden', border:'1px solid #f0d0d0' }}>
            <input
              placeholder="ค้นหาทะเบียนรถ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              style={{ flex:1, border:'none', borderRadius:0, fontSize:14, padding:'11px 16px', outline:'none' }}
            />
            <button
              type="button"
              onClick={doSearch}
              style={{ background:'#CC0000', border:'none', padding:'0 18px', cursor:'pointer', display:'flex', alignItems:'center' }}
            >
              <Search size={18} color="#fff"/>
            </button>
          </div>
        </div>

        {/* Truck card */}
        {searched && !found && (
          <div style={{ textAlign:'center', padding:'32px', color:'#bbb', fontSize:14 }}>
            ไม่พบทะเบียนรถ "{searched}"
          </div>
        )}

        {found && (
          <>
            {/* Truck info */}
            <div style={{ border:'1px solid #f0d0d0', borderRadius:12, padding:'16px 18px', background:'#fff' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#1a1a1a', marginBottom:4 }}>{found.licensePlate}</div>
                  <div style={{ fontSize:12, color:'#888' }}>
                    {[found.transport, found.vehicleType, found.warehouse].filter(Boolean).join(' · ')}
                  </div>
                  {found.arname && <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{found.arname}</div>}
                </div>
                <span style={{ fontSize:12, background:'#e0fdf4', color:'#059669', border:'1px solid #a7f3d0', borderRadius:20, padding:'4px 12px', whiteSpace:'nowrap', flexShrink:0 }}>
                  {found.status || 'กำลังขึ้นสินค้า'}
                </span>
              </div>
            </div>

            {/* Station cards */}
            {stations.map((st, i) => (
              <StationCard
                key={st.stationId}
                station={st}
                stationNum={i + 1}
                truckId={found.truckId}
                onUpdated={() => qc.invalidateQueries(['trucks'])}
              />
            ))}

            {/* Add station */}
            <div style={{ display:'flex', justifyContent:'center' }}>
              <button
                type="button"
                onClick={addStation}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'14px 36px', background:'#fff', border:'2px solid #CC0000', borderRadius:12, cursor:'pointer', color:'#CC0000' }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:14, fontWeight:700 }}>
                  <Plus size={16}/> เพิ่มสถานี
                </div>
                <div style={{ fontSize:10, color:'#b09898' }}>ဂေဟာအသစ်ထည့်မည်</div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
