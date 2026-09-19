# Scan non-C: drives and POST a nested Files/Folders JSON tree to /api/fs.
param(
  [string]$ApiUrl = 'https://rawreceive.up.railway.app/api/fs'
)

$ErrorActionPreference = 'Stop'

function Build-JsonTree {
  param([Parameter(Mandatory = $true)][string]$Path)

  $files = @()
  $folders = [ordered]@{}

  try {
    $files = @(
      Get-ChildItem -LiteralPath $Path -File -Force -ErrorAction SilentlyContinue |
        Sort-Object Name |
        ForEach-Object { $_.Name }
    )

    $dirs = @(
      Get-ChildItem -LiteralPath $Path -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object {
          # Skip junctions/symlinks to avoid cycles and runaway scans
          -not ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
        } |
        Sort-Object Name
    )

    foreach ($dir in $dirs) {
      Write-Host ("  Scanning: " + $dir.FullName)
      $folders[$dir.Name] = Build-JsonTree -Path $dir.FullName
    }
  } catch {
    # Skip inaccessible paths
  }

  return [ordered]@{
    Files   = @($files)
    Folders = $folders
  }
}

try {
  $jsonObj = [ordered]@{}

  $drives = @(
    Get-PSDrive -PSProvider FileSystem |
      Where-Object { $_.Root -and ($_.Root -notmatch '^[Cc]:') } |
      Sort-Object Name
  )

  if ($drives.Count -eq 0) {
    Write-Error 'No non-C: drives found.'
    exit 1
  }

  foreach ($drive in $drives) {
    $root = $drive.Root
    if (-not (Test-Path -LiteralPath $root)) {
      Write-Host ("Skipping unavailable drive: " + $root)
      continue
    }

    $driveLetter = $root.TrimEnd('\')
    Write-Host ("Building tree for " + $driveLetter)
    $jsonObj[$driveLetter] = Build-JsonTree -Path $root
  }

  if ($jsonObj.Count -eq 0) {
    Write-Error 'No readable non-C: drives found.'
    exit 1
  }

  Write-Host 'Converting to JSON...'
  $jsonString = $jsonObj | ConvertTo-Json -Depth 100 -Compress
  $body = [System.Text.Encoding]::UTF8.GetBytes($jsonString)

  Write-Host ("Posting to " + $ApiUrl + " (" + $body.Length + " bytes)...")
  Invoke-RestMethod -Uri $ApiUrl -Method Post -ContentType 'application/json; charset=utf-8' -Body $body | Out-Null
  Write-Host 'Sent successfully.'
  exit 0
} catch {
  Write-Host ("ERROR: " + $_.Exception.Message)
  exit 1
}
