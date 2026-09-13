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
$mysqlBin = "C:\xampp\mysql\bin"

function Launch($cmd) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
    Start-Process powershell -ArgumentList "-NoExit", "-NoProfile", "-EncodedCommand", $encoded -WindowStyle Normal
}

# Vrai si le fichier temoin manque ou si l'une des sources est plus recente que lui.
# Sert a ne reinstaller les dependances qu'apres une mise a jour (git pull).
function Obsolete($temoin, [string[]]$sources) {
    if (-not (Test-Path $temoin)) { return $true }
    $date = (Get-Item $temoin).LastWriteTime
    foreach ($s in $sources) {
        if ((Test-Path $s) -and ((Get-Item $s).LastWriteTime -gt $date)) { return $true }
    }
    return $false
}

function MysqlRepond {
    & "$mysqlBin\mysql.exe" -u root -e "SELECT 1;" 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
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
$mysqlOk = MysqlRepond
if ($mysqlOk) {
    Write-Host " MySQL : deja actif" -ForegroundColor Green
} elseif (Test-Path "$mysqlBin\mysqld.exe") {
    Write-Host " MySQL est arrete. Demarrage..." -ForegroundColor Yellow
    $journalMysql = Join-Path $env:TEMP "lumenjuris-mysqld.log"
    Start-Process "$mysqlBin\mysqld.exe" -ArgumentList "--defaults-file=$mysqlBin\my.ini", "--console" -WindowStyle Hidden -RedirectStandardError $journalMysql
    # Attendre jusqu'a 30 s, en s'arretant tout de suite si mysqld meurt.
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep 1
        if (MysqlRepond) { $mysqlOk = $true; break }
        if (-not (Get-Process mysqld -ErrorAction SilentlyContinue)) { break }
    }
    if ($mysqlOk) {
        Write-Host " MySQL : OK" -ForegroundColor Green
    } else {
        Write-Host " MySQL : echec du demarrage (la base est requise). Dernieres erreurs :" -ForegroundColor Red
        Get-Content $journalMysql -ErrorAction SilentlyContinue | Select-String "ERROR" | Select-Object -Last 5 |
            ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
        Write-Host " Table 'crashed' citee ? Arreter mysqld puis, dans C:\xampp\mysql\data\mysql :" -ForegroundColor Red
        Write-Host "   C:\xampp\mysql\bin\aria_chk.exe -r <nom_de_la_table>" -ForegroundColor Red
    }
} else {
    Write-Host " mysqld.exe introuvable dans $mysqlBin - lancez XAMPP a la main." -ForegroundColor Red
}

# Tables systeme MySQL : un arret brutal de Windows peut les endommager.
# Verification rapide, reparation automatique si besoin.
if ($mysqlOk) {
    & "$mysqlBin\mysqlcheck.exe" -u root --auto-repair --check --silent mysql 2>&1 |
        ForEach-Object { Write-Host "   $_" -ForegroundColor DarkYellow }
}

Write-Host ""

# 4. Verifier l'environnement Python (venv + dependances)
Write-Host " Verification de l'environnement Python..." -ForegroundColor DarkGray
if (-not (Test-Path $venvPy)) {
    Write-Host " venv absent : creation (peut prendre quelques minutes)..." -ForegroundColor Yellow
    Push-Location $back
    python -m venv venv
    & $venvPy -m pip install --upgrade pip
    Pop-Location
}
$temoinPy = Join-Path $back "venv\.requirements-installe"
if ((Test-Path $venvPy) -and (Obsolete $temoinPy @(Join-Path $back "requirements.txt"))) {
    Write-Host " Mise a jour des dependances Python..." -ForegroundColor Yellow
    & $venvPy -m pip install -r (Join-Path $back "requirements.txt")
    if ($LASTEXITCODE -eq 0) { Set-Content $temoinPy (Get-Date) }
}
if (Test-Path $venvPy) { Write-Host " Python : pret" -ForegroundColor Green }
else { Write-Host " Python : echec creation du venv - lancez l'install a la main." -ForegroundColor Red }

# 5. Dependances npm : installees si absentes OU si package.json a change depuis
foreach ($dir in @($backNode, $proxy, $front)) {
    $temoin = Join-Path $dir "node_modules\.package-lock.json"
    if (Obsolete $temoin @((Join-Path $dir "package.json"), (Join-Path $dir "package-lock.json"))) {
        Write-Host " Mise a jour des dependances npm dans $(Split-Path $dir -Leaf)..." -ForegroundColor Yellow
        Push-Location $dir
        npm install
        Pop-Location
        if (Test-Path $temoin) { (Get-Item $temoin).LastWriteTime = Get-Date }
    }
}

# 6. Base de donnees : client Prisma regenere + structure alignee sur schema.prisma.
# "db push" plutot que "migrate deploy" : l'historique des migrations ne s'applique
# pas sur une base vide (plusieurs migrations "init" recreent les memes tables).
# Sans --accept-data-loss, db push refuse tout changement qui supprimerait des donnees.
if ($mysqlOk) {
    Write-Host " Synchronisation de la structure de la base..." -ForegroundColor DarkGray
    Push-Location $backNode
    npx prisma generate 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host " Prisma : echec de generation du client" -ForegroundColor Red }
    npx prisma db push 2>&1 | Select-String "in sync|Your database|Error|P[0-9]{4}|data loss" |
        ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -eq 0) { Write-Host " Base : structure a jour" -ForegroundColor Green }
    else { Write-Host " Base : structure non alignee - le backend risque d'echouer (voir ci-dessus)" -ForegroundColor Red }
    Pop-Location
}

Write-Host ""

# 7. Lancement des 4 serveurs
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
