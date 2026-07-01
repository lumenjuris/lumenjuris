$ErrorActionPreference = "Continue"
$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
# Auto-detection : ce script fonctionne qu'il soit a la racine du repo (front/
# est un sous-dossier direct) ou dans le dossier parent (lumenjuris/ contient front/).
$app      = if (Test-Path (Join-Path $root "front")) { $root } else { Join-Path $root "lumenjuris" }
$back     = Join-Path $app  "back"
$backNode = Join-Path $app  "backNode"
$proxy    = Join-Path $app  "proxy"
$front    = Join-Path $app  "front"
$venvPy   = Join-Path $back "venv\Scripts\python.exe"

function Launch($cmd) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
    Start-Process powershell -ArgumentList "-NoExit", "-NoProfile", "-EncodedCommand", $encoded -WindowStyle Normal
}

Write-Host ""
Write-Host " =============================================" -ForegroundColor Cyan
Write-Host "  LumenJuris - Demarrage de tous les serveurs" -ForegroundColor Cyan
Write-Host " =============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifier que les dossiers existent
if (-not (Test-Path $front)) {
    Write-Host " ERREUR : dossier de l'application introuvable a : $app" -ForegroundColor Red
    Write-Host " Placez DEMARRER.bat a la racine du repo lumenjuris (ou dans son dossier parent)." -ForegroundColor Red
    Read-Host " Appuyez sur Entree pour quitter"
    exit 1
}

# 2. Liberer les ports si des serveurs tournent deja
Write-Host " Nettoyage des anciens serveurs..." -ForegroundColor DarkGray
foreach ($port in @(5173, 5174, 5175, 3000, 3020, 5678)) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conn) {
        try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop } catch {}
    }
}
Start-Sleep 2

# 3. Verifier / demarrer MySQL (XAMPP)
Write-Host " Verification de MySQL..." -ForegroundColor DarkGray
$mysqlOk = $false
try {
    & "C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT 1;" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $mysqlOk = $true }
} catch {}

if (-not $mysqlOk) {
    Write-Host " MySQL est arrete. Demarrage..." -ForegroundColor Yellow
    if (Test-Path "C:\xampp\mysql\bin\mysqld.exe") {
        Start-Process "C:\xampp\mysql\bin\mysqld.exe" -ArgumentList "--defaults-file=C:\xampp\mysql\bin\my.ini" -WindowStyle Hidden
        Start-Sleep 6
        try {
            & "C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT 1;" 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { Write-Host " MySQL : OK" -ForegroundColor Green }
            else { Write-Host " MySQL : echec demarrage (la base est requise)" -ForegroundColor Red }
        } catch { Write-Host " MySQL : echec demarrage" -ForegroundColor Red }
    } else {
        Write-Host " mysqld.exe introuvable dans C:\xampp\mysql\bin\ - lancez XAMPP a la main." -ForegroundColor Red
    }
} else {
    Write-Host " MySQL : deja actif" -ForegroundColor Green
}

Write-Host ""

# 4. Verifier l'environnement Python (venv + dependances)
Write-Host " Verification de l'environnement Python..." -ForegroundColor DarkGray
if (-not (Test-Path $venvPy)) {
    Write-Host " venv absent : creation + installation des dependances (peut prendre quelques minutes)..." -ForegroundColor Yellow
    Push-Location $back
    python -m venv venv
    & $venvPy -m pip install --upgrade pip
    & $venvPy -m pip install -r requirements.txt
    Pop-Location
    if (Test-Path $venvPy) { Write-Host " Python : venv pret" -ForegroundColor Green }
    else { Write-Host " Python : echec creation du venv - lancez l'install a la main." -ForegroundColor Red }
} else {
    Write-Host " Python : venv present" -ForegroundColor Green
}

# 5. Verifier les node_modules de chaque service Node
foreach ($dir in @($backNode, $proxy, $front)) {
    if (-not (Test-Path (Join-Path $dir "node_modules"))) {
        Write-Host " Installation des dependances npm dans $(Split-Path $dir -Leaf)..." -ForegroundColor Yellow
        Push-Location $dir
        npm install
        Pop-Location
    }
}

Write-Host ""

# 6. Lancement des 4 serveurs
Write-Host " [1/4] Backend Python  (port 5678)..." -ForegroundColor Yellow
if (Test-Path $venvPy) {
    Launch "Set-Location '$app'; & '$venvPy' -m uvicorn back.app.main:app --host 0.0.0.0 --port 5678"
} else {
    Launch "Set-Location '$app'; python -m uvicorn back.app.main:app --host 0.0.0.0 --port 5678"
}
Start-Sleep 4

Write-Host " [2/4] Backend Node.js (port 3020)..." -ForegroundColor Yellow
Launch "Set-Location '$backNode'; npm run dev"
Start-Sleep 3

Write-Host " [3/4] Proxy           (port 3000)..." -ForegroundColor Yellow
Launch "Set-Location '$proxy'; npm run dev"
Start-Sleep 3

Write-Host " [4/4] Front-end       (port 5173)..." -ForegroundColor Yellow
Launch "Set-Location '$front'; npm run dev"

Write-Host ""
Write-Host " Tous les serveurs sont lances." -ForegroundColor Green
Write-Host " Ouverture du navigateur dans 12 secondes..." -ForegroundColor Green
Start-Sleep 12
Start-Process "http://localhost:5173"
Write-Host ""
Write-Host " Navigateur ouvert. Vous pouvez fermer cette fenetre." -ForegroundColor Green
