param()

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

function Get-Utf8Content {
    param(
        [Parameter(Mandatory = $true, Position = 0)]
        [string]$Path
    )

    Get-Content -Encoding UTF8 -LiteralPath $Path
}

Set-Alias -Name gc8 -Value Get-Utf8Content -Scope Global

Write-Output "Novel Studio developer shell is using UTF-8 input/output."
Write-Output "Use Get-Content -Encoding UTF8 or gc8 for Chinese text files; prefer rg for search."
