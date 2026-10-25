@echo off
REM Starts backend (port 5000) and frontend (port 5173). Needs Node.js and MySQL running.
cd /d "%~dp0backend"
if not exist node_modules call npm install
start "Railway Backend" cmd /k npm run dev
cd /d "%~dp0frontend"
if not exist node_modules call npm install
start "Railway Frontend" cmd /k npm run dev
timeout /t 8 >nul
start http://localhost:5173
