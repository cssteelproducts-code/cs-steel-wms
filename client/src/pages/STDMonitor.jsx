import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

export default function STDMonitor() {
  const nav = useNavigate();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['stdmonitor'],
    queryFn: dashboardApi.getSTDMonitor,
    refetchInterval: 60_000,
  });

  const items = data?.items || [];
  const overCount  = items.filter(t => t.overSTD).length;
  const okCount    = items.length - overCount;

  return (
    <div style={{ minHeight:'100%', background:'#fff', fontFamily:"'Noto Sans Thai','Noto Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'16px 24px', borderBottom:'1px solid #f0d0d0' }}>
        <button type="button" onClick={() => nav(-1)} style={{ background:'none', border:'none', cursor:'pointer', color:'#CC0000', display:'flex', padding:4, marginTop:2 }}>
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', lineHeight:1.3 }}>⏱️ ติดตาม STD รถ</h2>
          <p style={{ fontSize:11, color:'#b09898' }}>စံချိန်ကျော်မကျော် စစ်ဆေးမည်</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          style={{ background:'none', border:'1px solid #f0d0d0', borderRadius:8, padding:'6px 10px', cursor:'pointer', color:'#CC0000', display:'flex', alignItems:'center', gap:4, fontSize:12 }}
        >
          <RefreshCw size={13} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }}/> รีเฟรช
        </button>
      </div>

      <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16, maxWidth:960 }}>

        {/* Summary pills */}
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 16px' }}>
            <AlertTriangle size={16} color="#dc2626"/>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#dc2626', lineHeight:1 }}>{overCount}</div>
              <div style={{ fontSize:11, color:'#888' }}>เกิน STD</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'10px 16px' }}>
            <CheckCircle size={16} color="#16a34a"/>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#16a34a', lineHeight:1 }}>{okCount}</div>
              <div style={{ fontSize:11, color:'#888' }}>ปกติ</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff0f0', border:'1px solid #f0d0d0', borderRadius:10, padding:'10px 16px' }}>
            <Clock size={16} color="#CC0000"/>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#CC0000', lineHeight:1 }}>{items.length}</div>
              <div style={{ fontSize:11, color:'#888' }}>รวมทั้งหมด</div>
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ textAlign:'center', padding:'48px', color:'#bbb', fontSize:14 }}>กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px', color:'#bbb', fontSize:14 }}>
            <Clock size={48} color="#e5e7eb" strokeWidth={1} style={{ display:'block', margin:'0 auto 12px' }}/>
            ไม่มีรถในระบบขณะนี้
          </div>
        ) : (
          <div style={{ border:'1px solid #f0d0d0', borderRadius:12, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#fff0f0' }}>
                    {['ทะเบียน','ประเภทรถ','ขนส่ง','เวลาเข้า','เวลาผ่านมา','STD (นาที)','สถานะ'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', borderBottom:'1px solid #f0d0d0', fontWeight:700, color:'#374151', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((t, i) => (
                    <tr
                      key={t.truckId || t.id || i}
                      style={{
                        borderBottom: i < items.length-1 ? '1px solid #f5e0e0' : 'none',
                        background: t.overSTD ? '#fff5f5' : '#fff',
                      }}
                    >
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#1a1a1a' }}>{t.licensePlate}</td>
                      <td style={{ padding:'10px 14px', color:'#374151' }}>{t.vehicleType}</td>
                      <td style={{ padding:'10px 14px', color:'#6b7280' }}>{t.transport || '-'}</td>
                      <td style={{ padding:'10px 14px', color:'#6b7280' }}>{t.checkinTime}</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color: t.overSTD ? '#dc2626' : '#374151' }}>
                        {t.elapsedMinutes} นาที
                      </td>
                      <td style={{ padding:'10px 14px', color:'#6b7280' }}>{t.stdMinutes}</td>
                      <td style={{ padding:'10px 14px' }}>
                        {t.overSTD ? (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, padding:'3px 10px', fontSize:12, fontWeight:600 }}>
                            <AlertTriangle size={11}/> เกิน STD
                          </span>
                        ) : (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:6, padding:'3px 10px', fontSize:12 }}>
                            <CheckCircle size={11}/> ปกติ
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p style={{ fontSize:11, color:'#bbb', textAlign:'center' }}>รีเฟรชอัตโนมัติทุก 1 นาที</p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
