param(
    [switch]$NoBrowser,
    [switch]$SkipBuild,
    [switch]$ReuseExisting,
    [switch]$Wait,
    [switch]$Foreground,
    [switch]$SmokeTest,
    [switch]$Stop,
    [string]$LibraryRoot
)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$root = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path
$hostName = "127.0.0.1"
$port = 4317
$url = "http://${hostName}:${port}"
$healthUrl = "$url/api/v1/health"
$dataDirectory = Join-Path $root "data"
$stdout = Join-Path $dataDirectory "server.stdout.log"
$stderr = Join-Path $dataDirectory "server.stderr.log"
$pidFile = Join-Path $dataDirectory "server.pid.json"
$fallbackDataDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "novel-studio"
$serverEntry = Join-Path $root "apps\server\dist\index.js"
$startupMutex = New-Object System.Threading.Mutex($false, "Local\NovelStudioStartLock")
$lockAcquired = $false

function Resolve-OptionalPath {
    param([string]$PathValue)

    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return $null
    }

    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $root $PathValue))
}

function Get-CurrentCommit {
    try {
        $commit = & git -C $root rev-parse --short=12 HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $commit) {
            return (($commit | Select-Object -First 1).ToString().Trim())
        }
    }
    catch {
    }
    return $null
}

function Get-PackageVersion {
    try {
        $packageJson = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $root "package.json") | ConvertFrom-Json
        if ($packageJson.version) {
            return $packageJson.version
        }
    }
    catch {
    }
    return "0.1.0"
}

function Get-NodeExe {
    try {
        return (Get-Command node.exe -ErrorAction Stop).Source
    }
    catch {
        throw "Node.js was not found on PATH. Install Node.js or open a shell where node.exe is available."
    }
}

function Get-NpmCmd {
    try {
        return (Get-Command npm.cmd -ErrorAction Stop).Source
    }
    catch {
        throw "npm.cmd was not found on PATH. Install Node.js/npm or open a shell where npm.cmd is available."
    }
}

function Get-JsonProperty {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if ($null -eq $Object) {
        return $null
    }
    $property = $Object.PSObject.Properties[$Name]
    if ($property) {
        return $property.Value
    }
    return $null
}

function Get-NovelStudioHealth {
    try {
        return Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1 -ErrorAction Stop
    }
    catch {
        return $null
    }
}

function Test-HealthMatchesWorkspace {
    param($Health)

    if ($null -eq $Health -or (Get-JsonProperty $Health "ok") -ne $true) {
        return $false
    }

    $workspaceRoot = Get-JsonProperty $Health "workspaceRoot"
    if (-not $workspaceRoot) {
        return $false
    }

    try {
        return (Resolve-Path $workspaceRoot).Path -eq $root
    }
    catch {
        return $false
    }
}

function Test-HealthMatchesCurrentRun {
    param($Health)

    if (-not (Test-HealthMatchesWorkspace -Health $Health)) {
        return $false
    }

    if ($currentCommit) {
        $reportedCommit = Get-JsonProperty $Health "commit"
        if (-not $reportedCommit -or $reportedCommit -ne $currentCommit) {
            return $false
        }
    }

    return $true
}

function Get-PortOwnerProcessIds {
    $owners = @()
    try {
        $connections = @(Get-NetTCPConnection -LocalAddress $hostName -LocalPort $port -State Listen -ErrorAction Stop)
        $owners += @($connections | ForEach-Object { $_.OwningProcess } | Where-Object { $_ -gt 0 })
    }
    catch {
    }

    if ($owners.Count -eq 0) {
        try {
            $escapedEndpoint = [regex]::Escape("${hostName}:$port")
            foreach ($line in @(& netstat -ano | Select-String -Pattern $escapedEndpoint)) {
                $text = $line.ToString().Trim()
                if ($text -match "\sLISTENING\s+(\d+)$") {
                    $owners += [int]$Matches[1]
                }
            }
        }
        catch {
        }
    }

    return @($owners | Where-Object { $_ -gt 0 } | Sort-Object -Unique)
}

function Test-NovelStudioPortInUse {
    if (@(Get-PortOwnerProcessIds).Count -gt 0) {
        return $true
    }

    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $connect = $client.BeginConnect($hostName, $port, $null, $null)
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

function Get-ProcessCommandLine {
    param([Parameter(Mandatory = $true)][int]$ProcessId)

    try {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
        return [string]$processInfo.CommandLine
    }
    catch {
        return ""
    }
}

function Test-ProcessLooksLikeThisCheckout {
    param([Parameter(Mandatory = $true)][int]$ProcessId)

    $commandLine = Get-ProcessCommandLine -ProcessId $ProcessId
    if ([string]::IsNullOrWhiteSpace($commandLine)) {
        return $false
    }

    return $commandLine.ToLowerInvariant().Contains($root.ToLowerInvariant())
}

function Get-RecordedServerPids {
    $records = @()
    $candidateFiles = @()

    foreach ($path in @($pidFile)) {
        if (Test-Path -LiteralPath $path) {
            $candidateFiles += Get-Item -LiteralPath $path
        }
    }

    foreach ($directory in @($dataDirectory, $fallbackDataDirectory)) {
        if (Test-Path -LiteralPath $directory) {
            $candidateFiles += @(Get-ChildItem -LiteralPath $directory -Filter "server.*.pid.json" -File -ErrorAction SilentlyContinue)
        }
    }

    foreach ($file in @($candidateFiles | Sort-Object FullName -Unique)) {
        try {
            $state = Get-Content -Encoding UTF8 -Raw -LiteralPath $file.FullName | ConvertFrom-Json
            foreach ($name in @("serverPid", "starterPid")) {
                $value = Get-JsonProperty $state $name
                if ($value) {
                    $records += [int]$value
                }
            }
            $portOwnerPids = Get-JsonProperty $state "portOwnerPids"
            if ($portOwnerPids) {
                $portOwnerPids | ForEach-Object { $records += [int]$_ }
            }
        }
        catch {
        }
    }

    return @($records | Sort-Object -Unique)
}

function Stop-ProcessIfRunning {
    param([Parameter(Mandatory = $true)][int]$ProcessId)

    try {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        Write-Output "Stopping Novel Studio process PID ${ProcessId}: $(Get-ProcessCommandLine -ProcessId $ProcessId)"
        Stop-Process -Id $ProcessId -Force -ErrorAction Stop
        $process.WaitForExit(5000) | Out-Null
    }
    catch {
    }
}

function Stop-LocalNovelStudio {
    $health = Get-NovelStudioHealth
    $healthMatchesWorkspace = Test-HealthMatchesWorkspace -Health $health
    $recorded = @(Get-RecordedServerPids)
    $portOwners = @(Get-PortOwnerProcessIds)
    $blocked = @()

    foreach ($owner in $portOwners) {
        $looksLocal = Test-ProcessLooksLikeThisCheckout -ProcessId $owner
        $isRecorded = $recorded -contains $owner

        if ($healthMatchesWorkspace -or $looksLocal -or $isRecorded) {
            Stop-ProcessIfRunning -ProcessId $owner
        }
        else {
            $blocked += "PID ${owner}: $(Get-ProcessCommandLine -ProcessId $owner)"
        }
    }

    foreach ($recordedPid in @($recorded | Where-Object { $portOwners -notcontains $_ })) {
        if (Test-ProcessLooksLikeThisCheckout -ProcessId $recordedPid) {
            Stop-ProcessIfRunning -ProcessId $recordedPid
        }
    }

    if ($blocked.Count -gt 0) {
        throw "Port $port is in use, but the owner does not look like this Novel Studio checkout. Refusing to stop it automatically. Owners: $($blocked -join '; ')"
    }

    $deadline = (Get-Date).AddSeconds(5)
    while ((Get-Date) -lt $deadline -and @(Get-PortOwnerProcessIds).Count -gt 0) {
        Start-Sleep -Milliseconds 200
    }

    $remainingOwners = @(Get-PortOwnerProcessIds)
    if ($remainingOwners.Count -gt 0) {
        throw "Port $port still has listening process(es): $($remainingOwners -join ', ')"
    }
}

function Invoke-ProjectBuild {
    if ($SkipBuild) {
        Write-Output "Skipping production build because -SkipBuild was provided."
        return
    }

    Write-Output "Building current Novel Studio checkout before startup..."
    $npm = Get-NpmCmd
    & $npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Production build failed; server was not started."
    }
}

function Clear-StartupArtifacts {
    $blockedPaths = @()
    foreach ($path in @($stdout, $stderr, $pidFile)) {
        try {
            if (Test-Path -LiteralPath $path) {
                Remove-Item -LiteralPath $path -Force -ErrorAction Stop
            }
        }
        catch {
            $blockedPaths += $path
        }
    }

    if ($blockedPaths.Count -gt 0) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
        New-Item -ItemType Directory -Path $fallbackDataDirectory -Force | Out-Null
        $script:stdout = Join-Path $fallbackDataDirectory "server.${stamp}.stdout.log"
        $script:stderr = Join-Path $fallbackDataDirectory "server.${stamp}.stderr.log"
        $script:pidFile = Join-Path $fallbackDataDirectory "server.${stamp}.pid.json"
        Write-Output "Fixed startup artifacts are locked; using per-run startup state in $fallbackDataDirectory."
    }
}

function New-ServerProcessInfo {
    $node = Get-NodeExe
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $node
    $psi.Arguments = "`"$serverEntry`""
    $psi.WorkingDirectory = $root
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    return $psi
}

function Start-ServerDetached {
    Clear-StartupArtifacts
    $env:NODE_ENV = "production"
    $env:NOVEL_STUDIO_VERSION = $packageVersion
    $env:NOVEL_STUDIO_COMMIT = $currentCommit
    $env:NOVEL_STUDIO_STARTED_AT = $startedAt
    $env:NOVEL_STUDIO_WORKSPACE_ROOT = $root
    if ($effectiveLibraryRoot) {
        $env:NOVEL_STUDIO_LIBRARY = $effectiveLibraryRoot
    }
    else {
        Remove-Item Env:\NOVEL_STUDIO_LIBRARY -ErrorAction SilentlyContinue
    }

    $psi = New-ServerProcessInfo
    $server = [System.Diagnostics.Process]::Start($psi)

    return $server
}

function Wait-HealthyServer {
    param([Parameter(Mandatory = $true)]$Server)

    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        if ($Server.HasExited) {
            throw "Novel Studio server exited before it became healthy. Exit code: $($Server.ExitCode)"
        }

        $health = Get-NovelStudioHealth
        if (Test-HealthMatchesCurrentRun -Health $health) {
            return $health
        }

        Start-Sleep -Milliseconds 300
    }

    throw "Novel Studio did not become healthy within 20 seconds."
}

function Save-ServerPidState {
    param([Parameter(Mandatory = $true)][int]$ServerPid)

    try {
        New-Item -ItemType Directory -Path (Split-Path -Parent $pidFile) -Force | Out-Null
        $state = [ordered]@{
            serverPid = $ServerPid
            portOwnerPids = @(Get-PortOwnerProcessIds)
            commit = $currentCommit
            workspaceRoot = $root
            libraryRoot = $effectiveLibraryRoot
            startedAt = $startedAt
            url = $url
        }
        $state | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath $pidFile
    }
    catch {
        Write-Warning "Could not write server pid state: $($_.Exception.Message)"
    }
}

function Write-HealthSummary {
    param($Health)

    Write-Output "Novel Studio is running at $url."
    if ($null -ne $Health) {
        Write-Output ("Health: version={0} commit={1} startedAt={2}" -f `
            (Get-JsonProperty $Health "version"), `
            (Get-JsonProperty $Health "commit"), `
            (Get-JsonProperty $Health "startedAt"))
        Write-Output ("Health: workspaceRoot={0}" -f (Get-JsonProperty $Health "workspaceRoot"))
        Write-Output ("Health: libraryRoot={0}" -f (Get-JsonProperty $Health "libraryRoot"))
    }
}

function Open-Browser {
    if ($NoBrowser) {
        return
    }

    try {
        & cmd.exe /c start "" $url | Out-Null
    }
    catch {
        Write-Warning "Could not open browser automatically: $($_.Exception.Message)"
    }
}

function Start-ForegroundServer {
    $node = Get-NodeExe
    $env:NODE_ENV = "production"
    $env:NOVEL_STUDIO_VERSION = $packageVersion
    $env:NOVEL_STUDIO_COMMIT = $currentCommit
    $env:NOVEL_STUDIO_STARTED_AT = $startedAt
    $env:NOVEL_STUDIO_WORKSPACE_ROOT = $root
    if ($effectiveLibraryRoot) {
        $env:NOVEL_STUDIO_LIBRARY = $effectiveLibraryRoot
    }
    else {
        Remove-Item Env:\NOVEL_STUDIO_LIBRARY -ErrorAction SilentlyContinue
    }

    Write-Output "Starting Novel Studio in the foreground at $url. Stop this command to stop the server."
    & $node $serverEntry
    exit $LASTEXITCODE
}

try {
    $lockAcquired = $startupMutex.WaitOne([TimeSpan]::FromSeconds(30))
    if (-not $lockAcquired) {
        throw "Another Novel Studio startup is already in progress. Please wait a few seconds and try again."
    }

    if (-not (Test-Path (Join-Path $root "node_modules"))) {
        throw "Dependencies are missing. Run npm.cmd install in the project directory."
    }

    $currentCommit = Get-CurrentCommit
    $packageVersion = Get-PackageVersion
    $startedAt = [DateTimeOffset]::UtcNow.ToString("o")
    $effectiveLibraryRoot = Resolve-OptionalPath -PathValue $LibraryRoot

    if ($Stop) {
        Stop-LocalNovelStudio
        Write-Output "Novel Studio local service is stopped."
        exit 0
    }

    if ($ReuseExisting) {
        $existingHealth = Get-NovelStudioHealth
        if (Test-HealthMatchesCurrentRun -Health $existingHealth) {
            Write-HealthSummary -Health $existingHealth
            Open-Browser
            exit 0
        }
    }

    Stop-LocalNovelStudio
    Invoke-ProjectBuild

    if (-not (Test-Path -LiteralPath $serverEntry)) {
        throw "Server build output is missing: $serverEntry. Run without -SkipBuild or run npm.cmd run build first."
    }

    if ($Foreground) {
        Start-ForegroundServer
    }

    $server = Start-ServerDetached
    $health = $null
    try {
        $health = Wait-HealthyServer -Server $server
        Write-HealthSummary -Health $health

        if ($SmokeTest) {
            Write-Output "Startup smoke test passed; stopping the temporary server."
            Stop-ProcessIfRunning -ProcessId $server.Id
            exit 0
        }

        Save-ServerPidState -ServerPid $server.Id
        Open-Browser
    }
    catch {
        if ($SmokeTest -or $Wait) {
            Stop-ProcessIfRunning -ProcessId $server.Id
        }
        throw
    }

    if ($Wait) {
        Write-Output "Keeping Novel Studio attached because -Wait was provided. Stop this command to stop the server."
        try {
            $server.WaitForExit()
        }
        finally {
            if (-not $server.HasExited) {
                Stop-ProcessIfRunning -ProcessId $server.Id
            }
        }
    }
}
finally {
    if ($lockAcquired) {
        $startupMutex.ReleaseMutex()
    }
    $startupMutex.Dispose()
}
