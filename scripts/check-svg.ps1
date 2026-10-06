$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$files = Get-ChildItem -LiteralPath (Join-Path $repoRoot 'assets/animations') -Filter '*.svg'
if ($files.Count -ne 6) { throw "Expected 6 animations, found $($files.Count)" }
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
