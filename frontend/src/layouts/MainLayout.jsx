import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const pageTitles = {
  '/': 'Dashboard',
  '/monitor': 'Monitor รถในคลัง',
  '/weigh-in': 'สถานีชั่งเข้า (ชั่งเบา)',
  '/data-station': 'สถานี Data (รับเอกสาร)',
  '/loading-station': 'สถานีขึ้นสินค้า',
  '/checker': 'สถานีเช็คเกอร์',
  '/weigh-out': 'สถานีชั่งออก (ชั่งหนัก)',
  '/eta': 'ETA / ติดตาม GPS รถ',
  '/users': 'จัดการผู้ใช้งาน',
  '/master': 'ข้อมูลหลัก',
  '/reports': 'รายงาน',
  '/profile': 'โปรไฟล์ / เปลี่ยนรหัสผ่าน',
  '/alerts': 'การแจ้งเตือน',
  '/stock': 'สต็อกสินค้า',
  '/delivery': 'แผนจัดส่ง (VRP)'
};

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'CS.Smart WMS';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f4f8' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
