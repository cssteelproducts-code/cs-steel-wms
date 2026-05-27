import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Global loading bar
let _pending = 0;
const bar = () => document.getElementById('global-loading-bar');
const showBar = () => { _pending++; const el = bar(); if (el) el.classList.add('active'); };
const hideBar = () => { _pending = Math.max(0, _pending - 1); if (_pending === 0) { const el = bar(); if (el) el.classList.remove('active'); } };

api.interceptors.request.use(cfg => { showBar(); return cfg; }, err => { hideBar(); return Promise.reject(err); });

api.interceptors.response.use(
  res => { hideBar(); return res; },
  err => {
    hideBar();
    if (err.response?.status === 401) {
      localStorage.removeItem('wms_token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    } else if (err.response?.status === 403) {
      toast.error('ไม่มีสิทธิ์ดำเนินการนี้');
    }
    return Promise.reject(err);
  }
);

export default api;
