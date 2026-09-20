@echo off
setlocal
rem Rebuild the Windows PE stub used by the Node cmd2exe packer.
rem Requires MinGW/TDM-GCC with a gcc that can target Windows.

set "GCC="
where gcc >nul 2>&1 && set "GCC=gcc"
if "%GCC%"=="" if exist "C:\Program Files (x86)\Embarcadero\Dev-Cpp\TDM-GCC-64\bin\gcc.exe" (
  set "GCC=C:\Program Files (x86)\Embarcadero\Dev-Cpp\TDM-GCC-64\bin\gcc.exe"
)

if "%GCC%"=="" (
  echo gcc not found. Install MinGW/TDM-GCC to rebuild stub.exe
  exit /b 1
)

"%GCC%" "%~dp0stub.c" -o "%~dp0stub.exe" -mwindows -municode -O2 -s
exit /b %ERRORLEVEL%
