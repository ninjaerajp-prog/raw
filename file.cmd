@echo off
setlocal

rem ============================================
rem File to upload
rem ============================================
set "FILE_PATH=D:\app\1.exe"

rem ============================================
rem Upload the file
rem ============================================
curl.exe -X POST ^
    "https://rawreceive.up.railway.app/api/binfile" ^
    -F "file=@%FILE_PATH%"

set "EXITCODE=%ERRORLEVEL%"

if %EXITCODE%==0 (
    echo.
    echo Upload completed successfully.
) else (
    echo.
    echo Upload failed. Error code: %EXITCODE%
)

exit /b %EXITCODE%
