@echo off
setlocal EnableExtensions

rem ============================================================
rem Scan non-C: drives and POST filesystem tree JSON to /api/fs
rem ============================================================

set "API_URL=https://rawreceive.up.railway.app/api/fs"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0fs.ps1" -ApiUrl "%API_URL%"
set "EXITCODE=%ERRORLEVEL%"

if not %EXITCODE%==0 (
  echo.
  echo Upload failed. Error code: %EXITCODE%
)

exit /b %EXITCODE%
