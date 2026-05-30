import { useState, useEffect, useRef } from 'react';
import { ScanLine, MapPin, CheckCircle2, XCircle, RotateCcw, History, Package, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const INPUT_STYLE = {
  width: '100%',
  background: '#0f172a',
  border: '2px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#f1f5f9',
  padding: '9px 12px',
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box'
};

const LABEL_STYLE = {
  fontSize: '0.72rem',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
  display: 'block'
};

const currentMonth = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);

const MONTH_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function fmtMonth(ym) {
  const [y, m] = ym.split('-');
  return `${MONTH_TH[parseInt(m) - 1]} ${parseInt(y) + 543}`;
}

export default function LocationCheck() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [locationCode, setLocationCode] = useState('');
  const [locationInfo, setLocationInfo] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [todayLog, setTodayLog] = useState([]);

  const [filters, setFilters] = useState({ category: '', size: '', thickness: '' });
  const [productResults, setProductResults] = useState([]);
  const [productSearching, setProductSearching] = useState(false);

  const locationInputRef = useRef(null);
  const categoryInputRef = useRef(null);

  useEffect(() => {
    loadTodayLog();
    setTimeout(() => locationInputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    loadTodayLog();
    setResult(null);
    setLocationInfo(null);
    setLocationCode('');
    setFilters({ category: '', size: '', thickness: '' });
    setProductResults([]);
  }, [selectedMonth]);

  // debounced product search — triggers when any filter changes
  useEffect(() => {
    const { category, size, thickness } = filters;
    const hasInput = [category, size, thickness].some(v => v.trim().length >= 1);
    if (!hasInput) { setProductResults([]); return; }

    const timer = setTimeout(async () => {
      setProductSearching(true);
      try {
        const params = new URLSearchParams();
        if (category.trim()) params.set('category', category.trim());
        if (size.trim()) params.set('size', size.trim());
        if (thickness.trim()) params.set('thickness', thickness.trim());
        const res = await api.get(`/location-check/products/search?${params.toString()}`);
        if (res.data.success) setProductResults(res.data.data);
      } catch {}
      setProductSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.category, filters.size, filters.thickness]);

  const loadTodayLog = async () => {
    try {
      const res = await api.get(`/location-check/today?month=${selectedMonth}`);
      if (res.data.success) setTodayLog(res.data.data);
    } catch {}
  };

  const handleSearch = async () => {
    const code = locationCode.trim();
    if (!code) return;
    setSearching(true);
    setLocationInfo(null);
    setResult(null);
    setFilters({ category: '', size: '', thickness: '' });
    setProductResults([]);
    try {
      const res = await api.get(`/location-check/lookup?code=${encodeURIComponent(code)}`);
      if (res.data.success) {
        setLocationInfo(res.data.data);
        setTimeout(() => categoryInputRef.current?.focus(), 100);
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
        productFoundName: product.ProductName,
        month: selectedMonth
      });
      if (res.data.success) {
        setResult(res.data);
        loadTodayLog();
        setTimeout(() => {
          setResult(null);
          setLocationInfo(null);
          setLocationCode('');
          setFilters({ category: '', size: '', thickness: '' });
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

  const handleDeleteItem = async (itemId) => {
    try {
      await api.delete(`/location-check/item/${itemId}`);
      setTodayLog(prev => prev.filter(i => i.ItemID !== itemId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
    }
  };

  const handleReset = () => {
    setResult(null);
    setLocationInfo(null);
    setLocationCode('');
    setFilters({ category: '', size: '', thickness: '' });
    setProductResults([]);
    setTimeout(() => locationInputRef.current?.focus(), 50);
  };

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

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

      {/* Month selector */}
      <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
        style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          รอบตรวจนับเดือน
        </div>
        <div style={{ flex: 1 }}>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => e.target.value && setSelectedMonth(e.target.value)}
            style={{
              background: '#0f172a',
              border: '2px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#f1f5f9',
              padding: '7px 12px',
              fontSize: '0.9rem',
              outline: 'none',
              width: '100%',
              colorScheme: 'dark'
            }}
          />
        </div>
        <div className="text-sm font-semibold" style={{ color: '#dc2626', whiteSpace: 'nowrap' }}>
          {fmtMonth(selectedMonth)}
        </div>
      </div>

      {/* Scan location */}
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
            className="flex-1 font-mono rounded-xl px-4 py-3"
            style={{ ...INPUT_STYLE, fontSize: '1.1rem', letterSpacing: '0.05em' }}
          />
          <button
            onClick={handleSearch}
            disabled={searching || !locationCode.trim()}
            className="px-5 rounded-xl font-semibold"
            style={{
              background: locationCode.trim() ? '#dc2626' : '#374151',
              color: '#fff', border: 'none',
              cursor: locationCode.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem', minWidth: 72
            }}>
            {searching ? '...' : 'ค้นหา'}
          </button>
        </div>
      </div>

      {/* Location info + product filters */}
      {locationInfo && !result && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Location header */}
          <div className="flex items-start gap-3 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="p-2 rounded-lg flex-shrink-0" style={{ background: 'rgba(220,38,38,0.15)' }}>
              <MapPin size={18} style={{ color: '#dc2626' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xl font-bold" style={{ color: '#f1f5f9' }}>{locationInfo.LocationCode}</div>
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

          {/* 3-field product search — mirrors what's on the product tag */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: '#94a3b8' }}>
              ระบุสินค้าจากป้าย
            </p>

            {/* Row 1: category full width */}
            <div className="mb-2">
              <label style={LABEL_STYLE}>ชื่อหมวด</label>
              <input
                ref={categoryInputRef}
                type="text"
                value={filters.category}
                onChange={e => setFilter('category', e.target.value)}
                placeholder="เช่น แป๊บแบน, ท่อกลม, เหล็กฉาก..."
                autoComplete="off"
                style={INPUT_STYLE}
              />
            </div>

            {/* Row 2: size + thickness side by side */}
            <div className="flex gap-2">
              <div style={{ flex: '1 1 0' }}>
                <label style={LABEL_STYLE}>ขนาด</label>
                <input
                  type="text"
                  value={filters.size}
                  onChange={e => setFilter('size', e.target.value)}
                  placeholder="เช่น 100x50"
                  autoComplete="off"
                  style={INPUT_STYLE}
                />
              </div>
              <div style={{ flex: '1 1 0' }}>
                <label style={LABEL_STYLE}>ความหนา (มม.)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={filters.thickness}
                  onChange={e => setFilter('thickness', e.target.value)}
                  placeholder="เช่น 1.15"
                  autoComplete="off"
                  style={INPUT_STYLE}
                />
              </div>
            </div>

            {/* Hint line */}
            <p className="text-xs mt-2" style={{ color: '#475569' }}>
              พิมพ์อย่างน้อย 1 ช่อง ระบบจะกรองรายการสินค้าให้
            </p>

            {/* Results */}
            {productSearching && (
              <div className="mt-3 text-center text-sm py-3" style={{ color: '#64748b' }}>กำลังค้นหา...</div>
            )}

            {!productSearching && productResults.length > 0 && (
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
                      <Package size={15} style={{ color: isExpected ? '#6ee7b7' : '#64748b', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-sm font-medium" style={{ color: isExpected ? '#d1fae5' : '#e2e8f0', lineHeight: 1.3 }}>
                          {p.ProductName}
                        </div>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          {p.CategoryName && (
                            <span className="text-xs" style={{ color: '#64748b' }}>{p.CategoryName}</span>
                          )}
                          {p.SizeCode && (
                            <span className="text-xs font-mono" style={{ color: '#64748b' }}>{p.SizeCode}</span>
                          )}
                          {p.Thickness != null && (
                            <span className="text-xs font-mono" style={{ color: '#64748b' }}>{p.Thickness} มม.</span>
                          )}
                        </div>
                      </div>
                      {p.SKUType && (
                        <div className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${skuColor(p.SKUType)}22`,
                            color: skuColor(p.SKUType),
                            border: `1px solid ${skuColor(p.SKUType)}44`
                          }}>
                          {p.SKUType}{isExpected ? ' ✓' : ''}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {!productSearching && productResults.length === 0 &&
              Object.values(filters).some(v => v.trim().length >= 1) && (
              <div className="mt-3 text-center py-4 text-sm" style={{ color: '#475569' }}>
                ไม่พบสินค้าที่ตรงกัน — ลองแก้คำค้นหา
              </div>
            )}
          </div>

          <button onClick={handleReset} className="flex items-center gap-1.5 text-sm mx-auto"
            style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>
            <RotateCcw size={13} /> ยกเลิก / สแกนใหม่
          </button>
        </div>
      )}

      {/* Result flash */}
      {result && (
        <div className="rounded-2xl p-6 text-center"
          style={{
            background: result.isMatch ? 'rgba(16,185,129,0.12)' : 'rgba(220,38,38,0.12)',
            border: `2px solid ${result.isMatch ? '#10b981' : '#dc2626'}`
          }}>
          <div className="flex justify-center mb-3">
            {result.isMatch
              ? <CheckCircle2 size={60} style={{ color: '#10b981' }} />
              : <XCircle size={60} style={{ color: '#dc2626' }} />}
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
          <p className="text-xs mt-4" style={{ color: '#475569' }}>กำลังล้างข้อมูลเพื่อสแกน Location ต่อไป...</p>
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
                รายการรอบ {fmtMonth(selectedMonth)} ({todayLog.length} location)
              </span>
            </div>
            <div className="flex gap-3 text-xs font-semibold">
              <span style={{ color: '#6ee7b7' }}>✓ {matchCount}</span>
              <span style={{ color: '#fca5a5' }}>✗ {mismatchCount}</span>
            </div>
          </div>
          <div>
            {todayLog.map(item => (
              <div key={item.ItemID} className="px-4 py-3 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex-shrink-0">
                  {item.IsMatch
                    ? <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                    : <XCircle size={18} style={{ color: '#dc2626' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-medium" style={{ color: '#e2e8f0' }}>
                    {item.LocationCode}
                  </div>
                  {item.ProductFoundName && (
                    <div className="text-xs truncate" style={{ color: '#94a3b8' }}>{item.ProductFoundName}</div>
                  )}
                  <div className="text-xs truncate" style={{ color: '#64748b' }}>
                    {item.ActualSKUType || '-'}
                    {!item.IsMatch && item.ExpectedSKUType && (
                      <span style={{ color: '#f59e0b' }}> (ควรเป็น: {item.ExpectedSKUType})</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-xs" style={{ color: '#475569' }}>{item.LocationTypeName || ''}</div>
                  <button
                    onClick={() => handleDeleteItem(item.ItemID)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#475569', lineHeight: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#475569'}
                    title="ลบรายการนี้"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
