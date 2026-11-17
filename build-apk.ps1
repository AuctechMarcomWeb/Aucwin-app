# ------------------------------------------------------------------
#  AucWin - one-click Android APK build (Windows)
#
#  Run from the project folder (C:\hb\harbour-mobile):
#     powershell -ExecutionPolicy Bypass -File .\build-apk.ps1
#
#  What it does, every time:
#    1. checks Java + Android SDK
#    2. fixes the Windows "long path" ninja problem automatically
#    3. creates the android folder, and re-creates it whenever the app icon,
#       splash, name or app.json changed (so the new logo really shows)
#    4. applies safe memory settings to gradle.properties
#    5. cleans old build files and builds the release APK
#    6. copies the APK to your Desktop as AucWin.apk
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
# install CMake 3.22.1 now (instead of during the build) so we can patch its ninja
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
  Write-Host "API used by the APK: $api"
} else { Write-Host "WARNING: no .env file - the app will not know your backend URL." -ForegroundColor Yellow }

if (-not (Test-Path "node_modules")) { Step "npm install"; npm install; if ($LASTEXITCODE) { Fail "npm install failed" } }
# Fingerprint of everything that goes into the native project (name, icon, splash, colours, plugins).
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
  $env:CI = "1"   # no questions during prebuild
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

# ---------- 5. clean + build ----------
Step "Cleaning old build files"
Set-Location "$root\android"
& .\gradlew.bat --stop | Out-Null
foreach ($d in @("app\.cxx", "app\build", "build", ".gradle")) {
  if (Test-Path $d) { Remove-Item -Recurse -Force $d }
}

Step "Building release APK (first time 10-30 min, please wait)"
& .\gradlew.bat assembleRelease
if ($LASTEXITCODE) { Set-Location $root; Fail "Build failed. Send the lines under '* What went wrong:'." }

# ---------- 6. copy APK ----------
$apk = "$root\android\app\build\outputs\apk\release\app-release.apk"
Set-Location $root
if (-not (Test-Path $apk)) { Fail "Build said OK but APK not found at $apk" }
$desk = [Environment]::GetFolderPath("Desktop")
Copy-Item $apk "$desk\AucWin.apk" -Force
Write-Host ""
Write-Host "DONE! APK ready:" -ForegroundColor Green
Write-Host "  $desk\AucWin.apk" -ForegroundColor Green
Write-Host "Send it to any Android phone and install it." -ForegroundColor Green
