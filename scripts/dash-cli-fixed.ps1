#!/usr/bin/env pwsh
# Test wrapper - hardcoded to project path
$scriptPath = "D:\projects\cli-explorer\dist\index.js"

$exe = if ($IsWindows -or $PSVersionTable.PSVersion -lt "6.0") { ".exe" } else { "" }

# Extract raw args from command line to preserve '--'
$rawLine = $MyInvocation.Line
$rawArgs = ""
if ($rawLine -match '\.ps1["'']?\s+(.*)$') {
  $rawArgs = $Matches[1]
}

# Debug
Write-Host "DEBUG: rawArgs = [$rawArgs]"

# Use --% to pass raw args without PowerShell parsing
if ($rawArgs) {
  $cmd = "node$exe `"$scriptPath`" $rawArgs"
  Write-Host "DEBUG: cmd = $cmd"
  Invoke-Expression $cmd
} else {
  & "node$exe" $scriptPath
}
exit $LASTEXITCODE
