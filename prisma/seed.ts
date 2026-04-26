import { PrismaClient } from "@prisma/client";

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

  await prisma.user.upsert({
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

  console.log(`Seed complete. Admin user ready: ${adminEmail}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
