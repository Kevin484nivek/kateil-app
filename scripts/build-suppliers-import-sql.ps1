param(
  [string]$InputCsv = "C:\Users\kevin\Documents\Playground\data\import-review\latest\01_suppliers_master.csv",
  [string]$OutputSql = "C:\Users\kevin\Documents\Playground\data\import-review\latest\10_suppliers_import.sql"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Escape-SqlString {
  param([string]$Value)

  if ($null -eq $Value) {
    return "NULL"
  }

  return "'" + ($Value -replace "'", "''") + "'"
}

function To-SqlBool {
  param($Value)
  if ($Value -in @($true, "True", "true", "1", 1)) { return "TRUE" }
  return "FALSE"
}

function To-SqlDecimalOrNull {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return "NULL" }
  return ($Value -replace ",", ".")
}

if (-not (Test-Path $InputCsv)) {
  throw "No se encuentra el CSV de proveedores: $InputCsv"
}

$rows = Import-Csv $InputCsv

$statements = @()
$statements += "BEGIN;"
$statements += 'DELETE FROM "Supplier";'

foreach ($row in $rows) {
  $supplierId = "import_supplier_" + ([guid]::NewGuid().ToString("N"))
  $supportsDirectPurchase = if ($row.supplier_type -eq "direct") { "TRUE" } else { "FALSE" }
  $supportsSeasonalOrder = "FALSE"
  $supportsConsignment = if ($row.supplier_type -in @("deposit", "special")) { "TRUE" } else { "FALSE" }
  $commission = To-SqlDecimalOrNull $row.commission_pct

  $noteParts = @()
  if ($row.supplier_code) { $noteParts += "Codigo: $($row.supplier_code)" }
  if ($row.supplier_type) { $noteParts += "Tipo: $($row.supplier_type)" }
  if ($row.notes) { $noteParts += $row.notes }
  $notes = $noteParts -join " | "

  $statements += @"
INSERT INTO "Supplier" (
  "id",
  "name",
  "supportsDirectPurchase",
  "supportsSeasonalOrder",
  "supportsConsignment",
  "defaultStoreCommissionPct",
  "notes",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  $(Escape-SqlString $supplierId),
  $(Escape-SqlString $row.supplier_name),
  $supportsDirectPurchase,
  $supportsSeasonalOrder,
  $supportsConsignment,
  $commission,
  $(Escape-SqlString $notes),
  $(To-SqlBool $row.is_active),
  NOW(),
  NOW()
);
"@
}

$statements += "COMMIT;"

$outputDir = Split-Path -Parent $OutputSql
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$statements -join "`r`n" | Set-Content -Path $OutputSql -Encoding UTF8
Write-Output "Supplier import SQL generated: $OutputSql"
