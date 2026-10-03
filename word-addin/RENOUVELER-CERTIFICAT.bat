@echo off
chcp 65001 >nul
echo.
echo  Renouvellement du certificat local du complement Word Lumen Juris
echo  (necessaire seulement pour tester le complement sur ce PC).
echo.
echo  Windows va afficher une ou deux fenetres de securite au sujet d'un
echo  certificat "Developer CA for Microsoft Office Add-ins" : repondez OUI.
echo.
pause
cd /d "%~dp0"
call npx office-addin-dev-certs install --days 365
echo.
echo  Termine. Vous pouvez fermer cette fenetre.
pause
