$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
# Meme auto-detection que DEMARRER : a la racine du repo ou dans son dossier parent.
$app  = if (Test-Path (Join-Path $root "front")) { $root } else { Join-Path $root "lumenjuris" }

function Stop-Script($message) {
    Write-Host ""
    Write-Host " $message" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host " =============================================" -ForegroundColor Cyan
Write-Host "  LumenJuris - Proposer mes changements (PR)" -ForegroundColor Cyan
Write-Host " =============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path (Join-Path $app ".git"))) { Stop-Script "Depot de l'application introuvable a : $app" }
Set-Location $app

# 1. Sur quelle branche suis-je ?
$branche = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host " Branche : $branche" -ForegroundColor White
if ($branche -eq "main" -or $branche -eq "HEAD") {
    Stop-Script "Vous etes sur '$branche' : une pull request se fait depuis une branche de travail, pas depuis main."
}

# 2. Changements non enregistres : on previent, on ne les envoie pas a votre place.
$enCours = git status --porcelain
if ($enCours) {
    Write-Host ""
    Write-Host " Attention : ces changements ne sont pas enregistres (commit) et ne feront PAS partie de la PR :" -ForegroundColor Yellow
    $enCours | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow }
}

# 3. Envoi de la branche sur GitHub
Write-Host ""
Write-Host " Envoi de la branche sur GitHub..." -ForegroundColor DarkGray
git push -u origin $branche
if ($LASTEXITCODE -ne 0) { Stop-Script "L'envoi sur GitHub a echoue (voir le message ci-dessus)." }

# Adresse du depot GitHub (ex. lumenjuris/lumenjuris), deduite de 'origin'
$origine = (git remote get-url origin).Trim()
$depot   = $origine -replace '^.*github\.com[:/]', '' -replace '\.git$', ''

# 4. Creation de la PR : avec GitHub CLI s'il est installe et connecte,
#    sinon dans le navigateur (il reste un seul bouton a cliquer).
$gh = $null
$cmd = Get-Command gh -ErrorAction SilentlyContinue
if ($cmd) { $gh = $cmd.Source } elseif (Test-Path "C:\Program Files\GitHub CLI\gh.exe") { $gh = "C:\Program Files\GitHub CLI\gh.exe" }

$ghPret = $false
if ($gh) {
    & $gh auth status *> $null
    $ghPret = ($LASTEXITCODE -eq 0)
}

Write-Host ""
if ($ghPret) {
    # Une PR existe deja pour cette branche ? On l'ouvre au lieu d'en creer une seconde.
    & $gh pr view $branche --repo $depot --json url *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " Une pull request existe deja pour cette branche : ouverture..." -ForegroundColor Green
    } else {
        Write-Host " Creation de la pull request..." -ForegroundColor DarkGray
        & $gh pr create --repo $depot --base main --head $branche --fill
        if ($LASTEXITCODE -ne 0) { Stop-Script "La creation de la PR a echoue (voir le message ci-dessus)." }
        Write-Host " Pull request creee." -ForegroundColor Green
    }
    & $gh pr view $branche --repo $depot --web
} else {
    Write-Host " Ouverture de GitHub dans le navigateur..." -ForegroundColor Green
    Write-Host " Il reste a cliquer sur le bouton vert 'Create pull request'." -ForegroundColor Green
    Start-Process "https://github.com/$depot/compare/main...$($branche)?expand=1"
}
