import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { User, Lock, Eye, EyeOff, Save, ShieldCheck } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);

  const handleChange = async (e) => {
    e.preventDefault();
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      toast.error('กรุณากรอกข้อมูลให้ครบ'); return;
    }
    if (form.newPassword.length < 6) {
      toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'); return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('รหัสผ่านใหม่ไม่ตรงกัน'); return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const PassInput = ({ id, label, field }) => (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type={show[field] ? 'text' : 'password'}
          value={form[field === 'current' ? 'currentPassword' : field === 'new' ? 'newPassword' : 'confirmPassword']}
          onChange={e => setForm(p => ({ ...p, [field === 'current' ? 'currentPassword' : field === 'new' ? 'newPassword' : 'confirmPassword']: e.target.value }))}
          className="input-field pl-9 pr-10"
          placeholder={label}
          autoComplete={field === 'current' ? 'current-password' : 'new-password'}
        />
        <button type="button" onClick={() => setShow(p => ({ ...p, [field]: !p[field] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
          {show[field] ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* User info card */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-white text-2xl font-bold">{user?.fullName?.charAt(0) || 'U'}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{user?.fullName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                {user?.roleName}
              </span>
              {user?.warehouseName && (
                <span className="text-xs text-slate-500">{user.warehouseName}</span>
              )}
            </div>
            <p className="text-slate-400 text-xs mt-1">@{user?.username}</p>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck size={18} className="text-red-500" />
          <h3 className="card-header mb-0">เปลี่ยนรหัสผ่าน</h3>
        </div>
        <form onSubmit={handleChange} className="space-y-4">
          <PassInput field="current" label="รหัสผ่านปัจจุบัน" />
          <div className="border-t border-slate-100 pt-4">
            <PassInput field="new" label="รหัสผ่านใหม่" />
          </div>
          <PassInput field="confirm" label="ยืนยันรหัสผ่านใหม่" />
          {form.confirmPassword && form.newPassword !== form.confirmPassword && (
            <p className="text-xs text-red-500">รหัสผ่านไม่ตรงกัน</p>
          )}
          <button type="submit" disabled={saving} className="btn-primary w-full py-3">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Save size={15} />บันทึกรหัสผ่านใหม่</>}
          </button>
        </form>
      </div>

    </div>
  );
}
