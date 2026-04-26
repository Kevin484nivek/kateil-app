import type { Prisma, PrismaClient } from "@prisma/client";

type SupplierCodeReader = PrismaClient | Prisma.TransactionClient;

function normalizeCodeSeed(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .trim()
    .toUpperCase();
}

function getInitials(name: string) {
  const normalized = normalizeCodeSeed(name);
  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "PR";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).padEnd(2, "X");
  }

  return words
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 4)
    .padEnd(2, "X");
}

function sanitizeSupplierCode(code: string) {
  return code
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6);
}

export async function ensureUniqueSupplierCode(
  db: SupplierCodeReader,
  input: {
    excludeSupplierId?: string;
    manualCode?: string | null;
    supplierName: string;
  },
) {
  const preferredBase = sanitizeSupplierCode(input.manualCode ?? "") || getInitials(input.supplierName);
  let candidate = preferredBase;
  let sequence = 2;

  while (true) {
    const existing = await db.supplier.findFirst({
      where: {
        supplierCode: candidate,
        ...(input.excludeSupplierId ? { id: { not: input.excludeSupplierId } } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${preferredBase.slice(0, 4)}${sequence}`;
    sequence += 1;
  }
}

export function buildProductCodeFromSupplierCode(input: {
  categoryName: string;
  stockIndex: number;
  supplierCode: string;
}) {
  const supplierPrefix = sanitizeSupplierCode(input.supplierCode).slice(0, 6).padEnd(2, "X");
  const categoryPrefix = input.categoryName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, "X");
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  const sequence = String(input.stockIndex).padStart(4, "0");

  return `${supplierPrefix}-${categoryPrefix}-${stamp}-${sequence}`;
}
