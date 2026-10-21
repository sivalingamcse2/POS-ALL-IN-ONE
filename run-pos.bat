@echo off
title SIVARA POS - Enterprise Restaurant & Supermarket System
color 0A

echo =====================================================================
echo           SIVARA RESTAURANT & SUPERMARKET POS SYSTEM v2.0
echo             [Cloud Sync & Offline Local Storage Engine]
echo =====================================================================
echo.

echo [1/2] Starting Backend API Server (Port 5000)...
start "SIVARA POS Server" cmd /k "cd server && npm run dev"

echo [2/2] Starting Frontend Client (Port 4000)...
start "SIVARA POS Client" cmd /k "cd client && npm run dev"

echo.
echo Both Server and Client have been launched!
echo - Client Address: http://localhost:4000
echo - Server API:     http://localhost:5000/api
echo - Default Login:  admin / admin123  (or PIN: 1234)
echo.
echo Press any key to exit this launcher window...
pause >nul
