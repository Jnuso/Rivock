# Use the installed Azure CLI, or this workspace's official portable distribution.
# Authentication is scoped to this repository's ignored, owner-protected cache.
$ErrorActionPreference = 'Stop'
$repoDirectory = Split-Path -Parent $PSScriptRoot
$workspaceDirectory = Split-Path -Parent $repoDirectory
$portableCommand = Join-Path $workspaceDirectory 'tmp\azure-cli\bin\az.cmd'
$installedCommand = Get-Command az.cmd,az.exe -ErrorAction SilentlyContinue | Select-Object -First 1

if ($installedCommand) {
    $azureCommand = $installedCommand.Source
} elseif (Test-Path -LiteralPath $portableCommand -PathType Leaf) {
    $azureCommand = $portableCommand
} else {
    throw 'Azure CLI is missing. Install it from https://learn.microsoft.com/cli/azure/install-azure-cli-windows'
}

$configurationDirectory = Join-Path $repoDirectory '.azure'
if (-not (Test-Path -LiteralPath $configurationDirectory)) {
    New-Item -ItemType Directory -Path $configurationDirectory | Out-Null
}
$configurationItem = Get-Item -LiteralPath $configurationDirectory -Force
if (-not $configurationItem.PSIsContainer -or
    ($configurationItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Azure configuration must be a regular local directory.'
}
$accountSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $configurationDirectory /inheritance:r /grant:r "*$($accountSid):(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Could not restrict the Azure authentication directory to the current user.'
}
$env:AZURE_CONFIG_DIR = $configurationDirectory
$env:AZURE_CORE_COLLECT_TELEMETRY = 'false'
# This machine's WAM broker reports a Windows key-storage-parent error. Use browser OAuth.
$env:AZURE_CORE_ENABLE_BROKER_ON_WINDOWS = 'false'
& $azureCommand @args
exit $LASTEXITCODE
