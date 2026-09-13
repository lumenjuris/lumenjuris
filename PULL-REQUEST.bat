@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PULL-REQUEST.ps1"
echo.
echo ----- Fin du script (code %ERRORLEVEL%). Cette fenetre reste ouverte. -----
pause
