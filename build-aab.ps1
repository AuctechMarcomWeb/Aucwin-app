# ------------------------------------------------------------------
#  AucWin - one-click Android AAB build for Google Play Console (Windows)
#
#  Run from the project folder:
#     powershell -ExecutionPolicy Bypass -File .\build-aab.ps1
#
#  Produces a SIGNED .aab (Android App Bundle) ready to upload to the
#  Google Play Console. Uses a dedicated release/upload keystore that is
#  generated ONCE and reused for every later build (so Play Console updates
#  keep working). The keystore + its password live at the project root and
#  are gitignored - DO NOT lose them, or you cannot publish updates.
#
#  Steps:
#    1. checks Java + Android SDK
#    2. fixes the Windows "long path" ninja problem automatically
#    3. creates/refreshes the android folder via expo prebuild
#    4. applies gradle.properties memory settings
#    5. generates (once) a release keystore + signs the release build with it
#    6. cleans old build files and builds the release AAB (bundleRelease)
#    7. copies the AAB to your Desktop as AucWin.aab
# ------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = $PSScriptRoot
Set-Location $root

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Fail($t) { Write-Host ""; Write-Host "ERROR: $t" -ForegroundColor Red; exit 1 }

# ---------- 1. Java + SDK ----------
Step "Checking Java and Android SDK"
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
  $jbr = "C:\Program Files\Android\Android Studio\jbr"
  if (Test-Path "$jbr\bin\java.exe") { $env:JAVA_HOME = $jbr } else { Fail "JAVA_HOME is not set (Android Studio jbr not found)." }
}
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = "$env:LOCALAPPDATA\Android\Sdk"; $env:ANDROID_HOME = $sdk }
if (-not (Test-Path $sdk)) { Fail "Android SDK not found at $sdk" }
Write-Host "JAVA_HOME    = $env:JAVA_HOME"
Write-Host "ANDROID_HOME = $sdk"

$lp = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
if ($lp -ne 1) { Write-Host "WARNING: LongPathsEnabled is not 1. Enable it (admin) and restart the PC if the build fails." -ForegroundColor Yellow }

# ---------- 2. ninja long-path fix ----------
Step "Making sure ninja supports long paths (needs 1.12+)"
$ninjaNew = Join-Path $env:TEMP "ninja-1.12.1\ninja.exe"
function Get-NewNinja {
  if (-not (Test-Path $ninjaNew)) {
    $zip = Join-Path $env:TEMP "ninja-1.12.1.zip"
    Write-Host "Downloading ninja 1.12.1 ..."
    Invoke-WebRequest "https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip" -OutFile $zip
    Expand-Archive $zip -DestinationPath (Split-Path $ninjaNew) -Force
  }
  return $ninjaNew
}
$cmakeBin = Join-Path $sdk "cmake\3.22.1\bin"
if (-not (Test-Path "$cmakeBin\ninja.exe")) {
  $sdkm = Get-ChildItem "$sdk\cmdline-tools\*\bin\sdkmanager.bat" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($sdkm) {
    Write-Host "Installing CMake 3.22.1 ..."
    "y`ny`ny`ny`ny`n" | & $sdkm.FullName --sdk_root="$sdk" "cmake;3.22.1" | Out-Null
  }
}
$ninjas = Get-ChildItem "$sdk\cmake\*\bin\ninja.exe" -ErrorAction SilentlyContinue
foreach ($n in $ninjas) {
  $v = (& $n.FullName --version) 2>$null
  if ([version]($v.Trim()) -lt [version]"1.12.0") {
    $src = Get-NewNinja
    $old = Join-Path $n.DirectoryName "ninja-old.exe"
    if (-not (Test-Path $old)) { Copy-Item $n.FullName $old }
    Copy-Item $src $n.FullName -Force
    Write-Host "Upgraded $($n.FullName): $v -> 1.12.1"
  } else {
    Write-Host "OK $($n.FullName) ($($v.Trim()))"
  }
}

# ---------- 3. API URL + android folder ----------
Step "Checking app settings"
if (Test-Path ".env") {
  $api = (Get-Content ".env" | Where-Object { $_ -match '^\s*EXPO_PUBLIC_API_URL\s*=' } | Select-Object -Last 1)
  Write-Host "API used by the AAB: $api"
} else { Write-Host "WARNING: no .env file - the app will not know your backend URL." -ForegroundColor Yellow }

if (-not (Test-Path "node_modules")) { Step "npm install"; npm install; if ($LASTEXITCODE) { Fail "npm install failed" } }
$cfgFiles = @("app.json", "package.json") + (Get-ChildItem "assets" -File -Recurse | ForEach-Object { $_.FullName })
$cfgHash = ($cfgFiles | ForEach-Object { (Get-FileHash $_ -Algorithm SHA256).Hash }) -join ""
$cfgHash = (Get-FileHash -InputStream ([IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($cfgHash))) -Algorithm SHA256).Hash
$stamp = "android\.aucwin-config"
$oldHash = if (Test-Path $stamp) { (Get-Content $stamp -Raw).Trim() } else { "" }
if (-not (Test-Path "android\gradlew.bat") -or $oldHash -ne $cfgHash) {
  if (Test-Path "android\gradlew.bat") {
    Step "App icon / name / settings changed - re-creating android folder"
    Push-Location android; & .\gradlew.bat --stop | Out-Null; Pop-Location
  } else {
    Step "Creating android folder (expo prebuild)"
  }
  $env:CI = "1"
  npx expo prebuild --platform android --clean --no-install
  Remove-Item Env:\CI -ErrorAction SilentlyContinue
  if ($LASTEXITCODE) { Fail "expo prebuild failed" }
  Set-Content $stamp $cfgHash -Encoding ascii
} else {
  Write-Host "android folder is up to date with app.json and the icons"
}

# ---------- 4. gradle.properties ----------
Step "Applying gradle.properties settings"
$gp = "android\gradle.properties"
function Set-Prop($key, $val) {
  $lines = @(Get-Content $gp)
  $found = $false
  $out = foreach ($l in $lines) {
    if ($l -match "^\s*$([regex]::Escape($key))\s*=") { $found = $true; "$key=$val" } else { $l }
  }
  $out = @($out)
  if (-not $found) { $out += "$key=$val" }
  Set-Content $gp $out -Encoding ascii
}
Set-Prop "org.gradle.jvmargs" "-Xmx3072m -XX:MaxMetaspaceSize=512m"
Set-Prop "org.gradle.parallel" "false"
Set-Prop "reactNativeArchitectures" "armeabi-v7a,arm64-v8a"

# ---------- 5. release keystore + signing ----------
Step "Setting up release keystore + signing"
$keystorePath = Join-Path $root "release.keystore"
$credsPath    = Join-Path $root ".keystore.properties"
$alias = "release"

# Guard: keystore exists but creds missing -> we cannot recover the password.
if ((Test-Path $keystorePath) -and -not (Test-Path $credsPath)) {
  Fail "release.keystore exists but .keystore.properties (its password) is missing. Restore .keystore.properties from a backup, or delete release.keystore to regenerate (NOT allowed if the app is already published on Play Console)."
}

# Recover existing credentials, or generate new ones.
if (Test-Path $credsPath) {
  $props = @{}
  Get-Content $credsPath | ForEach-Object {
    if ($_ -match '^\s*([^=]+)\s*=\s*(.*)$') { $props[$matches[1].Trim()] = $matches[2].Trim() }
  }
  $storePw = $props['storePassword']
  $keyPw   = $props['keyPassword']
  $alias   = if ($props['keyAlias']) { $props['keyAlias'] } else { 'release' }
  Write-Host "Reusing saved keystore credentials from .keystore.properties"
} else {
  $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  $pw = -join (1..24 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
  $storePw = $pw
  $keyPw = $pw
}

# Generate the keystore once (never overwrite an existing one!).
if (-not (Test-Path $keystorePath)) {
  Step "Generating release keystore (first time only)"
  $keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
  if (-not (Test-Path $keytool)) { Fail "keytool not found at $keytool" }
  & $keytool -genkeypair -v -storetype PKCS12 -keystore $keystorePath -alias $alias `
    -keyalg RSA -keysize 2048 -validity 10950 -storepass $storePw -keypass $keyPw `
    -dname "CN=AucWin, OU=Mobile, O=Auctech Marcom, L=Mumbai, ST=Maharashtra, C=IN"
  if ($LASTEXITCODE) { Fail "keytool keystore generation failed" }
  Write-Host "Keystore created: $keystorePath" -ForegroundColor Green
  Write-Host "  alias:    $alias" -ForegroundColor Green
  Write-Host "  password: $storePw" -ForegroundColor Green
  Write-Host "  (also saved to .keystore.properties)" -ForegroundColor Green
}

# Persist credentials so future builds reuse the exact same keystore.
if (-not (Test-Path $credsPath)) {
  $keystoreFwd = $keystorePath -replace '\\','/'
  Set-Content $credsPath @"
storePassword=$storePw
keyPassword=$keyPw
keyAlias=$alias
keystore=$keystoreFwd
"@ -Encoding ascii
}

# Patch android\app\build.gradle so the release variant signs with our keystore.
Step "Patching android\app\build.gradle signing config"
$bg = Join-Path $root "android\app\build.gradle"
$c = [IO.File]::ReadAllText($bg)
$c = $c -replace "`r`n","`n"
$keystoreFwd = $keystorePath -replace '\\','/'

# 5a. Add a 'release' signingConfig after the debug one (idempotent).
if ($c -notlike "*keyAlias '$alias'*") {
  $debugBlock = "        debug {`n            storeFile file('debug.keystore')`n            storePassword 'android'`n            keyAlias 'androiddebugkey'`n            keyPassword 'android'`n        }"
  $releaseCfg = $debugBlock + "`n        release {`n            storeFile file('$keystoreFwd')`n            storePassword '$storePw'`n            keyAlias '$alias'`n            keyPassword '$keyPw'`n        }"
  if ($c.Contains($debugBlock)) {
    $c = $c.Replace($debugBlock, $releaseCfg)
    Write-Host "Added release signingConfig"
  } else {
    Write-Host "WARNING: could not find debug signing block to extend; signing may fall back to debug." -ForegroundColor Yellow
  }
} else {
  Write-Host "release signingConfig already present"
}

# 5b. Point the release build type at signingConfigs.release (idempotent).
if ($c -notlike "*signingConfig signingConfigs.release*") {
  $oldRel = "// see https://reactnative.dev/docs/signed-apk-android.`n            signingConfig signingConfigs.debug"
  $newRel = "// see https://reactnative.dev/docs/signed-apk-android.`n            signingConfig signingConfigs.release"
  if ($c.Contains($oldRel)) {
    $c = $c.Replace($oldRel, $newRel)
    Write-Host "Release build type now signs with signingConfigs.release"
  } else {
    Write-Host "WARNING: could not find release buildType signing line to patch." -ForegroundColor Yellow
  }
} else {
  Write-Host "Release build type already uses signingConfigs.release"
}
[IO.File]::WriteAllText($bg, $c)

# ---------- 6. clean + build AAB ----------
Step "Cleaning old build files"
Set-Location "$root\android"
& .\gradlew.bat --stop | Out-Null
foreach ($d in @("app\.cxx", "app\build", "build", ".gradle")) {
  if (Test-Path $d) { Remove-Item -Recurse -Force $d }
}

Step "Building release AAB (first time 10-30 min, please wait)"
& .\gradlew.bat bundleRelease
if ($LASTEXITCODE) { Set-Location $root; Fail "Build failed. Send the lines under '* What went wrong:'." }

# ---------- 7. copy AAB ----------
$aab = "$root\android\app\build\outputs\bundle\release\app-release.aab"
Set-Location $root
if (-not (Test-Path $aab)) { Fail "Build said OK but AAB not found at $aab" }
$desk = [Environment]::GetFolderPath("Desktop")
Copy-Item $aab "$desk\AucWin.aab" -Force
Write-Host ""
Write-Host "DONE! AAB ready:" -ForegroundColor Green
Write-Host "  $desk\AucWin.aab" -ForegroundColor Green
Write-Host "Upload it to Google Play Console." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT:" -ForegroundColor Yellow
Write-Host "  - Keep 'release.keystore' and '.keystore.properties' safe. If you lose them," -ForegroundColor Yellow
Write-Host "    you cannot publish updates to this app on Play Console." -ForegroundColor Yellow
Write-Host "  - On first upload, Play Console offers 'Play App Signing'. Choose" -ForegroundColor Yellow
Write-Host "    'Use Google-generated key' (recommended) - Google signs the final APK;" -ForegroundColor Yellow
Write-Host "    your release.keystore stays your upload key." -ForegroundColor Yellow
Write-Host "  - For the next version, bump versionCode/versionName in app.json before rebuilding." -ForegroundColor Yellow
