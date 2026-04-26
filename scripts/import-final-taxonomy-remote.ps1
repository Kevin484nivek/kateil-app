param(
  [string]$SshHost = "docker-server-remote",
  [string]$RemoteAppDir = "/home/kevin/docker-services/mimarca-backoffice"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$categoriesPath = "C:\Users\kevin\Documents\Playground\data\import-review\final-taxonomy\categories_final.csv"
$subtypesPath = "C:\Users\kevin\Documents\Playground\data\import-review\final-taxonomy\category_subtypes_final.csv"
$seasonsPath = "C:\Users\kevin\Documents\Playground\data\import-review\final-taxonomy\category_seasons_final.csv"

$categories = Import-Csv -Path $categoriesPath
$subtypes = Import-Csv -Path $subtypesPath
$seasons = Import-Csv -Path $seasonsPath

$jsonPayload = @{
  categories = $categories
  subtypes = $subtypes
  seasons = $seasons
} | ConvertTo-Json -Depth 6 -Compress

$payloadBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($jsonPayload))

$remoteScript = @"
cd $RemoteAppDir
PAYLOAD_BASE64='$payloadBase64' docker compose exec -T app node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const payload = JSON.parse(Buffer.from(process.env.PAYLOAD_BASE64, 'base64').toString('utf8'));

  for (const category of payload.categories) {
    await prisma.category.upsert({
      where: { name: category.category },
      update: { isActive: true },
      create: { name: category.category, isActive: true },
    });
  }

  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((category) => [category.name, category.id]));

  for (const subtype of payload.subtypes) {
    const categoryId = categoryMap.get(subtype.category);
    if (!categoryId) continue;

    await prisma.productSubtype.upsert({
      where: { categoryId_name: { categoryId, name: subtype.subtype } },
      update: { isActive: true },
      create: { categoryId, name: subtype.subtype, isActive: true },
    });
  }

  for (const season of payload.seasons) {
    const categoryId = categoryMap.get(season.category);
    if (!categoryId) continue;

    await prisma.season.upsert({
      where: { categoryId_name: { categoryId, name: season.season } },
      update: { isActive: true },
      create: { categoryId, name: season.season, isActive: true },
    });
  }

  const counts = {
    categories: await prisma.category.count(),
    subtypes: await prisma.productSubtype.count(),
    seasons: await prisma.season.count(),
  };

  console.log(JSON.stringify(counts));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.`$disconnect();
  });
"
"@

$sshCandidates = @(
  "C:\Windows\System32\OpenSSH\ssh.exe",
  "C:\Windows\Sysnative\OpenSSH\ssh.exe",
  "C:\Program Files\Git\usr\bin\ssh.exe"
)

$sshExe = $sshCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $sshExe) {
  throw "No se encontró ssh.exe en las rutas esperadas."
}

& $sshExe $SshHost $remoteScript
