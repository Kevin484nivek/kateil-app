param(
  [string]$TaxonomyDir = "C:\Users\kevin\Documents\Playground\data\import-review\final-taxonomy",
  [string]$OutputPath = "C:\Users\kevin\Documents\Playground\data\import-review\final-taxonomy\final-taxonomy.sql"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Escape-SqlLiteral {
  param([string]$Value)

  return ($Value -replace "'", "''")
}

$categories = Import-Csv -Path (Join-Path $TaxonomyDir "categories_final.csv")
$subtypes = Import-Csv -Path (Join-Path $TaxonomyDir "category_subtypes_final.csv")
$seasons = Import-Csv -Path (Join-Path $TaxonomyDir "category_seasons_final.csv")

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("BEGIN;")
$lines.Add("")

foreach ($category in $categories) {
  $name = Escape-SqlLiteral $category.category
  $lines.Add("INSERT INTO ""Category"" (id, name, ""isActive"", ""createdAt"", ""updatedAt"")")
  $lines.Add("VALUES (gen_random_uuid()::text, '$name', true, NOW(), NOW())")
  $lines.Add("ON CONFLICT (name) DO UPDATE SET ""isActive"" = true, ""updatedAt"" = NOW();")
  $lines.Add("")
}

foreach ($subtype in $subtypes) {
  $category = Escape-SqlLiteral $subtype.category
  $name = Escape-SqlLiteral $subtype.subtype
  $lines.Add("INSERT INTO ""ProductSubtype"" (id, name, ""categoryId"", ""isActive"", ""createdAt"", ""updatedAt"")")
  $lines.Add("SELECT gen_random_uuid()::text, '$name', c.id, true, NOW(), NOW()")
  $lines.Add("FROM ""Category"" c")
  $lines.Add("WHERE c.name = '$category'")
  $lines.Add("ON CONFLICT (""categoryId"", name) DO UPDATE SET ""isActive"" = true, ""updatedAt"" = NOW();")
  $lines.Add("")
}

foreach ($season in $seasons) {
  $category = Escape-SqlLiteral $season.category
  $name = Escape-SqlLiteral $season.season
  $lines.Add("INSERT INTO ""Season"" (id, name, ""categoryId"", ""isActive"", ""createdAt"", ""updatedAt"")")
  $lines.Add("SELECT gen_random_uuid()::text, '$name', c.id, true, NOW(), NOW()")
  $lines.Add("FROM ""Category"" c")
  $lines.Add("WHERE c.name = '$category'")
  $lines.Add("ON CONFLICT (""categoryId"", name) DO UPDATE SET ""isActive"" = true, ""updatedAt"" = NOW();")
  $lines.Add("")
}

$lines.Add("COMMIT;")

$lines -join "`r`n" | Set-Content -Path $OutputPath -Encoding UTF8

Write-Output "SQL generated in: $OutputPath"
