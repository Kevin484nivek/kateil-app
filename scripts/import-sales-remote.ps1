param(
  [string]$InputCsv = "C:\Users\kevin\Documents\Playground\data\import-review\latest\05_sales_normalized.csv",
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
  throw "No se encuentra el CSV de ventas: $InputCsv"
}

$rows = Import-Csv -Path $InputCsv
$jsonPayload = $rows | ConvertTo-Json -Depth 6 -Compress
$payloadBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($jsonPayload))

$nodeScript = @'
const fs = require('fs');
const { PrismaClient, ConsignmentSettlementMode, PaymentMethod, ProductType } = require('@prisma/client');
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

function toDecimal(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableString(value) {
  if (value === undefined || value === null) return null;
  const text = repairText(String(value)).trim();
  return text === '' ? null : text;
}

function normalizeReceipt(value) {
  if (value === undefined || value === null || value === '') return '1';
  const text = String(value).trim();
  const parsed = Number(text.replace(',', '.'));
  if (Number.isFinite(parsed)) return String(Math.trunc(parsed));
  return text.replace(/[^a-zA-Z0-9_-]+/g, '-') || '1';
}

function getPaymentMethod(value) {
  if (value === 'CASH') return PaymentMethod.CASH;
  if (value === 'BIZUM') return PaymentMethod.BIZUM;
  return PaymentMethod.CARD;
}

function buildSaleNumber(date, receipt) {
  return `HIST-${date.replaceAll('-', '')}-${receipt.padStart(4, '0')}`;
}

function buildSaleNotes(rows) {
  const noteParts = [];
  const sourceSheets = [...new Set(rows.map((row) => row.sheet_name).filter(Boolean))];
  if (sourceSheets.length) noteParts.push(`Source sheets: ${sourceSheets.join(', ')}`);

  const rawNotes = [...new Set(rows.map((row) => toNullableString(row.observations_raw)).filter(Boolean))];
  if (rawNotes.length) noteParts.push(`Legacy notes: ${rawNotes.join(' | ')}`);

  const rawDiscounts = [...new Set(rows.map((row) => toNullableString(row.discount_raw)).filter(Boolean))];
  if (rawDiscounts.length) noteParts.push(`Legacy discounts: ${rawDiscounts.join(', ')}`);

  return noteParts.length ? noteParts.join(' || ') : null;
}

async function main() {
  const rows = JSON.parse(Buffer.from(fs.readFileSync('/app/import-sales.payload.b64', 'utf8'), 'base64').toString('utf8'));

  const products = await prisma.product.findMany({
    select: {
      id: true,
      code: true,
      productType: true,
      cost: true,
      storeCommissionPct: true,
      supplier: {
        select: {
          applyVatToCost: true,
          consignmentSettlementMode: true,
        },
      },
    },
  });
  const productMap = new Map(products.map((product) => [product.code, product]));

  const user = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    throw new Error('No hay un usuario activo para asociar el histórico de ventas.');
  }

  await prisma.saleLine.deleteMany({});
  await prisma.sale.deleteMany({});

  const groupedSales = new Map();
  for (const row of rows) {
    const saleDate = row.sale_date;
    const receipt = normalizeReceipt(row.legacy_receipt);
    const key = `${saleDate}::${receipt}`;
    if (!groupedSales.has(key)) groupedSales.set(key, []);
    groupedSales.get(key).push(row);
  }

  let createdSales = 0;
  let createdLines = 0;
  const skipped = [];

  for (const [key, saleRows] of groupedSales.entries()) {
    const first = saleRows[0];
    const saleDate = first.sale_date;
    const receipt = normalizeReceipt(first.legacy_receipt);
    const saleNumber = buildSaleNumber(saleDate, receipt);
    const paymentMethod = getPaymentMethod(first.payment_method);

    const linePayloads = [];
    let saleTotal = 0;

    for (const row of saleRows) {
      const product = productMap.get(row.product_code);
      if (!product) {
        skipped.push({
          saleNumber,
          product_code: row.product_code,
          reason: 'missing_product',
        });
        continue;
      }

      const soldUnitPrice = toDecimal(row.sold_unit_price, 0);
      const quantity = 1;
      const subtotal = soldUnitPrice * quantity;
      const commissionPct =
        product.productType === ProductType.CONSIGNMENT &&
        product.supplier.consignmentSettlementMode !== ConsignmentSettlementMode.FIXED_COST
          ? toDecimal(product.storeCommissionPct, 0)
          : (product.storeCommissionPct === null ? null : toDecimal(product.storeCommissionPct, 0));
      const effectiveUnitCost =
        product.supplier.applyVatToCost && product.productType === ProductType.OWNED
          ? Number((toDecimal(product.cost, 0) * 1.21).toFixed(2))
          : toDecimal(product.cost, 0);
      const unitCostSnapshot =
        product.productType === ProductType.CONSIGNMENT &&
        product.supplier.consignmentSettlementMode !== ConsignmentSettlementMode.FIXED_COST
          ? null
          : Number(effectiveUnitCost.toFixed(2));

      let storeAmount = subtotal;
      let supplierAmount = 0;

      if (product.productType === ProductType.CONSIGNMENT) {
        if (product.supplier.consignmentSettlementMode === ConsignmentSettlementMode.FIXED_COST) {
          supplierAmount = Number((effectiveUnitCost * quantity).toFixed(2));
          storeAmount = Number((subtotal - supplierAmount).toFixed(2));
        } else {
          const pct = toDecimal(product.storeCommissionPct, 0);
          storeAmount = Number((subtotal * (pct / 100)).toFixed(2));
          supplierAmount = Number((subtotal - storeAmount).toFixed(2));
        }
      }

      linePayloads.push({
        productId: product.id,
        quantity,
        soldUnitPrice,
        subtotal,
        productTypeSnapshot: product.productType,
        unitCostSnapshot,
        storeCommissionPctSnapshot: commissionPct,
        storeAmount,
        supplierAmount,
      });
      saleTotal += subtotal;
    }

    if (!linePayloads.length) {
      skipped.push({
        saleNumber,
        product_code: null,
        reason: 'empty_sale_after_matching',
      });
      continue;
    }

    await prisma.sale.create({
      data: {
        saleNumber,
        date: new Date(`${saleDate}T12:00:00.000Z`),
        customerId: null,
        userId: user.id,
        paymentMethod,
        totalAmount: Number(saleTotal.toFixed(2)),
        notes: buildSaleNotes(saleRows),
        lines: {
          create: linePayloads,
        },
      },
    });

    createdSales += 1;
    createdLines += linePayloads.length;
  }

  const saleCount = await prisma.sale.count();
  const saleLineCount = await prisma.saleLine.count();

  console.log(JSON.stringify({
    user,
    createdSales,
    createdLines,
    saleCount,
    saleLineCount,
    skipped,
  }, null, 2));
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
cat > /tmp/import-sales.payload.b64 <<'PAYLOAD_EOF'
$payloadBase64
PAYLOAD_EOF
cat > /tmp/import-sales.node.b64 <<'NODE_EOF'
$nodeScriptBase64
NODE_EOF
python3 - <<'PY'
import base64
from pathlib import Path
data = Path('/tmp/import-sales.node.b64').read_text(encoding='utf-8')
Path('/tmp/import-sales.node.js').write_text(base64.b64decode(data).decode('utf-8'), encoding='utf-8')
PY
docker compose exec -T app sh -lc 'cat > /app/import-sales.payload.b64' < /tmp/import-sales.payload.b64
docker compose exec -T app sh -lc 'cat > /app/import-sales.node.js' < /tmp/import-sales.node.js
docker compose exec -T app node /app/import-sales.node.js
rm -f /tmp/import-sales.payload.b64 /tmp/import-sales.node.b64 /tmp/import-sales.node.js
docker compose exec -T app sh -lc 'rm -f /app/import-sales.payload.b64 /app/import-sales.node.js'
"@

$remoteScript | & $sshPath $SshHost "bash -s"
