import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Global loading bar
let _pending = 0;
const bar = () => document.getElementById('global-loading-bar');
export const showBar = () => {
  _pending++;
  const el = bar();
  if (!el) return;
  el.style.cssText = '';        // clear any in-progress done transition
  void el.offsetWidth;          // force reflow so animation restarts from 20%
  el.classList.add('active');
};
export const hideBar = () => {
  _pending = Math.max(0, _pending - 1);
  if (_pending > 0) return;
  const el = bar();
  if (!el) return;
  const w = el.offsetWidth;     // freeze at current animated width
  el.classList.remove('active');
  el.style.width = w + 'px';
  requestAnimationFrame(() => {
    el.style.transition = 'width 0.15s ease, opacity 0.25s ease 0.1s';
    el.style.width = '100%';
    el.style.opacity = '0';
    setTimeout(() => { el.style.cssText = ''; }, 450);
  });
};

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
