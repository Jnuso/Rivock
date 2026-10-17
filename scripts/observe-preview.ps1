param(
    [ValidateRange(1, 3)]
    [int]$Samples = 3,
    [uri]$BaseUri = 'https://rivock-api.wittymushroom-48e2dfec.canadacentral.azurecontainerapps.io/'
)

$ErrorActionPreference = 'Stop'
if (-not $BaseUri.IsAbsoluteUri -or $BaseUri.Scheme -ne 'https' -or
    $BaseUri.UserInfo -or $BaseUri.Query -or $BaseUri.Fragment -or
    $BaseUri.AbsolutePath -ne '/') {
    throw 'Use a plain HTTPS site origin without credentials, a path, query or fragment.'
}
$base = $BaseUri.GetLeftPart([UriPartial]::Authority)
$observations = @()
foreach ($sample in 1..$Samples) {
    foreach ($path in @('/health/live', '/health/ready', '/api/v1/topics', '/api/v1/threads?sort=latest')) {
        $timer = [Diagnostics.Stopwatch]::StartNew()
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "$base$path" -TimeoutSec 60
        } catch {
            throw "Public read check failed for $path. No write or configuration operation was attempted."
        }
        $timer.Stop()
        if ($response.StatusCode -ne 200) { throw "Unexpected public read status for $path." }
        $observations += [ordered]@{
            sample = $sample
            path = $path
            status = [int]$response.StatusCode
            milliseconds = [Math]::Round($timer.Elapsed.TotalMilliseconds, 1)
        }
    }
}
[ordered]@{
    checkedAtUtc = [DateTime]::UtcNow.ToString('o')
    root = $base
    samples = $observations
    coldStartProven = $false
    limitation = 'Sequential anonymous reads including network/TLS/client overhead. No load test, forced cold start or uptime guarantee.'
} | ConvertTo-Json -Depth 5
