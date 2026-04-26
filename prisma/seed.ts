import { OrganizationModuleKey, OrganizationMembershipRole, PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const defaultCategories = [
  "Ropa",
  "Calzado",
  "Accesorios",
  "Joyería",
  "Bolsos",
  "Hogar",
];

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me";
  const adminName = process.env.ADMIN_NAME ?? "Administrador Kateil";

  await Promise.all(
    defaultCategories.map((name) =>
      prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash: hashPassword(adminPassword),
      role: "SUPERADMIN",
      isActive: true,
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      role: "SUPERADMIN",
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "kateil-base" },
    update: { isActive: true },
    create: {
      slug: "kateil-base",
      name: "Kateil Base",
      isActive: true,
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: admin.id,
      },
    },
    update: {
      isActive: true,
      role: OrganizationMembershipRole.OWNER,
    },
    create: {
      organizationId: organization.id,
      userId: admin.id,
      role: OrganizationMembershipRole.OWNER,
      isActive: true,
    },
  });

  const defaultModules: OrganizationModuleKey[] = [
    "CATALOG_CORE",
    "STOCK_CORE",
    "SALES_CORE",
    "MERCHANDISE_CORE",
    "SEARCH_CORE",
    "CUSTOMERS_PLUS",
    "SUPPLIERS_PLUS",
    "INVENTORY_PLUS",
    "EXPENSES_PLUS",
    "ANALYTICS_PLUS",
  ];

  await Promise.all(
    defaultModules.map((moduleKey) =>
      prisma.organizationModule.upsert({
        where: {
          organizationId_moduleKey: {
            organizationId: organization.id,
            moduleKey,
          },
        },
        update: { isEnabled: true },
        create: {
          organizationId: organization.id,
          moduleKey,
          isEnabled: true,
        },
      }),
    ),
  );

  console.log(`Seed complete. Admin user ready: ${adminEmail}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
