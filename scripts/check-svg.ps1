$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$files = Get-ChildItem -LiteralPath (Join-Path $repoRoot 'assets/animations') -Filter '*.svg'
$catalog = Get-Content -LiteralPath (Join-Path $repoRoot 'assets/animations/catalog.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($files.Count -ne $catalog.Count) { throw "Animation catalog and SVG count differ" }
foreach ($entry in $catalog) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "assets/animations/$($entry.file)"))) {
        throw "Missing catalog animation: $($entry.file)"
    }
}
foreach ($file in $files) {
    $settings = New-Object System.Xml.XmlReaderSettings
    $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [System.Xml.XmlReader]::Create($file.FullName, $settings)
    try {
        $document = New-Object System.Xml.XmlDocument
        $document.Load($reader)
        if ($document.DocumentElement.LocalName -ne 'svg' -or $document.DocumentElement.NamespaceURI -ne 'http://www.w3.org/2000/svg') {
            throw "Invalid SVG root: $($file.Name)"
        }
    } finally {
        $reader.Dispose()
    }
    Write-Output "PASS: $($file.Name)"
}
