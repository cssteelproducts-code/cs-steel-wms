import { useState } from 'react';
import Fleet   from './Fleet';
import Orders  from './Orders';
import Plan    from './Plan';
import Trip    from './Trip';
import Cost    from './Cost';

const TABS = [
  { key: 'fleet',  label: '🚚 รถ' },
  { key: 'orders', label: '📋 ออเดอร์' },
  { key: 'plan',   label: '🗺️ แผน' },
  { key: 'trip',   label: '👷 พนักงาน/เที่ยว' },
  { key: 'cost',   label: '💰 ค่าขนส่ง' },
];

export default function Delivery() {
  const [tab, setTab] = useState('fleet');

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ background: tab === t.key ? 'var(--accent)' : 'var(--surface)',
                     color: 'var(--text)', border: '1px solid var(--border)',
                     borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'fleet'  && <Fleet />}
      {tab === 'orders' && <Orders />}
      {tab === 'plan'   && <Plan />}
      {tab === 'trip'   && <Trip />}
      {tab === 'cost'   && <Cost />}
    </div>
  );
}
