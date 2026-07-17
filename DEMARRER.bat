@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0DEMARRER.ps1"
echo.
echo ----- Fin du script (code %ERRORLEVEL%). Cette fenetre reste ouverte. -----
pause
