param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [string]$OutputDir = "C:\Users\kevin\Documents\Playground\data\import-review\latest"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-XlsxWorkbookData {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)

  try {
    $sharedStrings = @()
    $sharedEntry = $zip.GetEntry("xl/sharedStrings.xml")

    if ($sharedEntry) {
      $reader = [System.IO.StreamReader]::new($sharedEntry.Open())

      try {
        $sharedXml = [xml]$reader.ReadToEnd()
      } finally {
        $reader.Dispose()
      }

      $sharedNs = [System.Xml.XmlNamespaceManager]::new($sharedXml.NameTable)
      $sharedNs.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

      foreach ($si in $sharedXml.SelectNodes("//d:si", $sharedNs)) {
        $parts = @()
        foreach ($textNode in $si.SelectNodes(".//d:t", $sharedNs)) {
          $parts += $textNode.InnerText
        }

        $sharedStrings += ($parts -join "")
      }
    }

    $relsEntry = $zip.GetEntry("xl/_rels/workbook.xml.rels")
    $relsReader = [System.IO.StreamReader]::new($relsEntry.Open())

    try {
      $relsXml = [xml]$relsReader.ReadToEnd()
    } finally {
      $relsReader.Dispose()
    }

    $relsNs = [System.Xml.XmlNamespaceManager]::new($relsXml.NameTable)
    $relsNs.AddNamespace("r", "http://schemas.openxmlformats.org/package/2006/relationships")

    $workbookEntry = $zip.GetEntry("xl/workbook.xml")
    $workbookReader = [System.IO.StreamReader]::new($workbookEntry.Open())

    try {
      $workbookXml = [xml]$workbookReader.ReadToEnd()
    } finally {
      $workbookReader.Dispose()
    }

    $workbookNs = [System.Xml.XmlNamespaceManager]::new($workbookXml.NameTable)
    $workbookNs.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

    $sheets = @()

    foreach ($sheet in $workbookXml.SelectNodes("//d:sheets/d:sheet", $workbookNs)) {
      $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
      $rel = $relsXml.SelectSingleNode("//r:Relationship[@Id='$rid']", $relsNs)

      if (-not $rel) {
        continue
      }

      $target = $rel.Target -replace "\\", "/"
      if ($target -notmatch "^xl/") {
        $target = "xl/$target"
      }

      $sheetEntry = $zip.GetEntry($target)
      if (-not $sheetEntry) {
        continue
      }

      $sheetReader = [System.IO.StreamReader]::new($sheetEntry.Open())

      try {
        $sheetXml = [xml]$sheetReader.ReadToEnd()
      } finally {
        $sheetReader.Dispose()
      }

      $sheetNs = [System.Xml.XmlNamespaceManager]::new($sheetXml.NameTable)
      $sheetNs.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

      $rows = @()

      foreach ($row in $sheetXml.SelectNodes("//d:sheetData/d:row", $sheetNs)) {
        $cellsByIndex = @{}

        foreach ($cell in $row.SelectNodes("./d:c", $sheetNs)) {
          $ref = $cell.r
          $letters = ($ref -replace "\d", "")
          $columnIndex = 0

          foreach ($char in $letters.ToCharArray()) {
            $columnIndex = ($columnIndex * 26) + ([int][char]::ToUpperInvariant($char) - 64)
          }

          $cellType = $cell.GetAttribute("t")
          $valueNode = $cell.SelectSingleNode("./d:v", $sheetNs)
          $value = ""

          if ($valueNode) {
            $raw = $valueNode.InnerText

            if ($cellType -eq "s") {
              $sharedIndex = [int]$raw
              if ($sharedIndex -lt $sharedStrings.Count) {
                $value = $sharedStrings[$sharedIndex]
              } else {
                $value = $raw
              }
            } else {
              $value = $raw
            }
          } else {
            $inlineText = $cell.SelectSingleNode(".//d:t", $sheetNs)
            if ($inlineText) {
              $value = $inlineText.InnerText
            }
          }

          $cellsByIndex[$columnIndex] = [string]$value
        }

        if ($cellsByIndex.Count -eq 0) {
          continue
        }

        $maxColumn = ($cellsByIndex.Keys | Measure-Object -Maximum).Maximum
        $values = for ($i = 1; $i -le $maxColumn; $i++) {
          if ($cellsByIndex.ContainsKey($i)) {
            $cellsByIndex[$i].Trim()
          } else {
            ""
          }
        }

        $rows += ,$values
      }

      $sheets += [pscustomobject]@{
        Name = $sheet.name
        Rows = $rows
      }
    }

    return $sheets
  } finally {
    $zip.Dispose()
  }
}

function Normalize-Text {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ""
  }

  return ($Value -replace "\s+", " ").Trim()
}

function Repair-Mojibake {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $Value
  }

  if ($Value -notmatch "[ÃÂ]") {
    return $Value
  }

  try {
    $bytes = [System.Text.Encoding]::GetEncoding("ISO-8859-1").GetBytes($Value)
    return [System.Text.Encoding]::UTF8.GetString($bytes)
  } catch {
    return $Value
  }
}

function Normalize-MatchKey {
  param([string]$Value)

  $text = Normalize-Text $Value
  if (-not $text) {
    return ""
  }

  $normalized = $text.Normalize([Text.NormalizationForm]::FormD)
  $builder = [System.Text.StringBuilder]::new()

  foreach ($char in $normalized.ToCharArray()) {
    $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
    if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($char)
    }
  }

  return (($builder.ToString().Normalize([Text.NormalizationForm]::FormC).ToLowerInvariant()) -replace "[^a-z0-9]+", "")
}

function Get-SupplierMaster {
  $rows = @(
    @{ name = "MiMarca"; code = "MC"; supplier_type = "owned"; commission_pct = 100; is_active = $true; notes = "Marca propia"; aliases = @("MiMarca", "MC") }
    @{ name = "Terán Conde"; code = "TC"; supplier_type = "deposit"; commission_pct = 15; is_active = $true; notes = ""; aliases = @("Terán Conde", "Teran Conde", "TC") }
    @{ name = "Strambótica"; code = "ST"; supplier_type = "deposit"; commission_pct = 20; is_active = $true; notes = ""; aliases = @("Strambótica", "Strambotica", "ST") }
    @{ name = "Love By Ksenia"; code = ""; supplier_type = "deposit"; commission_pct = 15; is_active = $false; notes = "Desactivado; falta devolver mercancía"; aliases = @("Love By Ksenia", "Ksenia") }
    @{ name = "Carmen Sánchez de Ventura"; code = "CS"; supplier_type = "deposit"; commission_pct = 15; is_active = $true; notes = ""; aliases = @("Carmen Sánchez de Ventura", "Carmen Sanchez de Ventura", "CS") }
    @{ name = "Nubla"; code = "NB"; supplier_type = "deposit"; commission_pct = 15; is_active = $true; notes = ""; aliases = @("Nubla", "NB") }
    @{ name = "Humberto Parra"; code = "HP"; supplier_type = "deposit"; commission_pct = 15; is_active = $true; notes = ""; aliases = @("Humberto Parra", "HP") }
    @{ name = "Senda Tribe"; code = ""; supplier_type = "deposit"; commission_pct = 20; is_active = $false; notes = "Desactivado"; aliases = @("Senda Tribe") }
    @{ name = "IS"; code = ""; supplier_type = "deposit"; commission_pct = 15; is_active = $false; notes = "Desactivado; falta devolver mercancía"; aliases = @("IS") }
    @{ name = "Bold Woman"; code = ""; supplier_type = "deposit"; commission_pct = 15; is_active = $false; notes = "Desactivado; falta devolver mercancía"; aliases = @("Bold Woman") }
    @{ name = "Fantoche"; code = "FC"; supplier_type = "deposit"; commission_pct = 25; is_active = $false; notes = "Desactivado"; aliases = @("Fantoche", "FC") }
    @{ name = "Mar Carlero"; code = "MR"; supplier_type = "deposit"; commission_pct = 20; is_active = $true; notes = ""; aliases = @("Mar Carlero", "MR") }
    @{ name = "Gallo Buey"; code = "GB"; supplier_type = "deposit"; commission_pct = 20; is_active = $true; notes = ""; aliases = @("Gallo Buey", "GB") }
    @{ name = "I Have A Dream"; code = ""; supplier_type = "deposit"; commission_pct = 20; is_active = $false; notes = "Desactivado"; aliases = @("I Have A Dream", "I have a dream") }
    @{ name = "Mirbama"; code = ""; supplier_type = "deposit"; commission_pct = 25; is_active = $false; notes = "Desactivado"; aliases = @("Mirbama") }
    @{ name = "Pauer Milano"; code = "PP"; supplier_type = "deposit"; commission_pct = 20; is_active = $true; notes = ""; aliases = @("Pauer Milano", "PP") }
    @{ name = "Sonia Macías"; code = "SM"; supplier_type = "deposit"; commission_pct = 20; is_active = $false; notes = "Desactivado; código SM compartido históricamente con Silvina"; aliases = @("Sonia Macías", "Sonia Macias") }
    @{ name = "Paloma Mantoncillos"; code = "PM"; supplier_type = "deposit"; commission_pct = 20; is_active = $false; notes = "Desactivado"; aliases = @("Paloma Mantoncillos", "Paloma mantoncillos", "PM") }
    @{ name = "Erika Design"; code = "EH"; supplier_type = "deposit"; commission_pct = 20; is_active = $false; notes = "Desactivado"; aliases = @("Erika Design", "Erika design", "Ericka", "Erika", "EH") }
    @{ name = "Marga FBI"; code = "MG"; supplier_type = "deposit"; commission_pct = 20; is_active = $false; notes = "Desactivado"; aliases = @("Marga FBI", "MG") }
    @{ name = "Alma Blanca"; code = "AB"; supplier_type = "direct"; commission_pct = ""; is_active = $true; notes = ""; aliases = @("Alma Blanca", "Alma blanca", "AB") }
    @{ name = "Sona"; code = "MS"; supplier_type = "direct"; commission_pct = ""; is_active = $true; notes = ""; aliases = @("Sona", "MS") }
    @{ name = "Marta en Brasil"; code = "MB"; supplier_type = "direct"; commission_pct = ""; is_active = $true; notes = ""; aliases = @("Marta en Brasil", "MB") }
    @{ name = "Strena"; code = "ME"; supplier_type = "direct"; commission_pct = ""; is_active = $true; notes = ""; aliases = @("Strena", "ME") }
    @{ name = "Sorena"; code = "SN"; supplier_type = "direct"; commission_pct = ""; is_active = $true; notes = "Incluye la marca BS (bolso Sorena)"; aliases = @("Sorena", "SN", "BS", "Bolso Sorena") }
    @{ name = "Emaná"; code = "EM"; supplier_type = "direct"; commission_pct = ""; is_active = $true; notes = ""; aliases = @("Emaná", "Emana", "EM") }
    @{ name = "One to One"; code = "OM"; supplier_type = "direct"; commission_pct = ""; is_active = $true; notes = ""; aliases = @("One to One", "One to one", "OM") }
    @{ name = "Tantrend"; code = "TT"; supplier_type = "direct"; commission_pct = ""; is_active = $true; notes = ""; aliases = @("Tantrend", "TT") }
    @{ name = "Baba Desing"; code = "BD"; supplier_type = "direct"; commission_pct = ""; is_active = $true; notes = "Incluye prefijo histórico BB"; aliases = @("Baba Desing", "Baba desing", "BD", "BB") }
    @{ name = "Eva Abanicos"; code = ""; supplier_type = "direct"; commission_pct = ""; is_active = $true; notes = "Sin nomenclatura confirmada"; aliases = @("Eva Abanicos", "Eva abanicos") }
    @{ name = "Letdd"; code = "LM"; supplier_type = "direct"; commission_pct = ""; is_active = $true; notes = ""; aliases = @("Letdd", "LM") }
    @{ name = "Silvina"; code = "SM"; supplier_type = "special"; commission_pct = ""; is_active = $true; notes = "Paga alquiler; usar SM para Silvina"; aliases = @("Silvina", "SM") }
    @{ name = "Marao Flamenca"; code = "MM"; supplier_type = "special"; commission_pct = ""; is_active = $false; notes = "Paga alquiler; Desactivado"; aliases = @("Marao Flamenca", "MM") }
    @{ name = "Código Vinario"; code = ""; supplier_type = "special"; commission_pct = ""; is_active = $true; notes = "Pendiente de clasificar"; aliases = @("Código Vinario", "Codigo Vinario", "Código vinario") }
    @{ name = "Lola Pendientes"; code = "LP"; supplier_type = "deposit"; commission_pct = ""; is_active = $false; notes = "Proveedor desactivado"; aliases = @("Lola Pendientes", "Lola pendientes", "LP") }
    @{ name = "3R"; code = "3R"; supplier_type = "deposit"; commission_pct = 20; is_active = $false; notes = "Proveedor desactivado"; aliases = @("3R") }
  )

  return $rows | ForEach-Object {
    $aliases = @($_.aliases | Where-Object { $_ } | ForEach-Object { Normalize-MatchKey $_ })
    [pscustomobject]@{
      supplier_name = Repair-Mojibake $_.name
      supplier_code = $_.code
      supplier_type = $_.supplier_type
      commission_pct = $_.commission_pct
      is_active = $_.is_active
      notes = Repair-Mojibake $_.notes
      alias_keys = ($aliases -join "|")
    }
  }
}

function Normalize-CategoryName {
  param([string]$Value)

  $normalized = (Normalize-Text $Value).ToLowerInvariant()

  switch -Regex ($normalized) {
    "^abrigo$|^chaquet[oó]n$|^chaqueta$|^blusa$|^camisa$|^vestido$|^falda$|^pantal[oó]n$|^mono$|^jersey$|^top$|^torera$|^poncho$|^cuerpo$|^casaca$|^chaleco$|^chal$|^capa$|^kimono$|^capa[sz]?$" { return "Ropa" }
    "^bolso[s]?$|^bombonera$|^clunch$|^clutch$|^neceser(es)?$" { return "Bolsos" }
    "^anillo[s]?$|^collar(es)?$|^pendientes$|^aros$|^pulsera[s]?$|^broche[s]?$" { return "Joyería" }
    "^zapato[s]?$|^sandalia[s]?$|^bot[ií]n(es)?$|^calzado$" { return "Calzado" }
    "^aroma$|^ambientadores$|^hogar$" { return "Hogar" }
    "^accesorio[s]?$|^pañuelo[s]?$|^sombrero[s]?$|^cuello[s]?$" { return "Accesorios" }
    default {
      if ([string]::IsNullOrWhiteSpace($normalized)) {
        return ""
      }

      $textInfo = [System.Globalization.CultureInfo]::GetCultureInfo("es-ES").TextInfo
      return $textInfo.ToTitleCase($normalized)
    }
  }
}

function Normalize-SubtypeName {
  param([string]$Value)

  $normalized = (Normalize-Text $Value).ToLowerInvariant()

  switch -Regex ($normalized) {
    "^abrigo[s]?$" { return "Abrigo" }
    "^anillo[s]?$" { return "Anillo" }
    "^aro[s]?$" { return "Aros" }
    "^abanico[s]?$" { return "Abanico" }
    "^ambientadores?$|^aroma[s]?$" { return "Ambientador" }
    "^blazer$" { return "Blazer" }
    "^blusa$|^blus[oó]n$" { return "Blusa" }
    "^bolsa[s]?$" { return "Bolsa" }
    "^bolso[s]?$" { return "Bolso" }
    "^bomber$" { return "Bomber" }
    "^bombonera[s]?$" { return "Bombonera" }
    "^broche[s]?$" { return "Broche" }
    "^bufanda[s]?$" { return "Bufanda" }
    "^caden[ao]s?$" { return "Cadena" }
    "^calcetines?$" { return "Calcetines" }
    "^camisa[s]?$|^camisol[ao]s?$" { return "Camisa" }
    "^camiseta[s]?$" { return "Camiseta" }
    "^capa[s]?$" { return "Capa" }
    "^capelina[s]?$" { return "Capelina" }
    "^cardigan$" { return "Cardigan" }
    "^cartera[s]?$" { return "Cartera" }
    "^casaca[s]?$" { return "Casaca" }
    "^cazadora[s]?$" { return "Cazadora" }
    "^cesto[s]?$" { return "Cesto" }
    "^cinturon$|^cintur[oó]n$" { return "Cinturón" }
    "^chaleco[s]?$" { return "Chaleco" }
    "^chal(es)?$" { return "Chal" }
    "^chaqueta[s]?$|^chaquet[oó]n(es)?$|^chaqueta casaca$" { return "Chaqueta" }
    "^choker[s]?$|^gargantilla[s]?$" { return "Gargantilla" }
    "^clutch$|^clunch$" { return "Clutch" }
    "^collar(es)?$" { return "Collar" }
    "^cuello[s]?$" { return "Cuello" }
    "^cuerpo[s]?$|^body$|^bodies$|^lencero[s]?$" { return "Cuerpo" }
    "^corpi[nñ]o$" { return "Corpiño" }
    "^estola[s]?$" { return "Estola" }
    "^falda[s]?$" { return "Falda" }
    "^falda pantalon$" { return "Falda pantalón" }
    "^gafas$" { return "Gafas" }
    "^gabardina[s]?$" { return "Gabardina" }
    "^guardapolvos$" { return "Guardapolvos" }
    "^chubasquero$" { return "Chubasquero" }
    "^jersey[s]?$" { return "Jersey" }
    "^juego[s]?$" { return "Juego" }
    "^kaftan$" { return "Kaftan" }
    "^kimono[s]?$" { return "Kimono" }
    "^mallas$" { return "Mallas" }
    "^mantoncillo[s]?$" { return "Mantoncillo" }
    "^mono[s]?$" { return "Mono" }
    "^mono pantalon$" { return "Mono pantalón" }
    "^americana$" { return "Americana" }
    "^bañador$" { return "Bañador" }
    "^bermuda[s]?$" { return "Bermuda" }
    "^pañuelo[s]?$" { return "Pañuelo" }
    "^parcka$|^parka[s]?$" { return "Parka" }
    "^pantal[oó]n(es)?$" { return "Pantalón" }
    "^peineta[s]?$" { return "Peineta" }
    "^pendiente[s]?$" { return "Pendientes" }
    "^poncho[s]?$" { return "Poncho" }
    "^pasmina[s]?$" { return "Pashmina" }
    "^portamovil(es)?$|^portam[oó]viles$" { return "Portamóvil" }
    "^prendido[s]?$" { return "Prendido" }
    "^pulsera[s]?$" { return "Pulsera" }
    "^sandalia[s]?$" { return "Sandalia" }
    "^sobrecamisa[s]?$" { return "Sobrecamisa" }
    "^sudadera[s]?$" { return "Sudadera" }
    "^short$|^short /minifalda$|^falda short$" { return "Short" }
    "^gayumbo$" { return "Ropa interior" }
    "^sombrero[s]?$" { return "Sombrero" }
    "^top[s]?$" { return "Top" }
    "^torera[s]?$" { return "Torera" }
    "^total look$" { return "Total look" }
    "^vestdio$|^vstido$" { return "Vestido" }
    "^vestido/casaca$|^vestido abrigo$|^abrigo/vestido$|^vestido/falda$" { return "Vestido" }
    "^camisa/sobrecamisa$" { return "Sobrecamisa" }
    "^rebecon$" { return "Rebeca" }
    "^leggin$|^leggings$" { return "Legging" }
    "^camiseta/jersey$" { return "Jersey" }
    "^falda/poncho$" { return "Poncho" }
    "^chaquetilla$|^chaquetq$|^chaquta$|^chaquetq/falda$" { return "Chaqueta" }
    "^casacas$|^casac$" { return "Casaca" }
    "^cazadoras$" { return "Cazadora" }
    "^chalecos$" { return "Chaleco" }
    "^blusas$" { return "Blusa" }
    "^cuerpos$" { return "Cuerpo" }
    "^mantoncillos$" { return "Mantoncillo" }
    "^cinturones$" { return "Cinturón" }
    "^pantalones$" { return "Pantalón" }
    "^bolsitos$|^bolsito$|^bolson$|^minibolsito$" { return "Bolso" }
    "^monederos$" { return "Monedero" }
    "^neceser(es)?$" { return "Neceser" }
    "^tote bag$" { return "Tote bag" }
    "^capazo$" { return "Capazo" }
    "^portaordenador$" { return "Portaordenador" }
    "^brazalete$" { return "Brazalete" }
    "^bisuteria$" { return "Bisutería" }
    "^colgante[s]?$" { return "Colgante" }
    "^gorro$|^gorritos$" { return "Gorro" }
    "^guantes$" { return "Guantes" }
    "^pinzas$|^coronas$|^flor prendidos$" { return "Adorno pelo" }
    "^fundas de gafas$" { return "Funda gafas" }
    "^plumas$" { return "Plumas" }
    "^manguitos$" { return "Manguitos" }
    "^amiguris$|^muñeco$|^cajas$" { return "Decoración" }
    "^gasa$" { return "Blusa" }
    "^tunica$|^t[uú]nica$" { return "Túnica" }
    "^vestido[s]?$" { return "Vestido" }
    "^zapato[s]?$" { return "Zapato" }
    default {
      if ([string]::IsNullOrWhiteSpace($normalized)) {
        return ""
      }

      $textInfo = [System.Globalization.CultureInfo]::GetCultureInfo("es-ES").TextInfo
      return $textInfo.ToTitleCase($normalized)
    }
  }
}

function Get-CategorySubtypeProposal {
  param(
    [string]$RawCategory,
    [string]$Description
  )

  $normalized = (Normalize-Text $RawCategory).ToLowerInvariant()

  switch -Regex ($normalized) {
    "^abrigo$|^chaquet[oó]n$|^chaqueta$|^blusa$|^blus[oó]n$|^blusas$|^camisa$|^camisa/sobrecamisa$|^camiseta$|^camiseta/jersey$|^vestido$|^vestdio$|^vstido$|^vestido/casaca$|^vestido abrigo$|^abrigo/vestido$|^vestido/falda$|^falda$|^falda/poncho$|^pantal[oó]n$|^pantalones$|^mono$|^mono pantalon$|^jersey$|^top$|^torera$|^toreras$|^poncho$|^cuerpo$|^cuerpos$|^corpi[nñ]o$|^casaca$|^casacas$|^casac$|^chaleco$|^chalecos$|^chal$|^capa$|^kimono$|^capa[sz]?$|^camisola$|^chaqueta casaca$|^chaquetilla$|^chaquetq$|^chaquta$|^chaquetq/falda$|^cazadora$|^cazadoras$|^blazer$|^sudadera$|^sobrecamisa$|^tunica$|^t[uú]nica$|^kaftan$|^gabardina$|^guardapolvos$|^chubasquero$|^total look$|^falda pantalon$|^parcka$|^parka$|^cardigan$|^rebecon$|^bomber$|^lencero$|^mallas$|^leggin$|^legging$|^leggings$|^bikini$|^americana$|^bañador$|^bermuda$|^bermudas$|^short$|^short /minifalda$|^falda short$|^jersey/pantalon$|^traje pantal[oó]n$|^gasa$|^gayumbo$" {
      return [pscustomobject]@{
        Category = "Ropa"
        Subtype = Normalize-SubtypeName $normalized
      }
    }
    "^bolso[s]?$|^bolsitos$|^bolsito$|^bolson$|^minibolsito$|^bombonera[s]?$|^clunch$|^clutch$|^neceser(es)?$|^cartera[s]?$|^cesto[s]?$|^bolsa[s]?$|^tote bag$|^capazo$|^portaordenador$|^monederos$" {
      return [pscustomobject]@{
        Category = "Bolsos"
        Subtype = Normalize-SubtypeName $normalized
      }
    }
    "^anillo[s]?$|^collar(es)?$|^pendientes$|^aros$|^pulsera[s]?$|^broche[s]?$|^gargantilla[s]?$|^cadenas?$|^choker[s]?$|^juego[s]?$|^brazalete$|^bisuteria$|^colgante[s]?$" {
      return [pscustomobject]@{
        Category = "Joyería"
        Subtype = Normalize-SubtypeName $normalized
      }
    }
    "^zapato[s]?$|^sandalia[s]?$|^bot[ií]n(es)?$|^calzado$" {
      return [pscustomobject]@{
        Category = "Calzado"
        Subtype = Normalize-SubtypeName $normalized
      }
    }
    "^aroma$|^ambientadores$|^hogar$" {
      return [pscustomobject]@{
        Category = "Hogar"
        Subtype = Normalize-SubtypeName $normalized
      }
    }
    "^accesorio[s]?$|^pañuelo[s]?$|^sombrero[s]?$|^cuello[s]?$|^cinturon$|^cintur[oó]n$|^cinturones$|^mantoncillo$|^mantoncillos$|^capelina$|^capelinas$|^abanicos$|^abanico$|^gafas$|^bufanda$|^bufandas$|^estolas$|^estola$|^peineta$|^peinetas$|^prendidos$|^prendido$|^calcetines$|^portamoviles$|^portamovil$|^portam[oó]vil$|^flores$|^gorro$|^gorritos$|^guantes$|^pinzas$|^coronas$|^flor prendidos$|^fundas de gafas$|^plumas$|^manguitos$|^pasmina[s]?$" {
      return [pscustomobject]@{
        Category = "Accesorios"
        Subtype = Normalize-SubtypeName $normalized
      }
    }
    "^amiguris$|^muñeco$|^cajas$" {
      return [pscustomobject]@{
        Category = "Hogar"
        Subtype = Normalize-SubtypeName $normalized
      }
    }
    default {
      $category = Normalize-CategoryName $RawCategory
      $subtype = ""

      if ($category -eq "Ropa") {
        $subtype = Guess-SubtypeName -Category $category -Description $Description
      }

      return [pscustomobject]@{
        Category = $category
        Subtype = $subtype
      }
    }
  }
}

function Normalize-SeasonName {
  param([string]$Value)

  $normalized = (Normalize-Text $Value).ToLowerInvariant()

  switch -Regex ($normalized) {
    "primavera" { return "Primavera" }
    "verano" { return "Verano" }
    "oto[nñ]o|otño" { return "Otoño" }
    "^in$|invierno|iniverno" { return "Invierno" }
    default {
      if ([string]::IsNullOrWhiteSpace($normalized)) {
        return ""
      }

      $textInfo = [System.Globalization.CultureInfo]::GetCultureInfo("es-ES").TextInfo
      return $textInfo.ToTitleCase($normalized)
    }
  }
}

function Guess-SubtypeName {
  param(
    [string]$Category,
    [string]$Description
  )

  if ($Category -ne "Ropa") {
    return ""
  }

  $text = (Normalize-Text $Description).ToLowerInvariant()

  $patterns = @(
    @{ Pattern = "chaqueta|chaquet[oó]n"; Name = "Chaqueta" },
    @{ Pattern = "blusa|blus[oó]n"; Name = "Blusa" },
    @{ Pattern = "camisa|camisol"; Name = "Camisa" },
    @{ Pattern = "camiseta"; Name = "Camiseta" },
    @{ Pattern = "vestido"; Name = "Vestido" },
    @{ Pattern = "falda"; Name = "Falda" },
    @{ Pattern = "pantal[oó]n"; Name = "Pantalón" },
    @{ Pattern = "mono"; Name = "Mono" },
    @{ Pattern = "jersey"; Name = "Jersey" },
    @{ Pattern = "top"; Name = "Top" },
    @{ Pattern = "torera"; Name = "Torera" },
    @{ Pattern = "poncho"; Name = "Poncho" },
    @{ Pattern = "kimono"; Name = "Kimono" },
    @{ Pattern = "capa"; Name = "Capa" },
    @{ Pattern = "chaleco"; Name = "Chaleco" }
  )

  foreach ($pattern in $patterns) {
    if ($text -match $pattern.Pattern) {
      return $pattern.Name
    }
  }

  return ""
}

function Get-SupplierCandidate {
  param(
    [array]$SupplierMaster,
    [string]$Code,
    [string]$Description,
    [string]$Observations = ""
  )

  $codeText = Normalize-Text $Code
  $descriptionText = Normalize-Text $Description
  $observationsText = Normalize-Text $Observations
  $prefix = ""
  $descriptionKey = Normalize-MatchKey $descriptionText
  $observationsKey = Normalize-MatchKey $observationsText

  if ($codeText.Length -ge 2) {
    $prefix = $codeText.Substring(0, 2).ToUpperInvariant()
  }

  if ($codeText -like "LEG*") {
    $prefix = ""
  }

  $prefixOverrides = @{
    "BB" = "Baba Desing"
    "BS" = "Sorena"
    "LP" = "Lola Pendientes"
    "3R" = "3R"
  }

  if ($prefixOverrides.ContainsKey($prefix)) {
    $forced = $SupplierMaster | Where-Object { $_.supplier_name -eq $prefixOverrides[$prefix] } | Select-Object -First 1
    if ($forced) {
      return [pscustomobject]@{
        supplier_name = $forced.supplier_name
        supplier_code = $forced.supplier_code
        supplier_type = $forced.supplier_type
        commission_pct = $forced.commission_pct
        is_active = $forced.is_active
        notes = $forced.notes
        match_issue = ""
      }
    }
  }

  if ($descriptionKey -like "*silvina*" -or $observationsKey -like "*silvina*") {
    $silvina = $SupplierMaster | Where-Object { $_.supplier_name -eq "Silvina" } | Select-Object -First 1
    return [pscustomobject]@{
      supplier_name = $silvina.supplier_name
      supplier_code = $silvina.supplier_code
      supplier_type = $silvina.supplier_type
      commission_pct = $silvina.commission_pct
      is_active = $silvina.is_active
      notes = $silvina.notes
      match_issue = ""
    }
  }

  if ($descriptionKey -like "*soniamacias*" -or $observationsKey -like "*soniamacias*") {
    $sonia = $SupplierMaster | Where-Object { $_.supplier_name -eq "Sonia Macías" } | Select-Object -First 1
    return [pscustomobject]@{
      supplier_name = $sonia.supplier_name
      supplier_code = $sonia.supplier_code
      supplier_type = $sonia.supplier_type
      commission_pct = $sonia.commission_pct
      is_active = $sonia.is_active
      notes = $sonia.notes
      match_issue = ""
    }
  }

  if ($descriptionKey -like "*margafbi*" -or $observationsKey -like "*margafbi*") {
    $marga = $SupplierMaster | Where-Object { $_.supplier_name -eq "Marga FBI" } | Select-Object -First 1
    return [pscustomobject]@{
      supplier_name = $marga.supplier_name
      supplier_code = $marga.supplier_code
      supplier_type = $marga.supplier_type
      commission_pct = $marga.commission_pct
      is_active = $marga.is_active
      notes = $marga.notes
      match_issue = ""
    }
  }

  if ($prefix) {
    $codeMatches = @($SupplierMaster | Where-Object { $_.supplier_code -eq $prefix })
    if ($codeMatches.Count -eq 1) {
      $match = $codeMatches[0]
      return [pscustomobject]@{
        supplier_name = $match.supplier_name
        supplier_code = $match.supplier_code
        supplier_type = $match.supplier_type
        commission_pct = $match.commission_pct
        is_active = $match.is_active
        notes = $match.notes
        match_issue = ""
      }
    }
    if ($codeMatches.Count -gt 1) {
      if ($prefix -eq "SM") {
        $silvina = $codeMatches | Where-Object { $_.supplier_name -eq "Silvina" } | Select-Object -First 1
        if ($silvina) {
          return [pscustomobject]@{
            supplier_name = $silvina.supplier_name
            supplier_code = $silvina.supplier_code
            supplier_type = $silvina.supplier_type
            commission_pct = $silvina.commission_pct
            is_active = $silvina.is_active
            notes = $silvina.notes
            match_issue = ""
          }
        }
      }
      $activeMatch = $codeMatches | Where-Object { $_.is_active } | Select-Object -First 1
      if ($activeMatch) {
        return [pscustomobject]@{
          supplier_name = $activeMatch.supplier_name
          supplier_code = $activeMatch.supplier_code
          supplier_type = $activeMatch.supplier_type
          commission_pct = $activeMatch.commission_pct
          is_active = $activeMatch.is_active
          notes = (($activeMatch.notes, "Código compartido con otros proveedores") | Where-Object { $_ }) -join "; "
          match_issue = "ambiguous_supplier_code"
        }
      }
    }

    $aliasMatches = @(
      $SupplierMaster | Where-Object {
        $aliasKeys = @($_.alias_keys -split "\|" | Where-Object { $_ })
        $aliasKeys -contains (Normalize-MatchKey $prefix)
      }
    )

    if ($aliasMatches.Count -eq 1) {
      $match = $aliasMatches[0]
      return [pscustomobject]@{
        supplier_name = $match.supplier_name
        supplier_code = $match.supplier_code
        supplier_type = $match.supplier_type
        commission_pct = $match.commission_pct
        is_active = $match.is_active
        notes = $match.notes
        match_issue = ""
      }
    }
  }

  $searchKeys = @(
    Normalize-MatchKey $descriptionText
    Normalize-MatchKey $observationsText
  ) | Where-Object { $_ } | Select-Object -Unique

  foreach ($key in $searchKeys) {
    foreach ($supplier in $SupplierMaster) {
      $aliasKeys = @($supplier.alias_keys -split "\|" | Where-Object { $_ })
      $matchesAlias = ($aliasKeys -contains $key)
      if (-not $matchesAlias) {
        foreach ($aliasKey in $aliasKeys) {
          if ($aliasKey.Length -ge 4 -and $key -like "*$aliasKey*") {
            $matchesAlias = $true
            break
          }
        }
      }

      if ($matchesAlias) {
        return [pscustomobject]@{
          supplier_name = $supplier.supplier_name
          supplier_code = $supplier.supplier_code
          supplier_type = $supplier.supplier_type
          commission_pct = $supplier.commission_pct
          is_active = $supplier.is_active
          notes = $supplier.notes
          match_issue = ""
        }
      }
    }
  }

  return [pscustomobject]@{
    supplier_name = ""
    supplier_code = $prefix
    supplier_type = ""
    commission_pct = ""
    is_active = $true
    notes = ""
    match_issue = if ($prefix) { "unknown_supplier_code" } else { "missing_supplier_candidate" }
  }
}

function Normalize-PaymentMethod {
  param([string]$Value)

  $normalized = (Normalize-Text $Value).ToLowerInvariant()

  switch -Regex ($normalized) {
    "tpv|tarjeta" { return "CARD" }
    "efectivo" { return "CASH" }
    "bizum" { return "BIZUM" }
    default { return "" }
  }
}

function Normalize-DiscountPct {
  param([string]$Value)

  $text = Normalize-Text $Value
  if (-not $text) {
    return ""
  }

  $normalized = $text -replace ",", "."
  $number = 0.0

  if (-not [double]::TryParse($normalized, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    return ""
  }

  if ($number -ge 0 -and $number -le 1) {
    return [math]::Round($number * 100, 2)
  }

  return [math]::Round($number, 2)
}

function Normalize-Decimal {
  param([string]$Value)

  $text = Normalize-Text $Value
  if (-not $text) {
    return ""
  }

  $normalized = $text -replace ",", "."
  $number = 0.0

  if (-not [double]::TryParse($normalized, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    return ""
  }

  return [math]::Round($number, 2)
}

function Get-SlugToken {
  param([string]$Value)

  $key = Normalize-MatchKey $Value
  if (-not $key) {
    return "item"
  }

  if ($key.Length -gt 10) {
    return $key.Substring(0, 10)
  }

  return $key
}

function New-LegacyCode {
  param(
    [string]$Prefix,
    [string]$Seed,
    [int]$Index
  )

  $token = Get-SlugToken $Seed
  return "{0}-{1}-{2:D4}" -f $Prefix, $token.ToUpperInvariant(), $Index
}

function Get-YearMonthFromSheetName {
  param([string]$SheetName)

  $name = $SheetName.ToUpperInvariant()
  $monthMap = @{
    "ENERO" = 1
    "FEBRERO" = 2
    "FEBR" = 2
    "MARZO" = 3
    "ABRIL" = 4
    "MAYO" = 5
    "JUNIO" = 6
    "JULIO" = 7
    "AGOSTO" = 8
    "SEPTIEMBRE" = 9
    "SEPT" = 9
    "OCTUBRE" = 10
    "OCT" = 10
    "NOVIEMBRE" = 11
    "NOV" = 11
    "DICIEMBRE" = 12
    "DIC" = 12
  }

  $year = $null
  if ($name -match "26") { $year = 2026 }
  elseif ($name -match "25") { $year = 2025 }
  elseif ($name -match "2024") { $year = 2024 }
  elseif ($name -match "2023") { $year = 2023 }

  $month = $null
  foreach ($key in $monthMap.Keys) {
    if ($name -like "*$key*") {
      $month = $monthMap[$key]
      break
    }
  }

  if ($null -eq $year -or $null -eq $month) {
    return $null
  }

  return [pscustomobject]@{
    Year = $year
    Month = $month
  }
}

function Convert-ExcelDate {
  param([string]$Value)

  $text = Normalize-Text $Value
  if (-not $text) {
    return $null
  }

  $numeric = 0.0
  if ([double]::TryParse(($text -replace ",", "."), [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$numeric)) {
    if ($numeric -gt 10000) {
      return [datetime]::FromOADate($numeric)
    }
  }

  $formats = @(
    "d/M/yy",
    "dd/MM/yy",
    "d/M/yyyy",
    "dd/MM/yyyy",
    "d-M-yy",
    "dd-MM-yy",
    "d-M-yyyy",
    "dd-MM-yyyy"
  )

  foreach ($format in $formats) {
    try {
      return [datetime]::ParseExact($text, $format, [System.Globalization.CultureInfo]::GetCultureInfo("es-ES"))
    } catch {
    }
  }

  try {
    return [datetime]::Parse($text, [System.Globalization.CultureInfo]::GetCultureInfo("es-ES"))
  } catch {
  }

  return $null
}

function Ensure-Directory {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

Ensure-Directory -Path $OutputDir

$supplierMaster = Get-SupplierMaster
$miMarcaSupplier = $supplierMaster | Where-Object { $_.supplier_name -eq "MiMarca" } | Select-Object -First 1
$margaSupplier = $supplierMaster | Where-Object { $_.supplier_name -eq "Marga FBI" } | Select-Object -First 1
$existingCodes = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$generatedProductCodeCounter = 1
$generatedSaleCodeCounter = 1

$sheets = Get-XlsxWorkbookData -Path $InputPath
$sheetByName = @{}
foreach ($sheet in $sheets) {
  $sheetByName[$sheet.Name] = $sheet
}

$brandRows = @()
if ($sheetByName.ContainsKey("MARCAS")) {
  foreach ($row in $sheetByName["MARCAS"].Rows | Select-Object -Skip 1) {
    $name = Normalize-Text $row[0]
    $pct = if ($row.Count -gt 1) { Normalize-Decimal $row[1] } else { "" }

    if (-not $name) {
      continue
    }

    $brandRows += [pscustomobject]@{
      supplier_name = $name
      commission_pct = $pct
      source = "MARCAS"
    }
  }
}

$productRows = @()
if ($sheetByName.ContainsKey("PRODUCTO NUEVO")) {
  foreach ($row in $sheetByName["PRODUCTO NUEVO"].Rows | Select-Object -Skip 1) {
    if ($row.Count -lt 11) {
      continue
    }

    $legacyDescription = Normalize-Text $row[2]
    $legacyCategory = Normalize-Text $row[3]
    $legacyColor = Normalize-Text $row[4]
    $legacyStyle = Normalize-Text $row[5]
    $legacySeason = Normalize-Text $row[6]
    $legacySize = Normalize-Text $row[7]
    $legacyCode = Normalize-Text $row[8]
    $legacyPrice = Normalize-Decimal $row[9]
    $stockTotal = Normalize-Decimal $row[10]
    $stockAvailable = if ($row.Count -gt 11) { Normalize-Decimal $row[11] } else { "" }
    $legacyYear = if ($row.Count -gt 12) { Normalize-Decimal $row[12] } else { "" }

    if ($legacyCode -eq ",") {
      $legacyCode = ""
    }

    $legacyCodeKey = Normalize-MatchKey $legacyCode

    if (
      ((-not $legacyDescription -and -not $legacyCode)) -or
      ($legacyCodeKey -eq "codigonogenerado") -or
      ($legacyCodeKey -eq "cdigonogenerado") -or
      ($legacyCodeKey -like "*nogenerado")
    ) {
      continue
    }

    $taxonomy = Get-CategorySubtypeProposal -RawCategory $legacyCategory -Description $legacyDescription
    $category = $taxonomy.Category
    $season = Normalize-SeasonName $legacySeason
    $subtype = $taxonomy.Subtype
    $issues = @()

    if (-not $legacyCode) {
      do {
        $generatedCode = New-LegacyCode -Prefix "LEGP" -Seed $legacyDescription -Index $generatedProductCodeCounter
        $generatedProductCodeCounter++
      } while ($existingCodes.Contains($generatedCode))

      $legacyCode = $generatedCode
    }

    [void]$existingCodes.Add($legacyCode)

    if (-not $category) { $issues += "missing_category" }
    if (-not $legacyPrice) {
      $legacyPrice = 0
    }
    if (-not $stockAvailable -and -not $stockTotal) {
      $stockAvailable = 0
    }

    $supplierMatch = Get-SupplierCandidate -SupplierMaster $supplierMaster -Code $legacyCode -Description $legacyDescription
    $descriptionKey = Normalize-MatchKey $legacyDescription

    if (-not $supplierMatch.supplier_name) {
      if ($descriptionKey -like "*margabfi*" -or $descriptionKey -like "*margafbi*") {
        $supplierMatch = [pscustomobject]@{
          supplier_name = $margaSupplier.supplier_name
          supplier_code = $margaSupplier.supplier_code
          supplier_type = $margaSupplier.supplier_type
          commission_pct = $margaSupplier.commission_pct
          is_active = $margaSupplier.is_active
          notes = $margaSupplier.notes
          match_issue = ""
        }
      } else {
        $supplierMatch = [pscustomobject]@{
          supplier_name = $miMarcaSupplier.supplier_name
          supplier_code = $miMarcaSupplier.supplier_code
          supplier_type = $miMarcaSupplier.supplier_type
          commission_pct = $miMarcaSupplier.commission_pct
          is_active = $miMarcaSupplier.is_active
          notes = $miMarcaSupplier.notes
          match_issue = ""
        }
      }
    }

    $productRows += [pscustomobject]@{
      legacy_code = $legacyCode
      legacy_description = $legacyDescription
      category_raw = $legacyCategory
      color_raw = $legacyColor
      style_raw = $legacyStyle
      season_raw = $legacySeason
      size_raw = $legacySize
      price_raw = $legacyPrice
      stock_total_raw = $stockTotal
      stock_available_raw = $stockAvailable
      year_raw = $legacyYear
      code = $legacyCode
      name = $legacyDescription
      description = $legacyDescription
      category = $category
      subtype = $subtype
      season = $season
      size = $legacySize
      color = $legacyColor
      base_price = $legacyPrice
      stock_initial = if ($stockAvailable -ne "") { $stockAvailable } elseif ($stockTotal -ne "") { $stockTotal } else { 0 }
      supplier_code = $supplierMatch.supplier_code
      supplier_candidate = $supplierMatch.supplier_name
      supplier_type = $supplierMatch.supplier_type
      supplier_is_active = $supplierMatch.is_active
      supplier_notes = $supplierMatch.notes
      product_type = if ($supplierMatch.supplier_type -in @("deposit", "special")) { "CONSIGNMENT" } else { "OWNED" }
      store_commission_pct = $supplierMatch.commission_pct
      import_status = if ($issues.Count -eq 0 -and -not $supplierMatch.match_issue) { "ready_review" } else { "needs_review" }
      import_issue = ($issues -join ";")
    }

    if ($supplierMatch.match_issue) {
      $productRows[-1].import_issue = ((@($productRows[-1].import_issue, $supplierMatch.match_issue) | Where-Object { $_ }) -join ";")
      $productRows[-1].import_status = "needs_review"
    }
  }
}

$productsByCode = @{}
$productsByDescription = @{}
foreach ($product in $productRows) {
  if ($product.code) {
    $productsByCode[$product.code] = $product
  }

  $descKey = Normalize-MatchKey $product.description
  if ($descKey) {
    if (-not $productsByDescription.ContainsKey($descKey)) {
      $productsByDescription[$descKey] = @()
    }
    $productsByDescription[$descKey] += $product
  }
}

$productIssues = $productRows | Where-Object { $_.import_issue -ne "" }

$salesRows = @()
$salesIssues = @()
$receiptCountersByDate = @{}

$salesSheets = $sheets | Where-Object {
  $_.Name -notin @("PRODUCTO NUEVO", "PRODUCTO", "MARCAS", "INGRESOSGASTOS")
}

foreach ($sheet in $salesSheets) {
  $period = Get-YearMonthFromSheetName -SheetName $sheet.Name
  if (-not $period) {
    continue
  }

  $rowIndex = 0
  foreach ($row in $sheet.Rows | Select-Object -Skip 1) {
    $rowIndex++
    if ($row.Count -lt 7) {
      continue
    }

    $rawDate = if ($row.Count -gt 0) { Normalize-Text $row[0] } else { "" }
    $receipt = if ($row.Count -gt 1) { Normalize-Text $row[1] } else { "" }
    $code = if ($row.Count -gt 2) { Normalize-Text $row[2] } else { "" }
    $description = if ($row.Count -gt 3) { Normalize-Text $row[3] } else { "" }
    $paymentRaw = if ($row.Count -gt 4) { Normalize-Text $row[4] } else { "" }
    $discountRaw = if ($row.Count -gt 5) { Normalize-Text $row[5] } else { "" }
    $priceRaw = if ($row.Count -gt 6) { Normalize-Text $row[6] } else { "" }
    $observations = if ($row.Count -gt 7) { Normalize-Text $row[7] } else { "" }

    if (-not $receipt -and -not $code -and -not $description) {
      continue
    }

    $saleDate = Convert-ExcelDate $rawDate
    if (-not $saleDate) {
      $saleDate = Get-Date -Year $period.Year -Month $period.Month -Day 1
    } elseif ($saleDate.Year -lt 2020 -or $saleDate.Year -gt 2035) {
      $safeDay = [Math]::Min([Math]::Max($saleDate.Day, 1), [datetime]::DaysInMonth($period.Year, $period.Month))
      $saleDate = Get-Date -Year $period.Year -Month $period.Month -Day $safeDay
    }

    $paymentMethod = Normalize-PaymentMethod $paymentRaw
    $discountPct = Normalize-DiscountPct $discountRaw
    $soldUnitPrice = Normalize-Decimal $priceRaw
    $issues = @()
    $matchedProduct = $null
    $saleDateKey = $saleDate.ToString("yyyy-MM-dd")

    if (-not $receiptCountersByDate.ContainsKey($saleDateKey)) {
      $receiptCountersByDate[$saleDateKey] = 0
    }

    $receiptNumeric = 0
    if ($receipt) {
      $receiptNormalized = $receipt -replace ",", "."
      if ([double]::TryParse($receiptNormalized, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$receiptNumeric)) {
        $receiptCountersByDate[$saleDateKey] = [Math]::Max($receiptCountersByDate[$saleDateKey], [int][Math]::Floor($receiptNumeric))
      }
    }

    if (-not $receipt) {
      $receiptCountersByDate[$saleDateKey] = [int]$receiptCountersByDate[$saleDateKey] + 1
      $receipt = [string]$receiptCountersByDate[$saleDateKey]
    }

    if ($code -and $productsByCode.ContainsKey($code)) {
      $matchedProduct = $productsByCode[$code]
    }

    if (-not $description -and $matchedProduct) {
      $description = $matchedProduct.description
    }

    if (-not $description) {
      $description = "Producto sin nombre y descripcion $generatedSaleCodeCounter"
    }

    if (-not $description -and $code) {
      $description = "Producto legacy $code"
    }

    if (-not $code -and $description) {
      $descKey = Normalize-MatchKey $description
      $candidateProducts = @()
      if ($descKey -and $productsByDescription.ContainsKey($descKey)) {
        $candidateProducts = @($productsByDescription[$descKey])
      }

      if ($candidateProducts.Count -eq 1) {
        $matchedProduct = $candidateProducts[0]
        $code = $matchedProduct.code
      } else {
        do {
          $generatedSaleCode = New-LegacyCode -Prefix "LEGS" -Seed ("{0}-{1}-{2}-{3}" -f $description, $sheet.Name, $receipt, $rowIndex) -Index $generatedSaleCodeCounter
          $generatedSaleCodeCounter++
        } while ($existingCodes.Contains($generatedSaleCode))

        $code = $generatedSaleCode
        [void]$existingCodes.Add($code)
      }
    }

    if (-not $matchedProduct -and $code -and $productsByCode.ContainsKey($code)) {
      $matchedProduct = $productsByCode[$code]
    }

    if (-not $receipt) { $issues += "missing_receipt" }
    if (-not $description) { $issues += "missing_description" }
    if (-not $soldUnitPrice) { $issues += "missing_price" }
    if (-not $paymentMethod -and $paymentRaw) { $issues += "unknown_payment_method" }

    $supplierMatch = Get-SupplierCandidate -SupplierMaster $supplierMaster -Code $code -Description $description -Observations $observations

    if ((-not $supplierMatch.supplier_name) -and $matchedProduct) {
      $supplierMatch = [pscustomobject]@{
        supplier_name = $matchedProduct.supplier_candidate
        supplier_code = $matchedProduct.supplier_code
        supplier_type = $matchedProduct.supplier_type
        commission_pct = $matchedProduct.store_commission_pct
        is_active = $matchedProduct.supplier_is_active
        notes = $matchedProduct.supplier_notes
        match_issue = ""
      }
    }

    if (-not $supplierMatch.supplier_name) {
      $supplierMatch = [pscustomobject]@{
        supplier_name = $miMarcaSupplier.supplier_name
        supplier_code = $miMarcaSupplier.supplier_code
        supplier_type = $miMarcaSupplier.supplier_type
        commission_pct = $miMarcaSupplier.commission_pct
        is_active = $miMarcaSupplier.is_active
        notes = $miMarcaSupplier.notes
        match_issue = ""
      }
    }

    if ((-not $soldUnitPrice) -and $matchedProduct -and $matchedProduct.base_price -ne "") {
      $soldUnitPrice = $matchedProduct.base_price
      $issues = @($issues | Where-Object { $_ -ne "missing_price" })
    }

    $issues = @($issues | Where-Object { $_ -notin @("missing_receipt", "missing_description", "missing_supplier_candidate") })

    $saleRecord = [pscustomobject]@{
      sheet_name = $sheet.Name
      sale_date = $saleDate.ToString("yyyy-MM-dd")
      legacy_receipt = $receipt
      product_code = $code
      product_description = $description
      payment_method_raw = $paymentRaw
      payment_method = $paymentMethod
      discount_raw = $discountRaw
      discount_pct = $discountPct
      sold_unit_price = $soldUnitPrice
      observations_raw = $observations
      supplier_code = $supplierMatch.supplier_code
      supplier_candidate = $supplierMatch.supplier_name
      supplier_type = $supplierMatch.supplier_type
      supplier_is_active = $supplierMatch.is_active
      supplier_notes = $supplierMatch.notes
      import_status = if ($issues.Count -eq 0 -and -not $supplierMatch.match_issue) { "ready_review" } else { "needs_review" }
      import_issue = ($issues -join ";")
    }

    if ($supplierMatch.match_issue) {
      $saleRecord.import_issue = ((@($saleRecord.import_issue, $supplierMatch.match_issue) | Where-Object { $_ }) -join ";")
      $saleRecord.import_status = "needs_review"
    }

    $salesRows += $saleRecord

    if ($issues.Count -gt 0) {
      $salesIssues += $saleRecord
    }
  }
}

$summary = @(
  [pscustomobject]@{ dataset = "products_normalized"; rows = @($productRows).Count },
  [pscustomobject]@{ dataset = "products_issues"; rows = @($productIssues).Count },
  [pscustomobject]@{ dataset = "sales_normalized"; rows = @($salesRows).Count },
  [pscustomobject]@{ dataset = "sales_issues"; rows = @($salesIssues).Count },
  [pscustomobject]@{ dataset = "suppliers_master"; rows = @($supplierMaster).Count },
  [pscustomobject]@{ dataset = "suppliers_detected"; rows = @($brandRows).Count }
)

$categorySubtypeReview = $productRows |
  Group-Object category_raw |
  Sort-Object Count -Descending |
  ForEach-Object {
    $first = $_.Group | Select-Object -First 1
    [pscustomobject]@{
      category_raw = $_.Name
      product_count = $_.Count
      proposed_category = $first.category
      proposed_subtype = $first.subtype
      sample_descriptions = (($_.Group | Select-Object -ExpandProperty legacy_description -First 3) -join " | ")
    }
  }

$taxonomyReview = $productRows |
  Group-Object category, subtype, season |
  Sort-Object Count -Descending |
  ForEach-Object {
    $first = $_.Group | Select-Object -First 1
    [pscustomobject]@{
      category = $first.category
      subtype = $first.subtype
      season = $first.season
      product_count = $_.Count
    }
  }

$supplierPrefixReview = @(
  $productRows |
    Where-Object { $_.supplier_code -and $_.supplier_candidate -eq "" } |
    Group-Object supplier_code |
    Sort-Object Count -Descending |
    ForEach-Object {
      [pscustomobject]@{
        source = "products"
        supplier_code = $_.Name
        row_count = $_.Count
        sample_codes = (($_.Group | Select-Object -ExpandProperty code -First 5) -join " | ")
        sample_names = (($_.Group | Select-Object -ExpandProperty name -First 5) -join " | ")
      }
    }
  $salesRows |
    Where-Object { $_.supplier_code -and $_.supplier_candidate -eq "" } |
    Group-Object supplier_code |
    Sort-Object Count -Descending |
    ForEach-Object {
      [pscustomobject]@{
        source = "sales"
        supplier_code = $_.Name
        row_count = $_.Count
        sample_codes = (($_.Group | Select-Object -ExpandProperty product_code -First 5) -join " | ")
        sample_names = (($_.Group | Select-Object -ExpandProperty product_description -First 5) -join " | ")
      }
    }
)

$summary | Export-Csv -Path (Join-Path $OutputDir "00_summary.csv") -NoTypeInformation -Encoding UTF8
$supplierMaster | Select-Object supplier_name, supplier_code, supplier_type, commission_pct, is_active, notes | Export-Csv -Path (Join-Path $OutputDir "01_suppliers_master.csv") -NoTypeInformation -Encoding UTF8
$brandRows | Sort-Object supplier_name -Unique | Export-Csv -Path (Join-Path $OutputDir "02_suppliers_detected.csv") -NoTypeInformation -Encoding UTF8
$productRows | Export-Csv -Path (Join-Path $OutputDir "03_products_normalized.csv") -NoTypeInformation -Encoding UTF8
$productIssues | Export-Csv -Path (Join-Path $OutputDir "04_product_issues.csv") -NoTypeInformation -Encoding UTF8
$salesRows | Export-Csv -Path (Join-Path $OutputDir "05_sales_normalized.csv") -NoTypeInformation -Encoding UTF8
$salesIssues | Export-Csv -Path (Join-Path $OutputDir "06_sales_issues.csv") -NoTypeInformation -Encoding UTF8
$categorySubtypeReview | Export-Csv -Path (Join-Path $OutputDir "07_category_subtype_review.csv") -NoTypeInformation -Encoding UTF8
$taxonomyReview | Export-Csv -Path (Join-Path $OutputDir "08_taxonomy_review.csv") -NoTypeInformation -Encoding UTF8
$supplierPrefixReview | Export-Csv -Path (Join-Path $OutputDir "09_supplier_prefix_review.csv") -NoTypeInformation -Encoding UTF8

$readmePath = Join-Path $OutputDir "README_review.md"
@"
# Revision de normalizacion

Este paquete es previo a cualquier importacion.

## Archivos

- `00_summary.csv`: recuento rapido por dataset.
- `01_suppliers_master.csv`: tabla maestra de proveedores con codigo, tipo, comision y estado.
- `02_suppliers_detected.csv`: proveedores/marcas detectados desde la hoja `MARCAS`.
- `03_products_normalized.csv`: propuesta de catalogo normalizado a revisar.
- `04_product_issues.csv`: productos con incidencias o dudas.
- `05_sales_normalized.csv`: ventas historicas normalizadas a revisar.
- `06_sales_issues.csv`: lineas de venta con incidencias o dudas.
- `07_category_subtype_review.csv`: propuesta de mapeo desde categoria cruda del Excel a categoria/subtipo.
- `08_taxonomy_review.csv`: combinaciones detectadas de categoria, subtipo y temporada.
- `09_supplier_prefix_review.csv`: prefijos/codigos de proveedor que aparecen en productos o ventas y todavia no estan resueltos.

## Reglas aplicadas

- `0.5` se interpreta como `50%`.
- `0.1` se interpreta como `10%`.
- `TPV` y `Tarjeta de credito` se normalizan a `CARD`.
- `Efectivo` se normaliza a `CASH`.
- `Bizum` se normaliza a `BIZUM`.
- `PRODUCTO NUEVO` es la fuente principal del catalogo.
- Las hojas mensuales son la fuente principal del historico de ventas.
- Si el codigo empieza por `MC`, se propone `MiMarca` como proveedor candidato.
- Si el codigo coincide con la tabla maestra de proveedores, se resuelve proveedor, tipo y comision.
- Los proveedores `deposit` y `special` se proponen como `CONSIGNMENT`.
- La taxonomia `categoria -> subtipo -> temporada` se propone directamente desde el Excel.
- El subtipo se obtiene primero desde la categoria cruda y, si no basta, desde palabras clave de la descripcion.

## Importante

Estos CSVs son para revision manual. No se ha importado nada al sistema.
"@ | Set-Content -Path $readmePath -Encoding UTF8

Write-Output "Normalization review files generated in: $OutputDir"
