import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Response interceptor
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wms_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (err.response?.status === 403) {
      toast.error('ไม่มีสิทธิ์ดำเนินการนี้');
    } else if (!err.response) {
      toast.error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
    return Promise.reject(err);
  }
);

export default api;
