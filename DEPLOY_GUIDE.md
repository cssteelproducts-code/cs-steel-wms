# CS Steel WMS - คู่มือ Deploy บน Railway

## ขั้นตอนการ Deploy

### 1. สร้าง GitHub Repository
```bash
git init
git add .
git commit -m "Initial CS Steel WMS"
git remote add origin https://github.com/your-username/cs-steel-wms.git
git push -u origin main
```

### 2. สร้าง Railway Project
1. ไปที่ https://railway.app
2. New Project → Deploy from GitHub repo
3. เลือก repo ที่สร้างไว้
4. Railway จะ detect `railway.toml` โดยอัตโนมัติ

### 3. ตั้งค่า Environment Variables บน Railway
ไปที่ Variables tab และเพิ่ม:
```
PORT=3000
NODE_ENV=production
DB_SERVER=180.183.246.215
DB_PORT=54321
DB_USER=css_transport
DB_PASSWORD=C$$_Tr0n$port
DB_NAME=WMS
JWT_SECRET=CsSteelWMS_JWT_Secret_K3y_2025
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://cs-steel-wms-production.up.railway.app
```

### 4. ตั้งค่า Custom Domain
Settings → Networking → Custom Domain
ใส่: cs-steel-wms-production.up.railway.app

### 5. Initialize Database (ครั้งแรกเท่านั้น)
หลัง deploy เสร็จ ไปที่ Railway Shell หรือ run locally:
```bash
cd backend && npm run init-db
```

## ข้อมูลเข้าสู่ระบบเริ่มต้น
- Username: `admin`
- Password: `Admin@1234`
- **เปลี่ยนรหัสผ่านทันทีหลัง Login ครั้งแรก!**

## Firewall IPs (แจ้ง IT เพิ่มเติม)
Railway Static IPs:
- 162.220.232.250
- 162.220.232.251
- 152.55.176.240

## การเชื่อมต่อ DTC GPS API
หลังได้รับ API credentials จาก DTC:
1. ไปที่ Railway Variables
2. เพิ่ม `DTC_API_URL` และ `DTC_API_KEY`
3. Railway จะ redeploy อัตโนมัติ

## โครงสร้างระบบ
```
cs-steel-wms/
├── backend/          Express.js API
├── frontend/         React + Vite (PWA)
└── railway.toml      Deploy config
```

## URLs
- Production: https://cs-steel-wms-production.up.railway.app
- Health Check: /api/health
