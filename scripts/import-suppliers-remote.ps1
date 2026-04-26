param(
  [string]$InputCsv = "C:\Users\kevin\Documents\Playground\data\import-review\latest\01_suppliers_master.csv",
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
  throw "No se encuentra el CSV de proveedores: $InputCsv"
}

$rows = Import-Csv -Path $InputCsv
$jsonPayload = $rows | ConvertTo-Json -Depth 6 -Compress
$payloadBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($jsonPayload))

$nodeScript = @'
const { PrismaClient } = require('@prisma/client');
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

function toNullableDecimal(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBool(value) {
  return ['true', 'True', '1', 1, true].includes(value);
}

async function main() {
  const rows = JSON.parse(Buffer.from(process.env.PAYLOAD_BASE64, 'base64').toString('utf8'));

  await prisma.supplier.deleteMany({});

  for (const row of rows) {
    const supplierType = row.supplier_type || '';
    const noteParts = [];
    if (row.supplier_code) noteParts.push(`Codigo: ${row.supplier_code}`);
    if (supplierType) noteParts.push(`Tipo: ${supplierType}`);
    if (row.notes) noteParts.push(repairText(row.notes));

    await prisma.supplier.create({
      data: {
        name: repairText(row.supplier_name),
        supportsDirectPurchase: supplierType === 'direct',
        supportsSeasonalOrder: false,
        supportsConsignment: ['deposit', 'special'].includes(supplierType),
        defaultStoreCommissionPct: toNullableDecimal(row.commission_pct),
        notes: noteParts.length ? noteParts.join(' | ') : null,
        isActive: toBool(row.is_active),
      },
    });
  }

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
    select: {
      name: true,
      defaultStoreCommissionPct: true,
      isActive: true,
    },
  });

  console.log(JSON.stringify(suppliers, null, 2));
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
export PAYLOAD_BASE64='$payloadBase64'
export NODE_SCRIPT_BASE64='$nodeScriptBase64'
docker compose exec -T -e PAYLOAD_BASE64 -e NODE_SCRIPT_BASE64 app node -e "eval(Buffer.from(process.env.NODE_SCRIPT_BASE64, 'base64').toString('utf8'))"
"@

$remoteScript | & $sshPath $SshHost "bash -s"
