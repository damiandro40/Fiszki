# Windows repair for a missing Electron binary/path.txt. Requires PowerShell 5.1+.
# Downloads an official Electron release (or a mirror) and checks its SHA-256.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Step([string] $message) {
    Write-Host "[Fiszki] $message"
}

function Get-ExpectedHash([string] $checksumFile, [string] $archiveName) {
    $lines = Get-Content -LiteralPath $checksumFile -Encoding UTF8
    foreach ($line in $lines) {
        if ($line -match '^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$') {
            $fileName = $Matches[2].Trim()
            if ($fileName -eq $archiveName) {
                return $Matches[1].ToLowerInvariant()
            }
        }
    }
    throw "W SHASUMS256.txt nie ma sumy dla $archiveName"
}

function Assert-ArchiveHash([string] $archive, [string] $checksumFile, [string] $archiveName) {
    $expected = Get-ExpectedHash $checksumFile $archiveName
    $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "Blad sumy SHA-256: plik $archiveName jest uszkodzony lub niezgodny z wersja"
    }
    Write-Step 'Suma SHA-256 poprawna.'
}

$projectDir = Split-Path -Parent $PSScriptRoot
$electronDir = Join-Path $projectDir 'node_modules\electron'
$packageFile = Join-Path $electronDir 'package.json'
$pathFile = Join-Path $electronDir 'path.txt'
$distDir = Join-Path $electronDir 'dist'
$exeFile = Join-Path $distDir 'electron.exe'

if (-not (Test-Path -LiteralPath $packageFile -PathType Leaf)) {
    throw "Brak pakietu electron w node_modules. Najpierw uruchom npm install w folderze projektu."
}

$electronPackage = Get-Content -LiteralPath $packageFile -Raw -Encoding UTF8 | ConvertFrom-Json
$version = [string] $electronPackage.version
if ($version -notmatch '^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$') {
    throw "Nieprawidlowa wersja electron: $version"
}

if (Test-Path -LiteralPath $exeFile -PathType Leaf) {
    Set-Content -LiteralPath $pathFile -Value 'electron.exe' -Encoding ASCII -NoNewline
    Write-Step "Electron v$version juz ma electron.exe. Odtworzono path.txt."
    exit 0
}

$arch = if ($env:ELECTRON_ARCH -in @('x64', 'arm64', 'ia32')) {
    $env:ELECTRON_ARCH
} elseif ([Environment]::Is64BitOperatingSystem) {
    'x64'
} else {
    'ia32'
}
$archiveName = "electron-v$version-win32-$arch.zip"
$temporaryDir = Join-Path ([IO.Path]::GetTempPath()) ("fiszki-electron-" + [Guid]::NewGuid().ToString('N'))
$archiveFile = Join-Path $temporaryDir $archiveName
$checksumFile = Join-Path $temporaryDir 'SHASUMS256.txt'
$extractedDir = Join-Path $temporaryDir 'extracted'

$downloadSources = @()
if ($env:ELECTRON_MIRROR) {
    $downloadSources += @{ Name = 'Wlasny mirror'; Url = ($env:ELECTRON_MIRROR.TrimEnd('/') + '/v' + $version) }
}
$downloadSources += @{ Name = 'GitHub Releases'; Url = "https://github.com/electron/electron/releases/download/v$version" }
$downloadSources += @{ Name = 'npmmirror'; Url = "https://npmmirror.com/mirrors/electron/v$version" }

New-Item -ItemType Directory -Path $temporaryDir -Force | Out-Null

try {
    # Useful on Windows PowerShell 5.1 (TLS 1.2 required by release hosts).
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    } catch {}

    Write-Step "Brak electron.exe. Pobieram v$version ($arch); rozmiar moze przekroczyc 100 MB."
    $verified = $false
    $errors = @()

    # If GitHub is blocked, users can download the official ZIP and its SHASUMS256.txt
    # manually in their browser into scripts/electron-cache/ and rerun the fixer.
    $manualCache = Join-Path $PSScriptRoot 'electron-cache'
    $manualArchive = Join-Path $manualCache $archiveName
    $manualChecksums = Join-Path $manualCache 'SHASUMS256.txt'
    if ((Test-Path -LiteralPath $manualArchive -PathType Leaf) -and (Test-Path -LiteralPath $manualChecksums -PathType Leaf)) {
        Write-Step 'Sprawdzam pobrane recznie pliki z scripts/electron-cache...'
        Assert-ArchiveHash $manualArchive $manualChecksums $archiveName
        Copy-Item -LiteralPath $manualArchive -Destination $archiveFile
        $verified = $true
    }

    if (-not $verified) {
        foreach ($source in $downloadSources) {
            try {
                Write-Step ("Probuje: " + $source.Name)
                $base = [string] $source.Url
                Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -OutFile $checksumFile -UseBasicParsing -MaximumRedirection 10 -ErrorAction Stop
                $expected = Get-ExpectedHash $checksumFile $archiveName
                Write-Step "Pobieram: $archiveName"
                Invoke-WebRequest -Uri "$base/$archiveName" -OutFile $archiveFile -UseBasicParsing -MaximumRedirection 10 -ErrorAction Stop
                Assert-ArchiveHash $archiveFile $checksumFile $archiveName
                $verified = $true
                break
            } catch {
                $reason = $_.Exception.Message
                $errors += ($source.Name + ': ' + $reason)
                Write-Warning ("Nie udalo sie przez " + $source.Name + ': ' + $reason)
                Remove-Item -LiteralPath $archiveFile -Force -ErrorAction SilentlyContinue
                Remove-Item -LiteralPath $checksumFile -Force -ErrorAction SilentlyContinue
            }
        }
    }

    if (-not $verified) {
        $manualUrl = "https://github.com/electron/electron/releases/download/v$version"
        throw ("Nie udalo sie pobrac Electron z zadnego serwera.`n" + ($errors -join "`n") +
            "`nMozesz pobrac w przegladarce: $manualUrl/$archiveName oraz $manualUrl/SHASUMS256.txt" +
            "`nUmiesc OBA pliki w scripts/electron-cache/ i ponow naprawianie.")
    }

    Write-Step 'Rozpakowuje Electron...'
    Expand-Archive -LiteralPath $archiveFile -DestinationPath $extractedDir -Force
    $extractedExe = Join-Path $extractedDir 'electron.exe'
    if (-not (Test-Path -LiteralPath $extractedExe -PathType Leaf)) {
        throw 'Archiwum nie zawiera electron.exe. Nie zmieniono instalacji.'
    }

    if (Test-Path -LiteralPath $distDir) {
        Remove-Item -LiteralPath $distDir -Recurse -Force
    }
    Move-Item -LiteralPath $extractedDir -Destination $distDir
    if (-not (Test-Path -LiteralPath $exeFile -PathType Leaf)) {
        throw 'Rozpakowanie nie powiodlo sie: brak electron.exe.'
    }
    Set-Content -LiteralPath $pathFile -Value 'electron.exe' -Encoding ASCII -NoNewline

    Write-Step "GOTOWE: Electron v$version ($arch) jest zainstalowany."
    Write-Step 'Uruchom: npm run dev'
    exit 0
} catch {
    Write-Host ''
    Write-Host ('BLAD NAPRAWY: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    Remove-Item -LiteralPath $temporaryDir -Recurse -Force -ErrorAction SilentlyContinue
}
