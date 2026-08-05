[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$HostPort = 18080,

    [ValidateRange(10, 600)]
    [int]$HealthTimeoutSeconds = 120
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Restore-ProcessEnvironmentVariable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [AllowNull()]
        $Value
    )

    if ($null -eq $Value) {
        Remove-Item -Path "Env:$Name" -ErrorAction SilentlyContinue
        return
    }

    Set-Item -Path "Env:$Name" -Value $Value
}

$nodePlatform = (& node -p "process.platform").Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Could not determine the Node.js platform with 'node -p process.platform'."
}

if ($nodePlatform -ne "win32") {
    throw "This runner must be launched from native Windows PowerShell. node -p process.platform returned '$nodePlatform'."
}

# Keep this runtime gate aligned with package.json's engines.node = 24.x. npm
# can otherwise emit only a warning for a mismatched local Node version, which
# would make the generated Docker/Playwright evidence non-representative.
$nodeVersion = (& node -p "process.versions.node").Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Could not determine the Node.js version with 'node -p process.versions.node'."
}

if ($nodeVersion -notmatch "^24\.") {
    throw "This runner requires Node.js 24.x from package.json. node -p process.versions.node returned '$nodeVersion'."
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $repositoryRoot "compose.yaml"
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw "compose.yaml was not found at $composeFile."
}

$runId = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
$artifactRoot = Join-Path $repositoryRoot (Join-Path "test-results\native-docker-e2e" $runId)
$testResultsDirectory = Join-Path $artifactRoot "test-results"
$htmlReportDirectory = Join-Path $artifactRoot "playwright-report"
$baseUrl = "http://127.0.0.1:$HostPort"
$healthUrl = "$baseUrl/api/health"
$previousAppPort = [Environment]::GetEnvironmentVariable("APP_PORT", "Process")
$previousPlaywrightBaseUrl = [Environment]::GetEnvironmentVariable(
    "PLAYWRIGHT_BASE_URL",
    "Process"
)
$previousPlaywrightHtmlOutputDir = [Environment]::GetEnvironmentVariable(
    "PLAYWRIGHT_HTML_OUTPUT_DIR",
    "Process"
)
$previousPlaywrightCaptureVideo = [Environment]::GetEnvironmentVariable(
    "PLAYWRIGHT_CAPTURE_VIDEO",
    "Process"
)
$previousViteEnableE2eBridge = [Environment]::GetEnvironmentVariable(
    "VITE_ENABLE_E2E_BRIDGE",
    "Process"
)
$previousPlaywrightProductionE2e = [Environment]::GetEnvironmentVariable(
    "PLAYWRIGHT_PRODUCTION_E2E",
    "Process"
)
$previousViteApiBaseUrl = [Environment]::GetEnvironmentVariable(
    "VITE_API_BASE_URL",
    "Process"
)
$previousViteFirebaseApiKey = [Environment]::GetEnvironmentVariable(
    "VITE_FIREBASE_API_KEY",
    "Process"
)
$previousViteFirebaseAuthDomain = [Environment]::GetEnvironmentVariable(
    "VITE_FIREBASE_AUTH_DOMAIN",
    "Process"
)
$previousViteFirebaseProjectId = [Environment]::GetEnvironmentVariable(
    "VITE_FIREBASE_PROJECT_ID",
    "Process"
)
$previousViteFirebaseAppId = [Environment]::GetEnvironmentVariable(
    "VITE_FIREBASE_APP_ID",
    "Process"
)
$previousViteUseFirebaseEmulators = [Environment]::GetEnvironmentVariable(
    "VITE_USE_FIREBASE_EMULATORS",
    "Process"
)
$previousViteFirebaseAuthEmulatorUrl = [Environment]::GetEnvironmentVariable(
    "VITE_FIREBASE_AUTH_EMULATOR_URL",
    "Process"
)
$previousViteFirebaseFirestoreEmulatorHost = [Environment]::GetEnvironmentVariable(
    "VITE_FIREBASE_FIRESTORE_EMULATOR_HOST",
    "Process"
)
$previousViteFirebaseFirestoreEmulatorPort = [Environment]::GetEnvironmentVariable(
    "VITE_FIREBASE_FIRESTORE_EMULATOR_PORT",
    "Process"
)
$previousGeminiApiKey = [Environment]::GetEnvironmentVariable(
    "GEMINI_API_KEY",
    "Process"
)
$previousGoogleMapsApiKey = [Environment]::GetEnvironmentVariable(
    "GOOGLE_MAPS_API_KEY",
    "Process"
)
$playwrightExitCode = $null

New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null

Push-Location $repositoryRoot
try {
    & docker compose version
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose is required for the native Docker E2E run."
    }

    $env:APP_PORT = [string]$HostPort
    $env:PLAYWRIGHT_BASE_URL = $baseUrl
    $env:PLAYWRIGHT_HTML_OUTPUT_DIR = $htmlReportDirectory
    $env:PLAYWRIGHT_CAPTURE_VIDEO = "true"
    # Production-container E2E is always black-box. Do not inherit a developer
    # bridge flag, external API base URL, Firebase configuration/emulator, or
    # provider keys from the PowerShell session into the deterministic fallback
    # artifact. Firebase/provider checks are deliberately separate opt-in gates.
    $env:VITE_ENABLE_E2E_BRIDGE = "false"
    $env:PLAYWRIGHT_PRODUCTION_E2E = "true"
    $env:VITE_API_BASE_URL = "/api"
    $env:VITE_FIREBASE_API_KEY = ""
    $env:VITE_FIREBASE_AUTH_DOMAIN = ""
    $env:VITE_FIREBASE_PROJECT_ID = ""
    $env:VITE_FIREBASE_APP_ID = ""
    $env:VITE_USE_FIREBASE_EMULATORS = "false"
    $env:VITE_FIREBASE_AUTH_EMULATOR_URL = ""
    $env:VITE_FIREBASE_FIRESTORE_EMULATOR_HOST = ""
    $env:VITE_FIREBASE_FIRESTORE_EMULATOR_PORT = ""
    $env:GEMINI_API_KEY = ""
    $env:GOOGLE_MAPS_API_KEY = ""

    Write-Host "Starting Docker Compose with APP_PORT=$env:APP_PORT ..."
    & docker compose up --build -d
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up --build -d failed. Compose is intentionally not stopped by this script."
    }

    $health = $null
    $healthReady = $false
    $healthDeadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
    while ((Get-Date) -lt $healthDeadline) {
        try {
            $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 5
            if (
                $null -ne $health -and
                $null -ne $health.PSObject.Properties["status"] -and
                $health.status -eq "ok"
            ) {
                $healthReady = $true
                break
            }
        }
        catch {
            # The service is still starting; retry until the deadline below.
        }

        Start-Sleep -Seconds 2
    }

    if (-not $healthReady) {
        & docker compose ps | Tee-Object -FilePath (Join-Path $artifactRoot "docker-compose-ps-timeout.txt")
        & docker compose logs --tail 100 app | Tee-Object -FilePath (Join-Path $artifactRoot "docker-compose-app-timeout.log")
        throw "Health endpoint did not return status 'ok' before the $HealthTimeoutSeconds-second deadline: $healthUrl"
    }

    $health | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $artifactRoot "health.json") -Encoding utf8
    & docker compose ps | Tee-Object -FilePath (Join-Path $artifactRoot "docker-compose-ps.txt")
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose ps failed after the health check."
    }

    Write-Host "Health check passed: $healthUrl (saved to $artifactRoot\\health.json)"
    Write-Host "Running one-worker Playwright E2E against $env:PLAYWRIGHT_BASE_URL ..."
    & npx --no-install playwright test `
        "--output=$testResultsDirectory" `
        "--project=chromium-desktop" `
        "--project=chromium-mobile" `
        "--workers=1"
    $playwrightExitCode = $LASTEXITCODE

    if ($playwrightExitCode -ne 0) {
        throw "Containerized Playwright failed with exit code $playwrightExitCode."
    }

    Write-Host "Native Docker E2E PASS" -ForegroundColor Green
}
catch {
    # Preserve the container-side context next to Playwright's trace, video
    # and screenshot artifacts. The commands are best effort: their failure
    # must not hide the original health/E2E failure that triggered this block.
    $releaseFailure = $_
    try {
        & docker compose ps |
            Tee-Object -FilePath (Join-Path $artifactRoot "docker-compose-ps-failure.txt")
    }
    catch {
        Write-Warning "Could not capture docker compose ps after the release failure."
    }
    try {
        & docker compose logs --tail 200 app |
            Tee-Object -FilePath (Join-Path $artifactRoot "docker-compose-app-failure.log")
    }
    catch {
        Write-Warning "Could not capture app logs after the release failure."
    }
    throw $releaseFailure
}
finally {
    Restore-ProcessEnvironmentVariable -Name "APP_PORT" -Value $previousAppPort
    Restore-ProcessEnvironmentVariable -Name "PLAYWRIGHT_BASE_URL" -Value $previousPlaywrightBaseUrl
    Restore-ProcessEnvironmentVariable `
        -Name "PLAYWRIGHT_HTML_OUTPUT_DIR" `
        -Value $previousPlaywrightHtmlOutputDir
    Restore-ProcessEnvironmentVariable `
        -Name "PLAYWRIGHT_CAPTURE_VIDEO" `
        -Value $previousPlaywrightCaptureVideo
    Restore-ProcessEnvironmentVariable `
        -Name "VITE_ENABLE_E2E_BRIDGE" `
        -Value $previousViteEnableE2eBridge
    Restore-ProcessEnvironmentVariable `
        -Name "PLAYWRIGHT_PRODUCTION_E2E" `
        -Value $previousPlaywrightProductionE2e
    Restore-ProcessEnvironmentVariable `
        -Name "VITE_API_BASE_URL" `
        -Value $previousViteApiBaseUrl
    Restore-ProcessEnvironmentVariable `
        -Name "VITE_FIREBASE_API_KEY" `
        -Value $previousViteFirebaseApiKey
    Restore-ProcessEnvironmentVariable `
        -Name "VITE_FIREBASE_AUTH_DOMAIN" `
        -Value $previousViteFirebaseAuthDomain
    Restore-ProcessEnvironmentVariable `
        -Name "VITE_FIREBASE_PROJECT_ID" `
        -Value $previousViteFirebaseProjectId
    Restore-ProcessEnvironmentVariable `
        -Name "VITE_FIREBASE_APP_ID" `
        -Value $previousViteFirebaseAppId
    Restore-ProcessEnvironmentVariable `
        -Name "VITE_USE_FIREBASE_EMULATORS" `
        -Value $previousViteUseFirebaseEmulators
    Restore-ProcessEnvironmentVariable `
        -Name "VITE_FIREBASE_AUTH_EMULATOR_URL" `
        -Value $previousViteFirebaseAuthEmulatorUrl
    Restore-ProcessEnvironmentVariable `
        -Name "VITE_FIREBASE_FIRESTORE_EMULATOR_HOST" `
        -Value $previousViteFirebaseFirestoreEmulatorHost
    Restore-ProcessEnvironmentVariable `
        -Name "VITE_FIREBASE_FIRESTORE_EMULATOR_PORT" `
        -Value $previousViteFirebaseFirestoreEmulatorPort
    Restore-ProcessEnvironmentVariable `
        -Name "GEMINI_API_KEY" `
        -Value $previousGeminiApiKey
    Restore-ProcessEnvironmentVariable `
        -Name "GOOGLE_MAPS_API_KEY" `
        -Value $previousGoogleMapsApiKey
    Pop-Location

    Write-Host "Compose is still running for review at $baseUrl."
    Write-Host "Artifacts: $artifactRoot"
    Write-Host "Stop Compose manually from the repository root after review."
}
