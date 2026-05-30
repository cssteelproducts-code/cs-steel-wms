import { useState, useEffect, useRef } from 'react';
import { ScanLine, MapPin, CheckCircle2, XCircle, RotateCcw, History } from 'lucide-react';
import toast from 'react-hot-toast';

const SKU_TYPES = ['ขายดี', 'ขายน้อยต่อเนื่อง', 'ขายน้อยไม่ต่อเนื่อง'];

export default function LocationCheck() {
  const [locationCode, setLocationCode] = useState('');
  const [locationInfo, setLocationInfo] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [todayLog, setTodayLog] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    loadTodayLog();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const loadTodayLog = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/location-check/today', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setTodayLog(data.data);
    } catch {}
  };

  const handleSearch = async () => {
    const code = locationCode.trim();
    if (!code) return;
    setSearching(true);
    setLocationInfo(null);
    setResult(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/location-check/lookup?code=${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLocationInfo(data.data);
      } else {
        toast.error(data.message);
        setLocationCode('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
    setSearching(false);
  };

  const handleSKUSelect = async (skuType) => {
    if (!locationInfo || saving) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/location-check/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locationCode: locationInfo.LocationCode, actualSKUType: skuType })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        loadTodayLog();
        setTimeout(() => {
          setResult(null);
          setLocationInfo(null);
          setLocationCode('');
          setTimeout(() => inputRef.current?.focus(), 50);
        }, 2500);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
    setSaving(false);
  };

  const handleReset = () => {
    setResult(null);
    setLocationInfo(null);
    setLocationCode('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const matchCount = todayLog.filter(i => i.IsMatch).length;
  const mismatchCount = todayLog.filter(i => !i.IsMatch).length;

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-6">

      {/* Scan input */}
      <div className="rounded-2xl p-5" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2 mb-4">
          <ScanLine size={18} style={{ color: '#dc2626' }} />
          <span className="font-semibold text-base" style={{ color: '#f1f5f9' }}>สแกน / พิมพ์รหัส Location</span>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={locationCode}
            onChange={e => setLocationCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="เช่น PDC-003-006"
            autoComplete="off"
            className="flex-1 text-lg font-mono rounded-xl px-4 py-3"
            style={{
              background: '#0f172a',
              border: '2px solid rgba(255,255,255,0.1)',
              color: '#f1f5f9',
              outline: 'none',
              letterSpacing: '0.05em',
              fontSize: '1.1rem'
            }}
          />
          <button
            onClick={handleSearch}
            disabled={searching || !locationCode.trim()}
            className="px-5 rounded-xl font-semibold transition-all"
            style={{
              background: locationCode.trim() ? '#dc2626' : '#374151',
              color: '#fff',
              border: 'none',
              cursor: locationCode.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              minWidth: 72
            }}>
            {searching ? '...' : 'ค้นหา'}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: '#475569' }}>
          พิมพ์รหัสจากป้ายสินค้า แล้วกด Enter หรือใช้ Barcode Scanner
        </p>
      </div>

      {/* Location info + SKU selection */}
      {locationInfo && !result && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-start gap-3 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="p-2 rounded-lg flex-shrink-0" style={{ background: 'rgba(220,38,38,0.15)' }}>
              <MapPin size={18} style={{ color: '#dc2626' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xl font-bold" style={{ color: '#f1f5f9' }}>
                {locationInfo.LocationCode}
              </div>
              {locationInfo.LocationName && (
                <div className="text-sm" style={{ color: '#94a3b8' }}>{locationInfo.LocationName}</div>
              )}
              {locationInfo.LocationTypeName && (
                <div className="text-sm" style={{ color: '#94a3b8' }}>
                  ประเภท Location: <span style={{ color: '#e2e8f0' }}>{locationInfo.LocationTypeName}</span>
                </div>
              )}
              {locationInfo.AllowedSKUType ? (
                <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
                  Expected TypeSKU: {locationInfo.AllowedSKUType}
                </div>
              ) : (
                <div className="mt-1.5 text-xs" style={{ color: '#64748b' }}>ยังไม่กำหนด Expected TypeSKU</div>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-3" style={{ color: '#94a3b8' }}>
              สินค้าที่เห็นจริงเป็น TypeSKU ใด?
            </p>
            <div className="flex flex-col gap-3">
              {SKU_TYPES.map(sku => {
                const isExpected = locationInfo.AllowedSKUType === sku;
                return (
                  <button
                    key={sku}
                    onClick={() => handleSKUSelect(sku)}
                    disabled={saving}
                    style={{
                      width: '100%',
                      minHeight: 60,
                      borderRadius: 14,
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: saving ? 'wait' : 'pointer',
                      background: isExpected ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.06)',
                      border: isExpected ? '2px solid #10b981' : '2px solid rgba(255,255,255,0.1)',
                      color: isExpected ? '#6ee7b7' : '#e2e8f0',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                  >
                    {sku}
                    {isExpected && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.75 }}>(ตรงตามที่คาดไว้)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={handleReset} className="flex items-center gap-1.5 text-sm mx-auto"
            style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>
            <RotateCcw size={13} />
            ยกเลิก / สแกนใหม่
          </button>
        </div>
      )}

      {/* Result flash */}
      {result && (
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            background: result.isMatch ? 'rgba(16,185,129,0.12)' : 'rgba(220,38,38,0.12)',
            border: `2px solid ${result.isMatch ? '#10b981' : '#dc2626'}`
          }}
        >
          <div className="flex justify-center mb-3">
            {result.isMatch
              ? <CheckCircle2 size={60} style={{ color: '#10b981' }} />
              : <XCircle size={60} style={{ color: '#dc2626' }} />
            }
          </div>
          <div className="text-2xl font-bold mb-1"
            style={{ color: result.isMatch ? '#6ee7b7' : '#fca5a5' }}>
            {result.isMatch ? 'ตรงตามประเภท ✓' : 'ไม่ตรงตามประเภท ✗'}
          </div>
          <div className="text-sm mt-1" style={{ color: '#94a3b8' }}>
            {result.locationCode} &bull; {result.actualSKUType}
          </div>
          {!result.isMatch && result.expectedSKUType && (
            <div className="text-sm mt-1" style={{ color: '#94a3b8' }}>
              ควรเป็น: <span style={{ color: '#fbbf24' }}>{result.expectedSKUType}</span>
            </div>
          )}
          <p className="text-xs mt-4" style={{ color: '#475569' }}>
            กำลังล้างข้อมูลเพื่อสแกน Location ต่อไป...
          </p>
        </div>
      )}

      {/* Today's log */}
      {todayLog.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <History size={15} style={{ color: '#64748b' }} />
              <span className="text-sm font-semibold" style={{ color: '#94a3b8' }}>
                รายการวันนี้ ({todayLog.length} location)
              </span>
            </div>
            <div className="flex gap-3 text-xs font-semibold">
              <span style={{ color: '#6ee7b7' }}>✓ {matchCount}</span>
              <span style={{ color: '#fca5a5' }}>✗ {mismatchCount}</span>
            </div>
          </div>
          <div>
            {todayLog.map(item => (
              <div key={item.ItemID}
                className="px-4 py-3 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex-shrink-0">
                  {item.IsMatch
                    ? <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                    : <XCircle size={18} style={{ color: '#dc2626' }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-medium" style={{ color: '#e2e8f0' }}>
                    {item.LocationCode}
                  </div>
                  <div className="text-xs truncate" style={{ color: '#64748b' }}>
                    {item.ActualSKUType || '-'}
                    {!item.IsMatch && item.ExpectedSKUType && (
                      <span style={{ color: '#f59e0b' }}> (ควรเป็น: {item.ExpectedSKUType})</span>
                    )}
                  </div>
                </div>
                <div className="text-xs flex-shrink-0" style={{ color: '#475569' }}>
                  {item.LocationTypeName || ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
