import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trucksApi } from '../api';
import { ArrowLeft, Search, MapPin, Clock, Plus, CheckCircle, Network } from 'lucide-react';

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function StationCard({ station, index, truckId, onRefresh }) {
  const hasEntry = !!(station.EntryTime || '').toString().trim();
  const hasExit  = !!(station.ExitTime  || '').toString().trim();

  const entryMut = useMutation({
    mutationFn: () => trucksApi.recordEntry(station.ID),
    onSuccess: (res) => { if (res.success) onRefresh(); },
  });
  const exitMut = useMutation({
    mutationFn: () => trucksApi.recordExitById(station.ID),
    onSuccess: (res) => { if (res.success) onRefresh(); },
  });

  return (
    <div style={{ border:'1px solid #f0d0d0', borderRadius:12, overflow:'hidden', background:'#fff' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', background:'#fafafa', borderBottom:'1px solid #f0d0d0' }}>
        <MapPin size={14} color="#CC0000" fill="#CC0000"/>
        <span style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', flex:1 }}>
          {(station.StationName || '').toString().trim() || `สถานีที่ ${index + 1}`}
        </span>
        {hasEntry && hasExit && (
          <span style={{ fontSize:11, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:6, padding:'2px 10px' }}>เสร็จสิ้น</span>
        )}
        {hasEntry && !hasExit && (
          <span style={{ fontSize:11, background:'#fff0f0', color:'#CC0000', border:'1px solid #f0d0d0', borderRadius:6, padding:'2px 10px' }}>กำลังขึ้นสินค้า</span>
        )}
        {station.DurationMinutes != null && hasExit && (
          <span style={{ fontSize:11, color:'#888', marginLeft:4 }}>{station.DurationMinutes} นาที</span>
        )}
      </div>

      <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
        {/* Entry */}
        <div>
          <div style={{ fontSize:11, color:'#9ca3af', marginBottom:6 }}>เวลาเข้า</div>
          {hasEntry ? (
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:15, fontWeight:700, color:'#16a34a' }}>
              <CheckCircle size={15}/> {(station.EntryTime || '').toString()}
            </div>
          ) : (
            <button
              onClick={() => entryMut.mutate()}
              disabled={entryMut.isPending}
              style={{ width:'100%', padding:'12px', background: entryMut.isPending ? '#999':'#CC0000', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
            >
              <Clock size={14}/> {entryMut.isPending ? 'กำลังบันทึก...' : 'บันทึกเวลาเข้า'}
            </button>
          )}
        </div>

        {/* Exit */}
        <div>
          <div style={{ fontSize:11, color:'#9ca3af', marginBottom:6 }}>เวลาออก</div>
          {hasExit ? (
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:15, fontWeight:700, color:'#16a34a' }}>
              <CheckCircle size={15}/> {(station.ExitTime || '').toString()}
            </div>
          ) : hasEntry ? (
            <button
              onClick={() => exitMut.mutate()}
              disabled={exitMut.isPending}
              style={{ width:'100%', padding:'12px', background:'#fff', color:'#CC0000', border:'2px solid #CC0000', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
            >
              <Clock size={14}/> {exitMut.isPending ? 'กำลังบันทึก...' : 'บันทึกเวลาออก'}
            </button>
          ) : (
            <div style={{ background:'#fafafa', border:'1px solid #f0d0d0', borderRadius:10, padding:'12px', textAlign:'center', color:'#bbb', fontSize:13 }}>
              รอบันทึกเวลาเข้าก่อน
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
  const [search,   setSearch]   = useState('');
  const [searched, setSearched] = useState('');
  const [truck,    setTruck]    = useState(null);
  const [notFound, setNotFound] = useState(false);

  const { data: stationsData, refetch: refetchStations } = useQuery({
    queryKey: ['stations', truck?.id],
    queryFn:  () => trucksApi.getStations(truck.id),
    enabled:  !!truck?.id,
  });
  const stations = stationsData?.stations || [];

  const searchMut = useMutation({
    mutationFn: (q) => trucksApi.search(q),
    onSuccess: (res) => {
      const list = res.trucks || [];
      const match = list.find(t =>
        t.licensePlate?.toLowerCase() === searched.toLowerCase() ||
        t.licensePlate?.toLowerCase().includes(searched.toLowerCase())
      );
      if (match) { setTruck(match); setNotFound(false); }
      else { setTruck(null); setNotFound(true); }
    },
  });

  const addMut = useMutation({
    mutationFn: () => trucksApi.addStation({ truckId: truck.id, stationName: `สถานีที่ ${stations.length + 1}` }),
    onSuccess: (res) => { if (res.success) refetchStations(); },
  });

  function doSearch() {
    if (!search.trim()) return;
    setSearched(search.trim());
    setTruck(null);
    setNotFound(false);
    searchMut.mutate(search.trim());
  }

  return (
    <div style={{ minHeight:'100%', background:'#fff', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 20px', borderBottom:'1px solid #f0d0d0' }}>
        <button type="button" onClick={() => nav(-1)} style={{ background:'none', border:'none', cursor:'pointer', color:'#CC0000', display:'flex', padding:4, marginTop:2 }}>
          <ArrowLeft size={20}/>
        </button>
        <div>
          <h2 style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', lineHeight:1.3 }}>สถานีขึ้นสินค้า</h2>
          <p style={{ fontSize:11, color:'#888' }}>บันทึกเวลาเข้า-ออก แต่ละสถานี</p>
        </div>
      </div>

      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:16, maxWidth:640 }}>

        {/* Search */}
        <div>
          <p style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>ทะเบียนรถ</p>
          <div style={{ display:'flex', gap:0, borderRadius:10, overflow:'hidden', border:'1px solid #f0d0d0' }}>
            <input
              placeholder="พิมพ์ทะเบียนรถ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              style={{ flex:1, border:'none', fontSize:14, padding:'10px 14px', outline:'none' }}
            />
            <button
              type="button"
              onClick={doSearch}
              disabled={searchMut.isPending}
              style={{ background:'#CC0000', border:'none', padding:'0 16px', cursor:'pointer', display:'flex', alignItems:'center' }}
            >
              <Search size={17} color="#fff"/>
            </button>
          </div>
        </div>

        {/* Not found */}
        {notFound && !searchMut.isPending && (
          <div style={{ textAlign:'center', padding:'24px', color:'#bbb', fontSize:14 }}>
            ไม่พบทะเบียนรถ "{searched}"
          </div>
        )}

        {/* Loading */}
        {searchMut.isPending && (
          <div style={{ textAlign:'center', padding:'24px', color:'#888', fontSize:14 }}>กำลังค้นหา...</div>
        )}

        {/* Truck found */}
        {truck && (
          <>
            {/* Truck info */}
            <div style={{ border:'1px solid #f0d0d0', borderRadius:12, padding:'14px 16px', background:'#fff' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#1a1a1a', marginBottom:2 }}>{truck.licensePlate}</div>
                  <div style={{ fontSize:12, color:'#888' }}>
                    {[truck.transport, truck.vehicleType, truck.warehouse].filter(Boolean).join(' · ')}
                  </div>
                  {truck.arname && <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{truck.arname}</div>}
                </div>
                <span style={{ fontSize:11, background:'#fff0f0', color:'#CC0000', border:'1px solid #f0d0d0', borderRadius:20, padding:'3px 12px', whiteSpace:'nowrap', flexShrink:0 }}>
                  {truck.status || 'กำลังดำเนินการ'}
                </span>
              </div>
            </div>

            {/* Stations */}
            {stations.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px', gap:10, border:'1px dashed #f0d0d0', borderRadius:12 }}>
                <Network size={40} color="#e0c0c0" strokeWidth={1}/>
                <p style={{ fontSize:13, color:'#9ca3af' }}>ยังไม่มีสถานี กด "+" เพื่อเพิ่ม</p>
              </div>
            ) : (
              stations.map((st, i) => (
                <StationCard
                  key={(st.ID || '').toString()}
                  station={st}
                  index={i}
                  truckId={truck.id}
                  onRefresh={() => refetchStations()}
                />
              ))
            )}

            {/* Add station */}
            <div style={{ display:'flex', justifyContent:'center' }}>
              <button
                type="button"
                onClick={() => addMut.mutate()}
                disabled={addMut.isPending}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'11px 28px', background:'#fff', border:'2px solid #CC0000', borderRadius:12, cursor:'pointer', color:'#CC0000', fontSize:14, fontWeight:700 }}
              >
                <Plus size={15}/> {addMut.isPending ? 'กำลังเพิ่ม...' : 'เพิ่มสถานี'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
