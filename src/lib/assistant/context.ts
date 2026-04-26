import { ExpenseEntryKind } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { formatMadridDateTime } from "@/lib/utils/datetime";
import { tokenizeSearchQuery } from "@/lib/utils/search";

import type { AssistantRolePolicy } from "./types";

type AssistantContextInput = {
  message: string;
  pathname?: string | null;
  rolePolicy: AssistantRolePolicy;
};

function toMoney(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function normalizeToken(token: string) {
  return token.replace(/[^a-zA-Z0-9\-]/g, "").trim();
}

export async function buildAssistantContext(input: AssistantContextInput) {
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const tokens = tokenizeSearchQuery(input.message)
    .map(normalizeToken)
    .filter((token) => token.length >= 3)
    .slice(0, 4);

  const queries: Promise<unknown>[] = [];

  queries.push(prisma.product.count({ where: { isActive: true } }));
  queries.push(prisma.product.count({ where: { isActive: true, stockCurrent: { lte: 2 } } }));
  queries.push(prisma.supplier.count({ where: { isActive: true } }));
  queries.push(prisma.customer.count({ where: { isActive: true } }));
  queries.push(
    prisma.sale.aggregate({
      where: { date: { gte: last30Days } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  );
  queries.push(
    prisma.inventoryEntry.count({
      where: { date: { gte: last30Days } },
    }),
  );
  queries.push(
    prisma.sale.findFirst({
      orderBy: { date: "desc" },
      select: { saleNumber: true, date: true, totalAmount: true },
    }),
  );
  queries.push(
    prisma.expense.aggregate({
      where: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        kind: ExpenseEntryKind.EXPENSE,
      },
      _sum: { amount: true },
    }),
  );
  queries.push(
    prisma.expense.aggregate({
      where: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        kind: ExpenseEntryKind.INCOME,
      },
      _sum: { amount: true },
    }),
  );

  if (input.rolePolicy.allowedDomains.includes("users")) {
    queries.push(
      prisma.user.count({
        where: { isActive: true },
      }),
    );
  } else {
    queries.push(Promise.resolve(null));
  }

  if (input.rolePolicy.allowedDomains.includes("storage")) {
    queries.push(
      prisma.storageIntegrationSetting.findFirst({
        select: {
          provider: true,
          status: true,
          connectedAccountEmail: true,
          lastValidatedAt: true,
        },
      }),
    );
  } else {
    queries.push(Promise.resolve(null));
  }

  if (tokens.length > 0 && input.rolePolicy.allowedDomains.includes("products")) {
    queries.push(
      prisma.product.findMany({
        where: {
          isActive: true,
          OR: tokens.flatMap((token) => [
            { code: { contains: token, mode: "insensitive" } },
            { name: { contains: token, mode: "insensitive" } },
          ]),
        },
        select: {
          code: true,
          name: true,
          stockCurrent: true,
          basePrice: true,
          supplier: { select: { name: true } },
        },
        orderBy: [{ stockCurrent: "asc" }, { name: "asc" }],
        take: 8,
      }),
    );
  } else {
    queries.push(Promise.resolve([]));
  }

  const [
    activeProducts,
    lowStockProducts,
    activeSuppliers,
    activeCustomers,
    salesLast30,
    entriesLast30,
    latestSale,
    expenseMonthOnly,
    incomeMonthOnly,
    activeUsers,
    storageStatus,
    productMatches,
  ] = await Promise.all(queries);

  const salesAggregate = salesLast30 as {
    _count: { _all: number };
    _sum: { totalAmount: { toString(): string } | null };
  };
  const latestSaleData = latestSale as
    | {
        saleNumber: string;
        date: Date;
        totalAmount: { toString(): string };
      }
    | null;
  const monthExpenses = Number((expenseMonthOnly as { _sum: { amount: { toString(): string } | null } })._sum.amount?.toString() ?? 0);
  const monthIncome = Number((incomeMonthOnly as { _sum: { amount: { toString(): string } | null } })._sum.amount?.toString() ?? 0);
  const monthNet = monthIncome - monthExpenses;

  const contextLines = [
    `Ruta actual en la app: ${input.pathname ?? "(sin ruta)"} `,
    `Rol del usuario: ${input.rolePolicy.role}`,
    `Dominios permitidos por rol: ${input.rolePolicy.allowedDomains.join(", ")}`,
    `Productos activos: ${activeProducts as number}`,
    `Productos con stock bajo (<=2): ${lowStockProducts as number}`,
    `Proveedores activos: ${activeSuppliers as number}`,
    `Clientes activos: ${activeCustomers as number}`,
    `Ventas últimos 30 días: ${salesAggregate._count._all}`,
    `Importe neto ventas 30 días: ${toMoney(Number(salesAggregate._sum.totalAmount?.toString() ?? 0))} EUR`,
    `Entradas de mercancía últimos 30 días: ${entriesLast30 as number}`,
    `Gasto mes actual: ${toMoney(monthExpenses)} EUR`,
    `Ingreso mes actual: ${toMoney(monthIncome)} EUR`,
    `Resultado neto mes actual: ${toMoney(monthNet)} EUR`,
    latestSaleData
      ? `Última venta: ${latestSaleData.saleNumber} (${formatMadridDateTime(latestSaleData.date)}), total ${latestSaleData.totalAmount.toString()} EUR`
      : "Última venta: no disponible",
  ];

  if (input.rolePolicy.allowedDomains.includes("users")) {
    contextLines.push(`Usuarios activos: ${(activeUsers as number) ?? 0}`);
  }

  if (input.rolePolicy.allowedDomains.includes("storage")) {
    const storage = storageStatus as
      | {
          provider: string;
          status: string;
          connectedAccountEmail: string | null;
          lastValidatedAt: Date | null;
        }
      | null;

    if (storage) {
      contextLines.push(
        `Storage: ${storage.provider} (${storage.status}) cuenta ${storage.connectedAccountEmail ?? "sin cuenta"}`,
      );
      contextLines.push(
        `Última validación storage: ${storage.lastValidatedAt ? formatMadridDateTime(storage.lastValidatedAt) : "sin validar"}`,
      );
    } else {
      contextLines.push("Storage: sin integración configurada");
    }
  }

  const matchedProducts = (productMatches as Array<{
    code: string;
    name: string;
    stockCurrent: number;
    basePrice: { toString(): string };
    supplier: { name: string };
  }>).map((product) => ({
    code: product.code,
    name: product.name,
    stockCurrent: product.stockCurrent,
    basePrice: product.basePrice.toString(),
    supplierName: product.supplier.name,
  }));

  if (matchedProducts.length > 0) {
    contextLines.push("Coincidencias de productos detectadas en la pregunta:");

    for (const product of matchedProducts) {
      contextLines.push(
        `- ${product.code} | ${product.name} | stock ${product.stockCurrent} | PVP ${product.basePrice} | proveedor ${product.supplierName}`,
      );
    }
  }

  return {
    contextText: contextLines.join("\n"),
    matchedProducts,
  };
}
