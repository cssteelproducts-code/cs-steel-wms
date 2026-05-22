@echo off
echo ============================================
echo  CS Steel WMS - Build and Deploy
echo ============================================

echo [1/3] Building React client...
cd client
call npm run build
if errorlevel 1 ( echo BUILD FAILED & pause & exit /b 1 )
cd ..

echo [2/3] Installing server dependencies...
cd server
call npm install --omit=dev
if errorlevel 1 ( echo NPM INSTALL FAILED & pause & exit /b 1 )
cd ..

echo [3/3] Restarting PM2...
cd server
pm2 restart ecosystem.config.js --env production 2>nul || pm2 start ecosystem.config.js --env production
pm2 save
cd ..

echo.
echo ============================================
echo  Deploy complete!
echo  App running at http://180.183.246.215:3001
echo ============================================
pause
