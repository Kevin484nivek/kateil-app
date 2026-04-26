param(
  [string]$InputCsv = "C:\Users\kevin\Documents\Playground\data\import-review\latest\03_products_normalized.csv",
  [string]$SshHost = "docker-server-remote",
  [string]$RemoteDir = "/home/kevin/docker-services/mimarca-backoffice"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$sshCandidates = @(
  "C:\Windows\System32\OpenSSH\ssh.exe",
  "C:\Windows\Sysnative\OpenSSH\ssh.exe",
  "C:\Program Files\Git\usr\bin\ssh.exe"
)

$sshPath = $sshCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $sshPath) {
  throw "No se encuentra ssh.exe en System32, Sysnative ni Git."
}

if (-not (Test-Path $InputCsv)) {
  throw "No se encuentra el CSV de productos: $InputCsv"
}

$rows = Import-Csv -Path $InputCsv
$jsonPayload = $rows | ConvertTo-Json -Depth 6 -Compress
$payloadBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($jsonPayload))

$nodeScript = @'
const { PrismaClient, ProductType } = require('@prisma/client');
const prisma = new PrismaClient();

function repairText(value) {
  if (value === undefined || value === null || value === '') return value ?? null;
  const text = String(value);
  if (!/[ÃÂ]/.test(text)) return text;

  try {
    return Buffer.from(text, 'latin1').toString('utf8');
  } catch {
    return text;
  }
}

function toNullableString(value) {
  if (value === undefined || value === null) return null;
  const text = repairText(String(value)).trim();
  return text === '' ? null : text;
}

function toDecimal(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function buildNotes(row) {
  const parts = [];
  if (row.legacy_code) parts.push(`Legacy code: ${row.legacy_code}`);
  if (row.category_raw) parts.push(`Category raw: ${repairText(row.category_raw)}`);
  if (row.style_raw) parts.push(`Style raw: ${repairText(row.style_raw)}`);
  if (row.year_raw) parts.push(`Year raw: ${row.year_raw}`);
  if (row.supplier_notes) parts.push(`Supplier notes: ${repairText(row.supplier_notes)}`);
  return parts.length ? parts.join(' | ') : null;
}

function inferCategoryFromText(text) {
  if (!text) return null;
  const normalized = repairText(String(text)).toLowerCase();

  if (/bañador|banador|pantal[oó]n|falda|kimono|corpiño|corpino/.test(normalized)) return 'Ropa';
  if (/pañuelo|mant[oó]n|manton/.test(normalized)) return 'Accesorios';
  if (/tote bag|clouch|clutch|cartera/.test(normalized)) return 'Bolsos';
  if (/peine|peinecillo/.test(normalized)) return 'Accesorios';
  if (/muñeco|muneco|decoraci[oó]n|bebe/.test(normalized)) return 'Hogar';

  return null;
}

const forcedCategoriesByCode = new Map([
  ['MCBAESCAVEU1806', 'Ropa'],
  ['3RMUROBEOTB2109', 'Hogar'],
  ['MCPANEEVINU1111', 'Ropa'],
  ['MCPANECAVEU1308', 'Ropa'],
  ['MCTRNECAINU1111', 'Ropa'],
  ['MCPAVECAINU1111', 'Ropa'],
  ['MCPAAZCAOTU2408', 'Accesorios'],
  ['MCPAFUCAOTU2408', 'Accesorios'],
  ['MCPACOCAOTU2408', 'Accesorios'],
  ['MCPANEEVOTU2709', 'Accesorios'],
  ['MCPAAMCAOTU2408', 'Accesorios'],
  ['MCPANACAOTU2408', 'Accesorios'],
  ['MCPANECAOTU2408', 'Accesorios'],
  ['MCPACOCAOTU2709', 'Accesorios'],
  ['MCPALUFEPRU1702', 'Accesorios'],
  ['HPPAMOFEINU0512', 'Accesorios'],
  ['MCCOCHCAVEU0507', 'Ropa'],
]);

const fs = require('fs');

async function main() {
  const rows = JSON.parse(Buffer.from(fs.readFileSync('/app/import-products.payload.b64', 'utf8'), 'base64').toString('utf8'));

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const categoryMap = new Map(categories.map((item) => [repairText(item.name), item.id]));
  const categoryNameById = new Map(categories.map((item) => [item.id, repairText(item.name)]));

  const subtypes = await prisma.productSubtype.findMany({
    select: { id: true, name: true, categoryId: true },
  });
  const subtypeMap = new Map(
    subtypes.map((item) => [`${item.categoryId}::${repairText(item.name)}`, item.id]),
  );
  const subtypeCategoryMap = new Map();
  for (const item of subtypes) {
    const name = repairText(item.name);
    if (!subtypeCategoryMap.has(name)) subtypeCategoryMap.set(name, new Set());
    subtypeCategoryMap.get(name).add(item.categoryId);
  }

  const seasons = await prisma.season.findMany({
    select: { id: true, name: true, categoryId: true },
  });
  const seasonMap = new Map(
    seasons.map((item) => [`${item.categoryId}::${repairText(item.name)}`, item.id]),
  );

  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
  const supplierMap = new Map(suppliers.map((item) => [repairText(item.name), item.id]));

  await prisma.stockMovement.deleteMany({});
  await prisma.product.deleteMany({});

  let imported = 0;
  const skipped = [];

  for (const row of rows) {
    let categoryName = repairText(row.category);
    const supplierName = repairText(row.supplier_candidate);
    const subtypeName = toNullableString(row.subtype);
    const seasonName = toNullableString(row.season);

    let categoryId = categoryMap.get(categoryName);
    const supplierId = supplierMap.get(supplierName);

    if (!categoryId && row.code && forcedCategoriesByCode.has(row.code)) {
      categoryName = forcedCategoriesByCode.get(row.code);
      categoryId = categoryMap.get(categoryName);
    }

    if (!categoryId && subtypeName) {
      const categoryCandidates = subtypeCategoryMap.get(repairText(subtypeName));
      if (categoryCandidates && categoryCandidates.size === 1) {
        categoryId = Array.from(categoryCandidates)[0];
        categoryName = categoryNameById.get(categoryId) ?? categoryName;
      }
    }

    if (!categoryId) {
      const inferredCategoryName =
        inferCategoryFromText(row.name) ||
        inferCategoryFromText(row.description) ||
        inferCategoryFromText(row.category_raw) ||
        inferCategoryFromText(subtypeName);

      if (inferredCategoryName) {
        categoryName = inferredCategoryName;
        categoryId = categoryMap.get(inferredCategoryName);
      }
    }

    if (!categoryId || !supplierId) {
      skipped.push({
        code: row.code,
        name: repairText(row.name),
        reason: !categoryId ? 'missing_category' : 'missing_supplier',
      });
      continue;
    }

    const productSubtypeId = subtypeName ? subtypeMap.get(`${categoryId}::${repairText(subtypeName)}`) ?? null : null;
    const seasonId = seasonName ? seasonMap.get(`${categoryId}::${repairText(seasonName)}`) ?? null : null;

    await prisma.product.create({
      data: {
        code: row.code,
        name: repairText(row.name),
        description: repairText(row.description) ?? repairText(row.name),
        categoryId,
        productSubtypeId,
        seasonId,
        size: toNullableString(row.size),
        color: toNullableString(row.color),
        basePrice: toDecimal(row.base_price, 0),
        cost: 0,
        stockCurrent: toInt(row.stock_initial, 0),
        productType: row.product_type === 'CONSIGNMENT' ? ProductType.CONSIGNMENT : ProductType.OWNED,
        supplierId,
        storeCommissionPct: row.store_commission_pct === '' ? null : toDecimal(row.store_commission_pct, 0),
        notes: buildNotes(row),
        isActive: true,
      },
    });

    imported += 1;
  }

  const count = await prisma.product.count();
  console.log(JSON.stringify({ imported, count, skipped }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
'@

$nodeScriptBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($nodeScript))
$remoteScript = @"
set -e
cd '$RemoteDir'
cat > /tmp/import-products.payload.b64 <<'PAYLOAD_EOF'
$payloadBase64
PAYLOAD_EOF
cat > /tmp/import-products.node.b64 <<'NODE_EOF'
$nodeScriptBase64
NODE_EOF
python3 - <<'PY'
import base64
from pathlib import Path
data = Path('/tmp/import-products.node.b64').read_text(encoding='utf-8')
Path('/tmp/import-products.node.js').write_text(base64.b64decode(data).decode('utf-8'), encoding='utf-8')
PY
docker compose exec -T app sh -lc 'cat > /app/import-products.payload.b64' < /tmp/import-products.payload.b64
docker compose exec -T app sh -lc 'cat > /app/import-products.node.js' < /tmp/import-products.node.js
docker compose exec -T app node /app/import-products.node.js
rm -f /tmp/import-products.payload.b64 /tmp/import-products.node.b64
rm -f /tmp/import-products.node.js
docker compose exec -T app sh -lc 'rm -f /app/import-products.payload.b64 /app/import-products.node.js'
"@

$remoteScript | & $sshPath $SshHost "bash -s"
