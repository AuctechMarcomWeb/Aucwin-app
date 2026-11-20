# ------------------------------------------------------------------
#  AucWin - Upload Key Reset helper
#  Use ONLY if release.keystore is LOST or compromised.
#
#  Prerequisite: Play App Signing must be ON with a Google-generated
#  app signing key. This is the default for new .aab apps and is what
#  you chose on first upload ("Use Google-generated key"). If you opted
#  out and manage your own signing key, a lost key CANNOT be recovered
#  and this script will not help.
#
#  What this does:
#    1. Generates a BRAND NEW upload keystore (release.keystore)
#    2. Exports its certificate to upload_certificate.pem
#    3. Updates .keystore.properties with the new password
#    4. Prints the Play Console steps to finish the reset
#
#  Run:
#     powershell -ExecutionPolicy Bypass -File .\reset-upload-key.ps1
# ------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

function Step($t){ Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Fail($t){ Write-Host ""; Write-Host "ERROR: $t" -ForegroundColor Red; exit 1 }

# ---------- find keytool ----------
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\keytool.exe")) {
  $candidates = @(
    "C:\Program Files\Android\Android Studio\jbr",
    "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path "$c\bin\keytool.exe")) { $env:JAVA_HOME = $c; break }
  }
}
$keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
if (-not (Test-Path $keytool)) { Fail "keytool not found. Set JAVA_HOME to your JDK install." }

Write-Host "WARNING: This generates a NEW upload keystore." -ForegroundColor Yellow
Write-Host "Only run this if the old release.keystore is LOST or compromised." -ForegroundColor Yellow
Write-Host "After this you MUST request an upload key reset in Play Console and" -ForegroundColor Yellow
Write-Host "wait for Google to approve it before uploading any new release." -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Type RESET to continue"
if ($confirm -ne "RESET") { Write-Host "Cancelled."; exit 0 }

$alias     = "release"
$keystore  = Join-Path $root "release.keystore"
$creds     = Join-Path $root ".keystore.properties"
$pem       = Join-Path $root "upload_certificate.pem"

# new strong password
$chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
$pw = -join (1..24 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })

# back up an existing keystore if present (just in case it is the compromised one)
if (Test-Path $keystore) {
  Step "Backing up existing release.keystore"
  Copy-Item $keystore "$keystore.old.$(Get-Date -Format yyyyMMddHHmmss)" -Force
  Write-Host "Old keystore backed up with a timestamp suffix." -ForegroundColor Yellow
}

# ---------- 1. new keystore ----------
Step "Generating new upload keystore"
if (Test-Path $keystore) { Remove-Item $keystore -Force }
& $keytool -genkeypair -v -storetype PKCS12 -keystore $keystore -alias $alias `
  -keyalg RSA -keysize 2048 -validity 10950 -storepass $pw -keypass $pw `
  -dname "CN=AucWin, OU=Mobile, O=Auctech Marcom, L=Mumbai, ST=Maharashtra, C=IN"
if ($LASTEXITCODE) { Fail "keytool keystore generation failed" }

# ---------- 2. export PEM certificate ----------
Step "Exporting upload certificate (PEM) for Play Console"
if (Test-Path $pem) { Remove-Item $pem -Force }
& $keytool -export -rfc -keystore $keystore -alias $alias -file $pem -storepass $pw
if ($LASTEXITCODE) { Fail "PEM export failed" }

# ---------- 3. save credentials ----------
Step "Saving credentials"
$keystoreFwd = $keystore -replace '\\','/'
Set-Content $creds @"
storePassword=$pw
keyPassword=$pw
keyAlias=$alias
keystore=$keystoreFwd
"@ -Encoding ascii

Write-Host ""
Write-Host "DONE. New keystore + PEM created." -ForegroundColor Green
Write-Host "  Keystore:  $keystore"
Write-Host "  PEM cert:  $pem   <-- upload THIS file to Play Console"
Write-Host "  Password:  $pw"
Write-Host "  Alias:     $alias"
Write-Host ""
Write-Host "=== NEXT: finish the reset in Play Console ===" -ForegroundColor Cyan
Write-Host "1. https://play.google.com/console  ->  select your app"
Write-Host "2. Protected with Play  ->  Play Store protection  ->  Manage Play app signing"
Write-Host "3. In the 'Upload key certificate' section  ->  'Request upload key reset'"
Write-Host "4. Enter a reason (e.g. 'lost upload keystore')"
Write-Host "5. Upload upload_certificate.pem  ->  Request"
Write-Host "6. Wait for Google's approval (email + Console notification)"
Write-Host "7. After approval: bump versionCode/versionName in app.json,"
Write-Host "   run build-aab.ps1 (now uses the NEW keystore), upload the new .aab"
