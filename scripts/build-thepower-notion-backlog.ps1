param(
  [string]$SourceRoot = "C:\Users\kevin\Documents\ThePower",
  [string]$OutputCsv = "C:\Users\kevin\Documents\Playground\data\thepower\notion-knowledge-units-backlog.csv"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourceRoot)) {
  throw "SourceRoot no existe: $SourceRoot"
}

$outputDir = Split-Path -Path $OutputCsv -Parent
if (-not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$allowedExtensions = @(".mkv", ".mp4", ".pdf", ".xlsx")

function Get-SourceType {
  param([string]$Extension)
  switch ($Extension.ToLowerInvariant()) {
    ".mkv" { "Video" }
    ".mp4" { "Video" }
    ".pdf" { "PDF" }
    ".xlsx" { "Spreadsheet" }
    default { "Other" }
  }
}

function Get-Domain {
  param([string]$RelativePath)
  $firstSegment = $RelativePath.Split([IO.Path]::DirectorySeparatorChar)[0]
  switch -Regex ($firstSegment) {
    "^MBA$" { "MBA" }
    "^ThePowerSales$" { "Sales" }
    default { "Other" }
  }
}

function Normalize-Title {
  param([string]$FileNameWithoutExtension)
  $value = $FileNameWithoutExtension -replace "\+", " "
  $value = $value -replace "\s{2,}", " "
  $value.Trim()
}

$files = Get-ChildItem -LiteralPath $SourceRoot -Recurse -File |
  Where-Object { $allowedExtensions -contains $_.Extension.ToLowerInvariant() } |
  Where-Object { $_.DirectoryName -notmatch "\\__MACOSX($|\\)" } |
  Where-Object { -not $_.Name.StartsWith("._") }

$rows = foreach ($file in $files) {
  $relativePath = [IO.Path]::GetRelativePath($SourceRoot, $file.FullName)
  $domain = Get-Domain -RelativePath $relativePath
  $title = Normalize-Title -FileNameWithoutExtension $file.BaseName
  $sourceType = Get-SourceType -Extension $file.Extension
  $priority = if ($sourceType -eq "Video") { "High" } else { "Medium" }
  $nextAction = switch ($sourceType) {
    "Video" { "Transcribir, sintetizar y extraer decision rule" }
    "PDF" { "Resumir y extraer frameworks accionables" }
    "Spreadsheet" { "Documentar metricas/KPI y casos de uso" }
    default { "Revisar manualmente" }
  }

  [PSCustomObject]@{
    Title           = $title
    Domain          = $domain
    SourceType      = $sourceType
    Topic           = ""
    SourcePath      = $file.FullName
    RelativePath    = $relativePath
    Status          = "Inbox"
    Priority        = $priority
    NextAction      = $nextAction
    Summary         = ""
    CoreInsight     = ""
    DecisionRule    = ""
    Risks           = ""
    WhenToUse       = ""
    Confidence      = ""
    LastDiscovered  = (Get-Date).ToString("yyyy-MM-dd")
  }
}

$rows = $rows | Sort-Object Domain, SourceType, RelativePath
$rows | Export-Csv -LiteralPath $OutputCsv -NoTypeInformation -Encoding UTF8

$countByType = $rows | Group-Object SourceType | Sort-Object Count -Descending
Write-Host "Backlog generado en: $OutputCsv"
Write-Host ("Total items: " + $rows.Count)
foreach ($group in $countByType) {
  Write-Host (" - " + $group.Name + ": " + $group.Count)
}
