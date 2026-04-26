param(
  [string]$InputCsv = "C:\Users\kevin\Documents\Playground\data\import-review\latest\11_legacy_products_from_sales.csv",
  [string]$SshHost = "docker-server-remote",
  [string]$RemoteDir = "/home/kevin/docker-services/mimarca-backoffice"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$buildScript = Join-Path $PSScriptRoot "build-sales-legacy-products.ps1"
if (-not (Test-Path $buildScript)) {
  throw "No se encuentra el generador de productos legacy: $buildScript"
}

powershell -ExecutionPolicy Bypass -File $buildScript

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
  throw "No se encuentra el CSV de productos legacy: $InputCsv"
}

$rows = Import-Csv -Path $InputCsv
$jsonPayload = $rows | ConvertTo-Json -Depth 6 -Compress
$payloadBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($jsonPayload))

$nodeScript = @'
const fs = require('fs');
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

async function main() {
  const rows = JSON.parse(Buffer.from(fs.readFileSync('/app/import-sales-legacy-products.payload.b64', 'utf8'), 'base64').toString('utf8'));

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const categoryMap = new Map(categories.map((item) => [repairText(item.name), item.id]));

  const subtypes = await prisma.productSubtype.findMany({
    select: { id: true, name: true, categoryId: true },
  });
  const subtypeMap = new Map(
    subtypes.map((item) => [`${item.categoryId}::${repairText(item.name)}`, item.id]),
  );

  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
  const supplierMap = new Map(suppliers.map((item) => [repairText(item.name), item.id]));

  const existingProducts = await prisma.product.findMany({ select: { code: true } });
  const existingCodes = new Set(existingProducts.map((item) => item.code));

  let imported = 0;
  const skipped = [];

  for (const row of rows) {
    if (existingCodes.has(row.code)) {
      continue;
    }

    const categoryId = categoryMap.get(repairText(row.category));
    const supplierId = supplierMap.get(repairText(row.supplier_candidate));
    if (!categoryId || !supplierId) {
      skipped.push({
        code: row.code,
        name: repairText(row.name),
        reason: !categoryId ? 'missing_category' : 'missing_supplier',
      });
      continue;
    }

    const productSubtypeId = row.subtype ? subtypeMap.get(`${categoryId}::${repairText(row.subtype)}`) ?? null : null;

    await prisma.product.create({
      data: {
        code: row.code,
        name: repairText(row.name),
        description: repairText(row.description) || repairText(row.name),
        categoryId,
        productSubtypeId,
        seasonId: null,
        size: null,
        color: null,
        basePrice: toDecimal(row.base_price, 0),
        cost: 0,
        stockCurrent: toInt(row.stock_initial, 0),
        productType: row.product_type === 'CONSIGNMENT' ? ProductType.CONSIGNMENT : ProductType.OWNED,
        supplierId,
        storeCommissionPct: row.store_commission_pct === '' ? null : toDecimal(row.store_commission_pct, 0),
        notes: 'Producto legacy generado desde ventas históricas',
        isActive: true,
      },
    });

    existingCodes.add(row.code);
    imported += 1;
  }

  console.log(JSON.stringify({ imported, skipped }, null, 2));
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
cat > /tmp/import-sales-legacy-products.payload.b64 <<'PAYLOAD_EOF'
$payloadBase64
PAYLOAD_EOF
cat > /tmp/import-sales-legacy-products.node.b64 <<'NODE_EOF'
$nodeScriptBase64
NODE_EOF
python3 - <<'PY'
import base64
from pathlib import Path
data = Path('/tmp/import-sales-legacy-products.node.b64').read_text(encoding='utf-8')
Path('/tmp/import-sales-legacy-products.node.js').write_text(base64.b64decode(data).decode('utf-8'), encoding='utf-8')
PY
docker compose exec -T app sh -lc 'cat > /app/import-sales-legacy-products.payload.b64' < /tmp/import-sales-legacy-products.payload.b64
docker compose exec -T app sh -lc 'cat > /app/import-sales-legacy-products.node.js' < /tmp/import-sales-legacy-products.node.js
docker compose exec -T app node /app/import-sales-legacy-products.node.js
rm -f /tmp/import-sales-legacy-products.payload.b64 /tmp/import-sales-legacy-products.node.b64 /tmp/import-sales-legacy-products.node.js
docker compose exec -T app sh -lc 'rm -f /app/import-sales-legacy-products.payload.b64 /app/import-sales-legacy-products.node.js'
"@

$remoteScript | & $sshPath $SshHost "bash -s"
