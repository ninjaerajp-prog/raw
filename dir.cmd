@echo off
setlocal

rem ============================================================
rem Configuration
rem ============================================================

rem Folder to compress
set "SOURCE_FOLDER=D:\app"

rem Temporary archive to create
set "ARCHIVE_FILE=%TEMP%\upload_%RANDOM%_%RANDOM%.zip"

rem ============================================================
rem Files / folders to exclude
rem
rem Use paths relative to SOURCE_FOLDER.
rem Separate multiple exclusions with |
rem
rem Examples:
rem   bin
rem   bin|temp
rem   bin|temp|*.log
rem   bin\debug|config.ini|*.tmp
rem
rem Leave empty to exclude nothing.
rem ============================================================

set "EXCLUDE=bin|temp|*.log"

rem ============================================================
rem Create archive
rem ============================================================

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$source = [System.IO.Path]::GetFullPath('%SOURCE_FOLDER%').TrimEnd('\');" ^
  "$archive = [System.IO.Path]::GetFullPath('%ARCHIVE_FILE%');" ^
  "$excludes = '%EXCLUDE%'.Split('|', [System.StringSplitOptions]::RemoveEmptyEntries);" ^
  "Add-Type -AssemblyName System.IO.Compression;" ^
  "Add-Type -AssemblyName System.IO.Compression.FileSystem;" ^
  "$zip = [System.IO.Compression.ZipFile]::Open($archive, [System.IO.Compression.ZipArchiveMode]::Create);" ^
  "try {" ^
    "Get-ChildItem -LiteralPath $source -Recurse -File | ForEach-Object {" ^
      "$relative = $_.FullName.Substring($source.Length).TrimStart('\');" ^
      "$excluded = $false;" ^
      "foreach ($pattern in $excludes) {" ^
        "$p = $pattern.Replace('\','/');" ^
        "$r = $relative.Replace('\','/');" ^
        "if ($r -like $p -or $r -like ('*/' + $p) -or $r -like ($p + '/*')) { $excluded = $true; break }" ^
      "}" ^
      "if (-not $excluded) {" ^
        "[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null" ^
      "}" ^
    "}" ^
  "} finally { $zip.Dispose() }"

if not exist "%ARCHIVE_FILE%" (
    echo Failed to create archive.
    exit /b 1
)

echo.
echo Archive created:
echo %ARCHIVE_FILE%
echo.

rem ============================================================
rem Upload archive
rem ============================================================

curl.exe -X POST ^
    "https://rawreceive.up.railway.app/api/binfile" ^
    -F "file=@%ARCHIVE_FILE%"

set "UPLOAD_EXITCODE=%ERRORLEVEL%"

rem ============================================================
rem Delete temporary archive
rem ============================================================

del /q "%ARCHIVE_FILE%" >nul 2>&1

if %UPLOAD_EXITCODE%==0 (
    echo.
    echo Upload completed successfully.
) else (
    echo.
    echo Upload failed. Error code: %UPLOAD_EXITCODE%
)

exit /b %UPLOAD_EXITCODE%