import { useState, useEffect, useRef } from 'react';
import { ScanLine, MapPin, CheckCircle2, XCircle, RotateCcw, History, Search, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function LocationCheck() {
  const [locationCode, setLocationCode] = useState('');
  const [locationInfo, setLocationInfo] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [todayLog, setTodayLog] = useState([]);

  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearching, setProductSearching] = useState(false);

  const locationInputRef = useRef(null);
  const productInputRef = useRef(null);

  useEffect(() => {
    loadTodayLog();
    setTimeout(() => locationInputRef.current?.focus(), 100);
  }, []);

  // debounced product search
  useEffect(() => {
    if (productQuery.trim().length < 2) { setProductResults([]); return; }
    const timer = setTimeout(async () => {
      setProductSearching(true);
      try {
        const res = await api.get(`/location-check/products/search?q=${encodeURIComponent(productQuery.trim())}`);
        if (res.data.success) setProductResults(res.data.data);
      } catch {}
      setProductSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [productQuery]);

  const loadTodayLog = async () => {
    try {
      const res = await api.get('/location-check/today');
      if (res.data.success) setTodayLog(res.data.data);
    } catch {}
  };

  const handleSearch = async () => {
    const code = locationCode.trim();
    if (!code) return;
    setSearching(true);
    setLocationInfo(null);
    setResult(null);
    setProductQuery('');
    setProductResults([]);
    try {
      const res = await api.get(`/location-check/lookup?code=${encodeURIComponent(code)}`);
      if (res.data.success) {
        setLocationInfo(res.data.data);
        setTimeout(() => productInputRef.current?.focus(), 100);
      } else {
        toast.error(res.data.message);
        setLocationCode('');
        setTimeout(() => locationInputRef.current?.focus(), 50);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'ไม่พบ Location นี้ในระบบ');
      setLocationCode('');
      setTimeout(() => locationInputRef.current?.focus(), 50);
    }
    setSearching(false);
  };

  const handleProductSelect = async (product) => {
    if (!locationInfo || saving) return;
    setSaving(true);
    try {
      const res = await api.post('/location-check/quick', {
        locationCode: locationInfo.LocationCode,
        actualSKUType: product.SKUType,
        productCode: product.ProductCode,
        productFoundName: product.ProductName
      });
      if (res.data.success) {
        setResult(res.data);
        loadTodayLog();
        setTimeout(() => {
          setResult(null);
          setLocationInfo(null);
          setLocationCode('');
          setProductQuery('');
          setProductResults([]);
          setTimeout(() => locationInputRef.current?.focus(), 50);
        }, 2500);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึก');
    }
    setSaving(false);
  };

  const handleReset = () => {
    setResult(null);
    setLocationInfo(null);
    setLocationCode('');
    setProductQuery('');
    setProductResults([]);
    setTimeout(() => locationInputRef.current?.focus(), 50);
  };

  const matchCount = todayLog.filter(i => i.IsMatch).length;
  const mismatchCount = todayLog.filter(i => !i.IsMatch).length;

  const skuColor = (sku) => {
    if (!sku) return '#64748b';
    if (sku === 'ขายดี') return '#10b981';
    if (sku.includes('ต่อเนื่อง') && !sku.includes('ไม่')) return '#f59e0b';
    if (sku.includes('ไม่ต่อเนื่อง')) return '#ef4444';
    return '#94a3b8';
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-6">

      {/* Scan location input */}
      <div className="rounded-2xl p-5" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2 mb-4">
          <ScanLine size={18} style={{ color: '#dc2626' }} />
          <span className="font-semibold text-base" style={{ color: '#f1f5f9' }}>สแกน / พิมพ์รหัส Location</span>
        </div>
        <div className="flex gap-2">
          <input
            ref={locationInputRef}
            type="text"
            value={locationCode}
            onChange={e => setLocationCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="เช่น 02-01-02"
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
      </div>

      {/* Location info + product search */}
      {locationInfo && !result && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Location header */}
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
                  ประเภท: <span style={{ color: '#e2e8f0' }}>{locationInfo.LocationTypeName}</span>
                </div>
              )}
              {locationInfo.AllowedSKUType ? (
                <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
                  ควรเป็น: {locationInfo.AllowedSKUType}
                </div>
              ) : (
                <div className="mt-1.5 text-xs" style={{ color: '#64748b' }}>ยังไม่กำหนด Expected TypeSKU</div>
              )}
            </div>
          </div>

          {/* Product search */}
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: '#94a3b8' }}>
              ค้นหาสินค้าที่วางอยู่ในช่องนี้
            </p>
            <div className="relative">
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                ref={productInputRef}
                type="text"
                value={productQuery}
                onChange={e => setProductQuery(e.target.value)}
                placeholder="เช่น แป๊บแบน 100x50 หรือ ท่อกลม 50"
                autoComplete="off"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '2px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  color: '#f1f5f9',
                  padding: '10px 14px 10px 38px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {productSearching && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.75rem' }}>
                  กำลังค้นหา...
                </div>
              )}
            </div>
            <p className="text-xs mt-1.5" style={{ color: '#475569' }}>
              พิมพ์ชื่อหรือขนาดสินค้าจากป้าย แล้วเลือกรายการที่ตรงกัน
            </p>

            {/* Search results */}
            {productResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {productResults.map(p => {
                  const isExpected = locationInfo.AllowedSKUType && p.SKUType === locationInfo.AllowedSKUType;
                  return (
                    <button
                      key={p.ProductCode}
                      onClick={() => handleProductSelect(p)}
                      disabled={saving}
                      style={{
                        width: '100%',
                        background: isExpected ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                        border: isExpected ? '1.5px solid rgba(16,185,129,0.5)' : '1.5px solid rgba(255,255,255,0.08)',
                        borderRadius: 12,
                        padding: '10px 14px',
                        cursor: saving ? 'wait' : 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}
                    >
                      <Package size={16} style={{ color: isExpected ? '#6ee7b7' : '#64748b', flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: isExpected ? '#d1fae5' : '#e2e8f0' }}>
                          {p.ProductName}
                        </div>
                        {p.CategoryName && (
                          <div className="text-xs" style={{ color: '#64748b' }}>{p.CategoryName}</div>
                        )}
                      </div>
                      {p.SKUType && (
                        <div className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${skuColor(p.SKUType)}22`,
                            color: skuColor(p.SKUType),
                            border: `1px solid ${skuColor(p.SKUType)}44`
                          }}>
                          {p.SKUType}
                          {isExpected && ' ✓'}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {productQuery.trim().length >= 2 && !productSearching && productResults.length === 0 && (
              <div className="mt-3 text-center py-4 text-sm" style={{ color: '#475569' }}>
                ไม่พบสินค้าที่ตรงกัน — ลองพิมพ์ชื่อหรือขนาดใหม่
              </div>
            )}
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
                  {item.ProductFoundName && (
                    <div className="text-xs truncate" style={{ color: '#94a3b8' }}>
                      {item.ProductFoundName}
                    </div>
                  )}
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
