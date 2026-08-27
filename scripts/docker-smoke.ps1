[CmdletBinding()]
param(
    [string]$Image = "rong-con-du-ky:local",
    [int]$HostPort = 8080
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$container = "rong-con-du-ky-smoke"

$nodePlatform = (& node -p "process.platform").Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Could not determine the Node.js platform with 'node -p process.platform'."
}
if ($nodePlatform -ne "win32") {
    throw "This smoke script must be launched from native Windows PowerShell. node -p process.platform returned '$nodePlatform'."
}

if ($HostPort -lt 1 -or $HostPort -gt 65535) {
    throw "HostPort must be between 1 and 65535."
}

Write-Host "Building $Image..."
docker build --tag $Image .
if ($LASTEXITCODE -ne 0) { throw "docker build failed." }

try { docker rm --force $container 2>&1 | Out-Null } catch {}
Write-Host "Starting $container on http://127.0.0.1:$HostPort ..."
$containerId = docker run --detach --name $container --publish "$HostPort`:8080" --env NODE_ENV=production --env PORT=8080 $Image
if ($LASTEXITCODE -ne 0) { throw "docker run failed." }

try {
    $health = $null
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$HostPort/api/health" -TimeoutSec 3
            break
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }

    if ($null -eq $health -or $health.status -ne "ok") {
        docker logs $container
        throw "Container health check did not become ready."
    }

    $shell = Invoke-WebRequest -Uri "http://127.0.0.1:$HostPort/" -UseBasicParsing
    $privacy = Invoke-WebRequest -Uri "http://127.0.0.1:$HostPort/privacy" -UseBasicParsing
    if ($shell.StatusCode -ne 200 -or $privacy.StatusCode -ne 200) {
        throw "SPA/legal smoke failed: /=$($shell.StatusCode), /privacy=$($privacy.StatusCode)."
    }

    Write-Host "Docker smoke PASS" -ForegroundColor Green
    Write-Host ($health | ConvertTo-Json -Compress)
    Write-Host "Open http://127.0.0.1:$HostPort/ to test the game."
}
finally {
    try { docker rm --force $container 2>&1 | Out-Null } catch {}
}
