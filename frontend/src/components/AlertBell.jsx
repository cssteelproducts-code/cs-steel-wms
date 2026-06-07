import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function AlertBell() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();

  const fetchCount = async () => {
    try {
      const res = await api.get('/alerts/unread-count', { silent: true });
      setCount(res.data.count || 0);
    } catch {}
  };

  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <button
      onClick={() => navigate('/alerts')}
      className="relative h-9 w-9 flex items-center justify-center rounded-lg transition-colors"
      style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
      onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
      title="การแจ้งเตือน"
    >
      <Bell size={18} className={count > 0 ? 'text-red-500' : 'text-slate-500'} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
