param(
  [string]$ReviewDir = "C:\Users\kevin\Documents\Playground\data\import-review\2026-04-01-taxonomy-v4",
  [string]$OutputDir = "C:\Users\kevin\Documents\Playground\data\import-review\final-taxonomy"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Directory {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

Ensure-Directory -Path $OutputDir

$taxonomyPath = Join-Path $ReviewDir "07_taxonomy_review.csv"
$taxonomy = Import-Csv -Path $taxonomyPath

$categories = $taxonomy |
  Where-Object { $_.category } |
  Group-Object category |
  Sort-Object Name |
  ForEach-Object {
    [pscustomobject]@{
      category = $_.Name
      is_active = "true"
    }
  }

$subtypes = $taxonomy |
  Where-Object { $_.category -and $_.subtype } |
  Group-Object category, subtype |
  Sort-Object { $_.Group[0].category }, { $_.Group[0].subtype } |
  ForEach-Object {
    $first = $_.Group[0]
    [pscustomobject]@{
      category = $first.category
      subtype = $first.subtype
      product_count = ($_.Count)
      is_active = "true"
    }
  }

$seasons = $taxonomy |
  Where-Object { $_.category -and $_.season } |
  Group-Object category, season |
  Sort-Object { $_.Group[0].category }, { $_.Group[0].season } |
  ForEach-Object {
    $first = $_.Group[0]
    [pscustomobject]@{
      category = $first.category
      season = $first.season
      product_count = ($_.Count)
      is_active = "true"
    }
  }

$categories | Export-Csv -Path (Join-Path $OutputDir "categories_final.csv") -NoTypeInformation -Encoding UTF8
$subtypes | Export-Csv -Path (Join-Path $OutputDir "category_subtypes_final.csv") -NoTypeInformation -Encoding UTF8
$seasons | Export-Csv -Path (Join-Path $OutputDir "category_seasons_final.csv") -NoTypeInformation -Encoding UTF8

$readme = @"
# Taxonomía final

Estos archivos salen de la revisión empírica del Excel y están pensados para cargar la taxonomía base al sistema.

## Archivos

- `categories_final.csv`
- `category_subtypes_final.csv`
- `category_seasons_final.csv`

## Criterio

- Las categorías salen del histórico real del Excel.
- Los subtipos se agrupan por categoría.
- Las temporadas se asocian por categoría.
- Esta carga no importa productos, proveedores ni ventas; solo la taxonomía.
"@

$readme | Set-Content -Path (Join-Path $OutputDir "README.md") -Encoding UTF8

Write-Output "Final taxonomy files generated in: $OutputDir"
