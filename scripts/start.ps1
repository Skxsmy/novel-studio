param(
    [switch]$NoBrowser,
    [switch]$SkipBuild,
    [switch]$ReuseExisting,
    [switch]$Wait
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
$mutex = New-Object System.Threading.Mutex($false, "Local\NovelStudioStartLock")
$lockAcquired = $false

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

function Get-NovelStudioHealth {
    try {
        return Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1 -ErrorAction Stop
    }
    catch {
        return $null
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

function Test-HealthMatchesCurrentRun {
    param($Health)

    if ($null -eq $Health -or (Get-JsonProperty $Health "ok") -ne $true) {
        return $false
    }

    $workspaceRoot = Get-JsonProperty $Health "workspaceRoot"
    if (-not $workspaceRoot) {
        return $false
    }

    try {
        $reportedRoot = (Resolve-Path $workspaceRoot).Path
        if ($reportedRoot -ne $root) {
            return $false
        }
    }
    catch {
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

function Test-HealthLooksLikeThisProject {
    param($Health)

    if ($null -eq $Health -or (Get-JsonProperty $Health "ok") -ne $true) {
        return $false
    }

    $workspaceRoot = Get-JsonProperty $Health "workspaceRoot"
    if ($workspaceRoot) {
        try {
            return (Resolve-Path $workspaceRoot).Path -eq $root
        }
        catch {
        }
    }

    $libraryRoot = Get-JsonProperty $Health "libraryRoot"
    if ($libraryRoot) {
        try {
            $reportedLibraryRoot = (Resolve-Path $libraryRoot).Path
            $expectedLibraryRoot = (Resolve-Path (Join-Path $root "data\library")).Path
            return $reportedLibraryRoot -eq $expectedLibraryRoot
        }
        catch {
        }
    }

    return $false
}

function Get-PortOwnerProcessIds {
    try {
        $connections = @(Get-NetTCPConnection -LocalAddress $hostName -LocalPort $port -State Listen -ErrorAction Stop)
        return @($connections | ForEach-Object { $_.OwningProcess } | Where-Object { $_ -gt 0 } | Sort-Object -Unique)
    }
    catch {
        return @()
    }
}

function Test-NovelStudioPortInUse {
    $owners = @(Get-PortOwnerProcessIds)
    if ($owners.Count -gt 0) {
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

function Get-ProcessMetadata {
    param([Parameter(Mandatory = $true)][int]$ProcessId)

    $metadata = [ordered]@{
        ProcessId = $ProcessId
        CommandLine = $null
        ExecutablePath = $null
        Path = $null
    }

    try {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
        $metadata.CommandLine = $processInfo.CommandLine
        $metadata.ExecutablePath = $processInfo.ExecutablePath
    }
    catch {
    }

    try {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        $metadata.Path = $process.Path
    }
    catch {
    }

    return [pscustomobject]$metadata
}

function Get-ServerPidStateFiles {
    $files = @()

    try {
        if (Test-Path -LiteralPath $pidFile) {
            $files += (Get-Item -LiteralPath $pidFile -ErrorAction Stop)
        }
        foreach ($directory in @($dataDirectory, $fallbackDataDirectory)) {
            if (Test-Path -LiteralPath $directory) {
                $files += @(Get-ChildItem -LiteralPath $directory -Filter "server.*.pid.json" -File -ErrorAction Stop)
            }
        }
    }
    catch {
    }

    return @($files | Sort-Object FullName -Unique)
}

function Get-RecordedServerPidStates {
    $records = @()

    foreach ($file in @(Get-ServerPidStateFiles)) {
        try {
            $state = Get-Content -Encoding UTF8 -Raw -LiteralPath $file.FullName | ConvertFrom-Json
            if ($state.starterPid) {
                $records += [pscustomobject]@{
                    ProcessId = [int]$state.starterPid
                    StateWriteTime = $file.LastWriteTime
                    StateFile = $file.FullName
                }
            }
            if ($state.portOwnerPids) {
                $state.portOwnerPids | ForEach-Object {
                    $records += [pscustomobject]@{
                        ProcessId = [int]$_
                        StateWriteTime = $file.LastWriteTime
                        StateFile = $file.FullName
                    }
                }
            }
        }
        catch {
        }
    }

    return @($records)
}

function Get-RecordedServerPids {
    try {
        return @(Get-RecordedServerPidStates | ForEach-Object { $_.ProcessId } | Sort-Object -Unique)
    }
    catch {
        return @()
    }
}

function Test-ProcessLooksLikeThisProject {
    param($Metadata)

    $text = @(
        $Metadata.CommandLine,
        $Metadata.ExecutablePath,
        $Metadata.Path
    ) -join " "

    if ([string]::IsNullOrWhiteSpace($text)) {
        return $false
    }

    return $text.ToLowerInvariant().Contains($root.ToLowerInvariant())
}

function Format-ProcessMetadata {
    param($Metadata)

    $detail = $Metadata.CommandLine
    if (-not $detail) {
        $detail = $Metadata.Path
    }
    if (-not $detail) {
        $detail = "command line unavailable"
    }
    return "PID $($Metadata.ProcessId): $detail"
}

function Stop-StalePortOwners {
    param(
        [Parameter(Mandatory = $true)][string]$Reason,
        $Health = $null
    )

    $owners = @(Get-PortOwnerProcessIds)
    if ($owners.Count -eq 0) {
        return
    }

    $recorded = @(Get-RecordedServerPids)
    $healthLooksLocal = Test-HealthLooksLikeThisProject -Health $Health
    $blocked = @()

    foreach ($owner in $owners) {
        $metadata = Get-ProcessMetadata -ProcessId $owner
        $isRecorded = $recorded -contains $owner
        $looksLocal = Test-ProcessLooksLikeThisProject -Metadata $metadata

        if ($isRecorded -or $looksLocal -or $healthLooksLocal) {
            Write-Output "Stopping stale Novel Studio process on port ${port}: $(Format-ProcessMetadata $metadata)"
            Stop-Process -Id $owner -Force -ErrorAction Stop
        }
        else {
            $blocked += (Format-ProcessMetadata $metadata)
        }
    }

    if ($blocked.Count -gt 0) {
        throw "Port $port is in use, but the owner does not look like this Novel Studio checkout. Refusing to stop it automatically. Owners: $($blocked -join '; ')"
    }

    $deadline = (Get-Date).AddSeconds(5)
    while ((Get-Date) -lt $deadline -and (Test-NovelStudioPortInUse)) {
        Start-Sleep -Milliseconds 200
    }

    if (Test-NovelStudioPortInUse) {
        throw "Port $port is still in use after stopping stale Novel Studio processes."
    }
}

function Test-RecordedProcessBelongsToState {
    param([Parameter(Mandatory = $true)][int]$ProcessId)

    foreach ($record in @(Get-RecordedServerPidStates | Where-Object { $_.ProcessId -eq $ProcessId })) {
        try {
            $process = Get-Process -Id $ProcessId -ErrorAction Stop
            if ($process.StartTime -le $record.StateWriteTime.AddMinutes(1)) {
                return $true
            }
        }
        catch {
        }
    }

    return $false
}

function Stop-RecordedServerProcesses {
    param([int[]]$ExcludeProcessIds = @())

    $recorded = @(Get-RecordedServerPids | Where-Object { $ExcludeProcessIds -notcontains $_ })
    foreach ($recordedPid in $recorded) {
        $metadata = Get-ProcessMetadata -ProcessId $recordedPid
        $looksLocal = Test-ProcessLooksLikeThisProject -Metadata $metadata
        $belongsToState = Test-RecordedProcessBelongsToState -ProcessId $recordedPid

        if ($looksLocal -or $belongsToState) {
            try {
                Write-Output "Stopping recorded Novel Studio starter process: $(Format-ProcessMetadata $metadata)"
                Stop-Process -Id $recordedPid -Force -ErrorAction Stop
            }
            catch {
                Write-Warning "Could not stop recorded Novel Studio process ${recordedPid}: $($_.Exception.Message)"
            }
        }
    }
}

function Invoke-ProjectBuild {
    if ($SkipBuild) {
        Write-Output "Skipping production build because -SkipBuild was provided."
        return
    }

    Write-Output "Building current Novel Studio checkout before startup..."
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    & $npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Production build failed; server was not started. If this was an EPERM write to dist, close the process locking the build output or use -SkipBuild only for a smoke test against existing artifacts."
    }
}

function Clear-StartupArtifacts {
    $blocked = $false
    foreach ($path in @($stdout, $stderr, $pidFile)) {
        try {
            if (Test-Path -LiteralPath $path) {
                Remove-Item -LiteralPath $path -Force -ErrorAction Stop
            }
        }
        catch {
            $blocked = $true
            Write-Warning "Could not remove stale startup artifact ${path}: $($_.Exception.Message)"
        }
    }

    if ($blocked) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
        New-Item -ItemType Directory -Path $fallbackDataDirectory -Force | Out-Null
        $script:stdout = Join-Path $fallbackDataDirectory "server.${stamp}.stdout.log"
        $script:stderr = Join-Path $fallbackDataDirectory "server.${stamp}.stderr.log"
        $script:pidFile = Join-Path $fallbackDataDirectory "server.${stamp}.pid.json"
        Write-Output "Using per-run startup artifacts because fixed startup artifacts are locked: $script:stdout"
    }
}

function Get-StartupDiagnostics {
    $sections = @()
    foreach ($path in @($stderr, $stdout)) {
        if (Test-Path -LiteralPath $path) {
            try {
                $tail = @(Get-Content -Encoding UTF8 -LiteralPath $path -Tail 40)
                if ($tail.Count -gt 0) {
                    $sections += "---- $path ----"
                    $sections += $tail
                }
            }
            catch {
                $sections += "Could not read ${path}: $($_.Exception.Message)"
            }
        }
    }

    if ($sections.Count -eq 0) {
        return "No startup logs were written."
    }

    return ($sections -join [Environment]::NewLine)
}

function Test-ProcessHasExited {
    param($Process)

    if ($null -eq $Process) {
        return $true
    }

    try {
        $Process.Refresh()
        return $Process.HasExited
    }
    catch {
        return $true
    }
}

function Wait-HealthyStartedServer {
    param([Parameter(Mandatory = $true)]$Starter)

    $deadline = (Get-Date).AddSeconds(20)
    $stableHealthChecks = 0
    $health = $null

    while ((Get-Date) -lt $deadline) {
        if (Test-ProcessHasExited -Process $Starter) {
            throw "Novel Studio starter exited before the service became stable. $(Get-StartupDiagnostics)"
        }

        $health = Get-NovelStudioHealth
        if ((Test-HealthMatchesCurrentRun -Health $health) -and (Test-NovelStudioPortInUse)) {
            $stableHealthChecks += 1
            if ($stableHealthChecks -ge 3) {
                return $health
            }
        }
        else {
            $stableHealthChecks = 0
        }

        Start-Sleep -Milliseconds 500
    }

    throw "Novel Studio did not become healthy within 20 seconds. $(Get-StartupDiagnostics)"
}

function Save-ServerPidState {
    param([int]$StarterPid)

    try {
        New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
        $state = [ordered]@{
            starterPid = $StarterPid
            portOwnerPids = @(Get-PortOwnerProcessIds)
            commit = $currentCommit
            workspaceRoot = $root
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

try {
    $lockAcquired = $mutex.WaitOne([TimeSpan]::FromSeconds(30))
    if (-not $lockAcquired) {
        throw "Another Novel Studio startup is already in progress. Please wait a few seconds and try again."
    }

    if (-not (Test-Path (Join-Path $root "node_modules"))) {
        throw "Dependencies are missing. Run npm.cmd install in the project directory."
    }

    $currentCommit = Get-CurrentCommit
    $packageVersion = Get-PackageVersion
    $startedAt = [DateTimeOffset]::UtcNow.ToString("o")
    $starter = $null

    $health = Get-NovelStudioHealth
    if ((Test-HealthMatchesCurrentRun -Health $health) -and $ReuseExisting) {
    }
    else {
        if ($null -ne $health) {
            Stop-StalePortOwners -Reason "refreshing local service before startup" -Health $health
        }
        elseif (Test-NovelStudioPortInUse) {
            Stop-StalePortOwners -Reason "port occupied without healthy response"
        }
        Stop-RecordedServerProcesses

        Invoke-ProjectBuild

        if (Test-NovelStudioPortInUse) {
            throw "Port $port is already in use after stale process cleanup."
        }

        New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
        Clear-StartupArtifacts
        $pathValue = [Environment]::GetEnvironmentVariable("PATH", "Process")
        if (-not $pathValue) {
            $pathValue = [Environment]::GetEnvironmentVariable("Path", "Process")
        }
        if ($pathValue) {
            [Environment]::SetEnvironmentVariable("Path", $null, "Process")
            [Environment]::SetEnvironmentVariable("PATH", $pathValue, "Process")
        }
        $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
        [Environment]::SetEnvironmentVariable("NOVEL_STUDIO_VERSION", $packageVersion, "Process")
        [Environment]::SetEnvironmentVariable("NOVEL_STUDIO_COMMIT", $currentCommit, "Process")
        [Environment]::SetEnvironmentVariable("NOVEL_STUDIO_STARTED_AT", $startedAt, "Process")
        [Environment]::SetEnvironmentVariable("NOVEL_STUDIO_WORKSPACE_ROOT", $root, "Process")
        $starter = Start-Process -FilePath $npm `
            -ArgumentList @("start") `
            -WorkingDirectory $root `
            -WindowStyle Hidden `
            -RedirectStandardOutput $stdout `
            -RedirectStandardError $stderr `
            -PassThru

        $health = Wait-HealthyStartedServer -Starter $starter
        Save-ServerPidState -StarterPid $starter.Id
    }

    $health = Get-NovelStudioHealth
    if (-not (Test-HealthMatchesCurrentRun -Health $health)) {
        throw "Novel Studio failed to start. See data/server.stderr.log."
    }

    if (-not $NoBrowser) {
        Start-Process $url
    }

    Write-HealthSummary -Health $health

    if ($Wait -and $null -ne $starter) {
        Write-Output "Keeping Novel Studio attached because -Wait was provided. Stop this process to stop the server."
        Wait-Process -Id $starter.Id
    }
}
finally {
    if ($lockAcquired) {
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()
}
