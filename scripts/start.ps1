param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$url = "http://127.0.0.1:4317"
$healthUrl = "$url/api/v1/health"
$dataDirectory = Join-Path $root "data"
$stdout = Join-Path $dataDirectory "server.stdout.log"
$stderr = Join-Path $dataDirectory "server.stderr.log"

function Test-NovelStudioHealth {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
        return $response.ok -eq $true
    }
    catch {
        return $false
    }
}

if (-not (Test-Path (Join-Path $root "node_modules"))) {
    throw "Dependencies are missing. Run npm.cmd install in the project directory."
}

if (-not (Test-NovelStudioHealth)) {
    New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    Start-Process -FilePath $npm `
        -ArgumentList @("start") `
        -WorkingDirectory $root `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr | Out-Null

    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline -and -not (Test-NovelStudioHealth)) {
        Start-Sleep -Milliseconds 250
    }
}

if (-not (Test-NovelStudioHealth)) {
    throw "Novel Studio failed to start. See data/server.stderr.log."
}

if (-not $NoBrowser) {
    Start-Process $url
}

Write-Output "Novel Studio is running at $url."
