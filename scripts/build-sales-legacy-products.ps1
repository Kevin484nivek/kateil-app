param(
  [string]$ProductsCsv = "C:\Users\kevin\Documents\Playground\data\import-review\latest\03_products_normalized.csv",
  [string]$SalesCsv = "C:\Users\kevin\Documents\Playground\data\import-review\latest\05_sales_normalized.csv",
  [string]$OutputCsv = "C:\Users\kevin\Documents\Playground\data\import-review\latest\11_legacy_products_from_sales.csv"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Repair-Text {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ""
  }

  if ($Value -notmatch "[ÃÂ]") {
    return $Value.Trim()
  }

  try {
    $bytes = [System.Text.Encoding]::GetEncoding("ISO-8859-1").GetBytes($Value)
    return ([System.Text.Encoding]::UTF8.GetString($bytes)).Trim()
  } catch {
    return $Value.Trim()
  }
}

function Normalize-Text {
  param([string]$Value)

  return (Repair-Text $Value -replace "\s+", " ").Trim()
}

function Guess-Category {
  param([string]$Description)

  $text = (Normalize-Text $Description).ToLowerInvariant()

  if ($text -match "pendiente|collar|anillo|pulsera|colgante|gargantilla|brazalete|broche|cadena") { return "Joyería" }
  if ($text -match "bolso|bombonera|clouch|clutch|cartera|capazo|tote bag|neceser|monedero|portaordenador") { return "Bolsos" }
  if ($text -match "pañuelo|cintur[oó]n|gafas|abanico|sombrero|capelina|mant[oó]n|manguito") { return "Accesorios" }
  if ($text -match "ambientador|muñeco|decoraci[oó]n|caja|amigur") { return "Hogar" }
  return "Ropa"
}

function Guess-Subtype {
  param([string]$Description, [string]$Category)

  $text = (Normalize-Text $Description).ToLowerInvariant()

  switch ($Category) {
    "Joyería" {
      if ($text -match "pendiente") { return "Pendientes" }
      if ($text -match "collar") { return "Collar" }
      if ($text -match "anillo") { return "Anillo" }
      if ($text -match "pulsera") { return "Pulsera" }
      if ($text -match "colgante") { return "Colgante" }
      if ($text -match "gargantilla") { return "Gargantilla" }
      return "Bisutería"
    }
    "Bolsos" {
      if ($text -match "bombonera") { return "Bombonera" }
      if ($text -match "clouch|clutch") { return "Clutch" }
      if ($text -match "cartera") { return "Cartera" }
      if ($text -match "capazo") { return "Capazo" }
      if ($text -match "tote bag") { return "Tote bag" }
      if ($text -match "neceser") { return "Neceser" }
      if ($text -match "monedero") { return "Monedero" }
      return "Bolso"
    }
    "Accesorios" {
      if ($text -match "pañuelo") { return "Pañuelo" }
      if ($text -match "cintur[oó]n") { return "Cinturón" }
      if ($text -match "gafas") { return "Gafas" }
      if ($text -match "abanico") { return "Abanico" }
      if ($text -match "sombrero") { return "Sombrero" }
      if ($text -match "capelina") { return "Capelina" }
      if ($text -match "mant[oó]n") { return "Chal" }
      return "Accesorios"
    }
    "Hogar" {
      if ($text -match "ambientador") { return "Ambientador" }
      return "Decoración"
    }
    default {
      if ($text -match "vestido") { return "Vestido" }
      if ($text -match "falda") { return "Falda" }
      if ($text -match "pantal[oó]n") { return "Pantalón" }
      if ($text -match "camisa") { return "Camisa" }
      if ($text -match "camiseta") { return "Camiseta" }
      if ($text -match "jersey") { return "Jersey" }
      if ($text -match "torera") { return "Torera" }
      if ($text -match "chaleco") { return "Chaleco" }
      if ($text -match "chaqueta") { return "Chaqueta" }
      if ($text -match "blusa") { return "Blusa" }
      if ($text -match "corpiño|corpino|cuerpo") { return "Cuerpo" }
      if ($text -match "poncho") { return "Poncho" }
      if ($text -match "kimono") { return "Kimono" }
      if ($text -match "bañador|banador") { return "Bañador" }
      if ($text -match "casaca") { return "Casaca" }
      if ($text -match "casaca|guardapolvos") { return "Guardapolvos" }
      return "Top"
    }
  }
}

if (-not (Test-Path $ProductsCsv)) { throw "No se encuentra el CSV de productos: $ProductsCsv" }
if (-not (Test-Path $SalesCsv)) { throw "No se encuentra el CSV de ventas: $SalesCsv" }

$supplierMaster = Import-Csv -Path "C:\Users\kevin\Documents\Playground\data\import-review\latest\01_suppliers_master.csv"
$supplierByName = @{}
foreach ($supplier in $supplierMaster) {
  $supplierByName[(Normalize-Text $supplier.supplier_name)] = $supplier
}

$existingCodes = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
Import-Csv -Path $ProductsCsv | ForEach-Object {
  if ($_.code) { [void]$existingCodes.Add($_.code) }
}

$legacyProducts = @()
$seenLegacyCodes = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

Import-Csv -Path $SalesCsv | ForEach-Object {
  $code = Normalize-Text $_.product_code
  if (-not $code) { return }
  if ($existingCodes.Contains($code)) { return }
  if ($seenLegacyCodes.Contains($code)) { return }

  $description = Normalize-Text $_.product_description
  if (-not $description) {
    $description = "Producto legacy $code"
  }

  $category = Guess-Category $description
  $subtype = Guess-Subtype -Description $description -Category $category
  $price = if ($_.sold_unit_price) { ($_.sold_unit_price -replace ",", ".") } else { "0" }
  $supplierName = if ($_.supplier_candidate) { Repair-Text $_.supplier_candidate } else { "MiMarca" }
  $supplierType = if ($_.supplier_type) { $_.supplier_type } else { "owned" }
  $supplierRecord = $supplierByName[(Normalize-Text $supplierName)]
  $commission = if ($supplierType -in @("deposit", "special")) {
    if ($supplierRecord -and $supplierRecord.commission_pct) { $supplierRecord.commission_pct } else { "" }
  } else {
    "100"
  }

  $legacyProducts += [pscustomobject]@{
    legacy_code = $code
    legacy_description = $description
    category_raw = "sales_legacy"
    color_raw = ""
    style_raw = ""
    season_raw = ""
    size_raw = ""
    price_raw = $price
    stock_total_raw = "0"
    stock_available_raw = "0"
    year_raw = ""
    code = $code
    name = $description
    description = $description
    category = $category
    subtype = $subtype
    season = ""
    size = ""
    color = ""
    base_price = $price
    stock_initial = "0"
    supplier_code = $_.supplier_code
    supplier_candidate = $supplierName
    supplier_type = $supplierType
    supplier_is_active = $_.supplier_is_active
    supplier_notes = "Generado desde ventas históricas"
    product_type = if ($supplierType -in @("deposit", "special")) { "CONSIGNMENT" } else { "OWNED" }
    store_commission_pct = if ($supplierType -in @("deposit", "special")) { "" } else { "100" }
    import_status = "legacy_sales_product"
    import_issue = ""
  }

  [void]$seenLegacyCodes.Add($code)
}

$outputDir = Split-Path -Parent $OutputCsv
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$legacyProducts | Export-Csv -Path $OutputCsv -NoTypeInformation -Encoding UTF8
Write-Output "Legacy sales products generated: $($legacyProducts.Count)"
Write-Output "Output: $OutputCsv"
