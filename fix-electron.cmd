@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo     Fiszki - naprawa Electrona
echo ================================================
echo.
node scripts\ensure-electron.cjs
if errorlevel 1 (
    echo.
    echo Naprawa nie powiodla sie. Szczegoly sa powyzej.
    echo Jezeli GitHub jest zablokowany, skrypt podpowie pobieranie reczne.
    echo.
    pause
    exit /b 1
)
echo.
echo Gotowe. Teraz wpisz w terminalu: npm run dev
pause
