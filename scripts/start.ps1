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
$mutex = New-Object System.Threading.Mutex($false, "Local\NovelStudioStartLock")
$lockAcquired = $false

function Test-NovelStudioHealth {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
        return $response.ok -eq $true
    }
    catch {
        return $false
    }
}

function Test-NovelStudioPortInUse {
    try {
        $connections = @(Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort 4317 -State Listen -ErrorAction Stop)
        return $connections.Count -gt 0
    }
    catch {
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $connect = $client.BeginConnect("127.0.0.1", 4317, $null, $null)
            $connected = $connect.AsyncWaitHandle.WaitOne(250)
            if ($connected) {
                $client.EndConnect($connect)
            }
            $client.Close()
            return $connected
        }
        catch {
            return $false
        }
    }
}

try {
    $lockAcquired = $mutex.WaitOne([TimeSpan]::FromSeconds(30))
    if (-not $lockAcquired) {
        throw "Another Novel Studio startup is already in progress. Please wait a few seconds and try again."
    }

    if (-not (Test-Path (Join-Path $root "node_modules"))) {
        throw "Dependencies are missing. Run npm.cmd install in the project directory."
    }

    if (-not (Test-NovelStudioHealth)) {
        if (Test-NovelStudioPortInUse) {
            throw "Port 4317 is already in use, but Novel Studio did not answer the health check. Close the old process or free the port before starting again."
        }

        New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
        $pathValue = [Environment]::GetEnvironmentVariable("PATH", "Process")
        if (-not $pathValue) {
            $pathValue = [Environment]::GetEnvironmentVariable("Path", "Process")
        }
        if ($pathValue) {
            [Environment]::SetEnvironmentVariable("Path", $null, "Process")
            [Environment]::SetEnvironmentVariable("PATH", $pathValue, "Process")
        }
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
}
finally {
    if ($lockAcquired) {
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()
}
