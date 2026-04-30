$path = 'C:\Users\Maxim\.claude\projects\c--Users-Maxim-EuroWheelz-Plansysteem\0ea9e4a9-6a78-451c-859b-1be78b6f37f0.jsonl'
if (Test-Path $path) {
    $content = [System.IO.File]::ReadAllText($path)
    $cleanContent = $content -replace "`0", ""
    [System.IO.File]::WriteAllText($path, $cleanContent)
    Write-Output "Successfully cleaned null bytes from $path"
} else {
    Write-Error "File not found: $path"
}
