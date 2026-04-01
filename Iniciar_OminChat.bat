@echo off
title RentControl OS - Gestor de Arranque

echo ===================================================
echo [1] Iniciando el Backend (Servidor de Base de Datos y API)...
start "OmniChat Backend" cmd.exe /k "cd backend && npx prisma generate && npm run start:dev"

timeout /t 3 /nobreak >nul

echo [2] Iniciando el Frontend (Interfaz Web en React)...
start "OmniChat Frontend" cmd.exe /k "cd frontend && npm run dev"

echo ===================================================
echo ¡Listo, Jorge! 
echo El sistema se esta levantando.
echo Abre tu navegador en OmniChat: http://localhost:3003
echo.
echo Para APAGAR el sistema, simplemente cierra las dos ventanas
echo negras (Backend y Frontend) que se acaban de abrir.
echo ===================================================
pause
