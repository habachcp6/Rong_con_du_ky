[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipGitInit
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

function Invoke-Npm {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & npm.cmd @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "npm.cmd $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

if ($env:OS -ne "Windows_NT") {
    throw "Run this script in native Windows PowerShell, not WSL."
}

$nodeVersion = (& node.exe --version).Trim()
if ($nodeVersion -notmatch "^v24\.") {
    throw "Node 24 LTS is required by package.json. Detected $nodeVersion. Install/select Node 24, then rerun."
}

Write-Host "PowerShell: $($PSVersionTable.PSVersion)"
Write-Host "Node: $nodeVersion"
Write-Host "npm: $((& npm.cmd --version).Trim())"
Write-Host "Project: $projectRoot"

if (-not (Test-Path ".git")) {
    if ($SkipGitInit) {
        throw "No .git directory found. Restore the intended repository or rerun without -SkipGitInit."
    }

    & git.exe init -b main
    if ($LASTEXITCODE -ne 0) {
        throw "git init failed with exit code $LASTEXITCODE."
    }
}

if (-not $SkipInstall) {
    Invoke-Npm -Arguments @("ci")
}

$checks = @(
    @("run", "verify")
)

foreach ($check in $checks) {
    Invoke-Npm -Arguments $check
}

Write-Host ""
Write-Host "P0 baseline checks passed in native Windows PowerShell." -ForegroundColor Green
