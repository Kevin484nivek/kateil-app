"use server";

import { ProductType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireUserSession } from "@/lib/auth/session";
import { buildProductCodeFromSupplierCode } from "@/lib/catalogs/supplier-code";
import { resolveProductSubtypeId, resolveSeasonId } from "@/lib/catalogs/product-taxonomy";
import { prisma } from "@/lib/db/prisma";
import { assertModuleAccess } from "@/lib/platform/modules";
import {
  getOptionalDecimal,
  getOptionalString,
  getRequiredDecimal,
  getRequiredInt,
  getRequiredString,
} from "@/lib/utils/form";

export type ProductFormState = {
  message: string;
  status: "error" | "idle" | "success";
};

const idleProductFormState: ProductFormState = {
  message: "",
  status: "idle",
};

export async function createProductAction(formData: FormData) {
  const session = await requireUserSession();
  await assertModuleAccess(session, "CATALOG_CORE");

  const name = getRequiredString(formData, "name");
  const description = getRequiredString(formData, "description");
  const categoryId = getRequiredString(formData, "categoryId");
  const supplierId = getRequiredString(formData, "supplierId");
  const basePrice = getRequiredDecimal(formData, "basePrice");
  const cost = getRequiredDecimal(formData, "cost");
  const stockInitial = getRequiredInt(formData, "stockInitial");
  const productTypeValue = getRequiredString(formData, "productType");

  if (!name || !description || !categoryId || !supplierId) {
    throw new Error("Missing required product fields");
  }

  const productType =
    productTypeValue === ProductType.CONSIGNMENT ? ProductType.CONSIGNMENT : ProductType.OWNED;
  const storeCommissionPct =
    productType === ProductType.OWNED ? "100.00" : getOptionalDecimal(formData, "storeCommissionPct");

  const [supplier, category, productCount] = await Promise.all([
    prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } }),
    prisma.category.findUniqueOrThrow({ where: { id: categoryId } }),
    prisma.product.count(),
  ]);

  const code = buildProductCodeFromSupplierCode({
    supplierCode: supplier.supplierCode ?? supplier.name,
    categoryName: category.name,
    stockIndex: productCount + 1,
  });

  await prisma.$transaction(async (tx) => {
    const productSubtypeId = await resolveProductSubtypeId(tx, {
      categoryId,
      name: getOptionalString(formData, "productSubtypeName"),
    });
    const seasonId = await resolveSeasonId(tx, {
      categoryId,
      name: getOptionalString(formData, "seasonName"),
    });

    const product = await tx.product.create({
      data: {
        code,
        name,
        description,
        categoryId,
        productSubtypeId,
        seasonId,
        size: getOptionalString(formData, "size"),
        color: getOptionalString(formData, "color"),
        basePrice,
        cost,
        stockCurrent: stockInitial,
        productType,
        supplierId,
        storeCommissionPct,
        notes: getOptionalString(formData, "notes"),
      },
    });

    await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: "INITIAL",
        referenceType: "PRODUCT",
        referenceId: product.id,
        quantityDelta: stockInitial,
        reason: "Initial stock on product creation",
        userId: session.userId,
      },
    });
  });

  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function toggleProductAction(formData: FormData) {
  const session = await requireUserSession();
  await assertModuleAccess(session, "CATALOG_CORE");

  const productId = getRequiredString(formData, "productId");
  const nextState = String(formData.get("nextState")) === "true";

  await prisma.product.update({
    where: { id: productId },
    data: { isActive: nextState },
  });

  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function updateProductAction(
  _previousState: ProductFormState = idleProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    const session = await requireUserSession();
    await assertModuleAccess(session, "CATALOG_CORE");
    const productId = getRequiredString(formData, "productId");
    const name = getRequiredString(formData, "name");
    const description = getRequiredString(formData, "description");
    const categoryId = getRequiredString(formData, "categoryId");
    const supplierId = getRequiredString(formData, "supplierId");
    const basePrice = getRequiredDecimal(formData, "basePrice");
    const cost = getRequiredDecimal(formData, "cost");
    const stockCurrentValue = formData.get("stockCurrent");
    const productTypeValue = getRequiredString(formData, "productType");
    const nextStockCurrent =
      stockCurrentValue == null || String(stockCurrentValue).trim() === ""
        ? null
        : Number.parseInt(String(stockCurrentValue).trim(), 10);

    if (nextStockCurrent != null && (!Number.isInteger(nextStockCurrent) || nextStockCurrent < 0)) {
      throw new Error("El stock actual debe ser un número entero mayor o igual que cero.");
    }

    const productType =
      productTypeValue === ProductType.CONSIGNMENT ? ProductType.CONSIGNMENT : ProductType.OWNED;
    const storeCommissionPct =
      productType === ProductType.OWNED
        ? "100.00"
        : getOptionalDecimal(formData, "storeCommissionPct");

    await prisma.$transaction(async (tx) => {
      const existingProduct = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: { stockCurrent: true },
      });
      const productSubtypeId = await resolveProductSubtypeId(tx, {
        categoryId,
        name: getOptionalString(formData, "productSubtypeName"),
      });
      const seasonId = await resolveSeasonId(tx, {
        categoryId,
        name: getOptionalString(formData, "seasonName"),
      });

      await tx.product.update({
        where: { id: productId },
        data: {
          name,
          description,
          categoryId,
          productSubtypeId,
          seasonId,
          size: getOptionalString(formData, "size"),
          color: getOptionalString(formData, "color"),
          basePrice,
          cost,
          productType,
          supplierId,
          storeCommissionPct,
          notes: getOptionalString(formData, "notes"),
          ...(nextStockCurrent != null ? { stockCurrent: nextStockCurrent } : {}),
        },
      });

      if (nextStockCurrent != null && nextStockCurrent !== existingProduct.stockCurrent) {
        await tx.stockMovement.create({
          data: {
            productId,
            type: "ADJUSTMENT",
            referenceType: "MANUAL",
            quantityDelta: nextStockCurrent - existingProduct.stockCurrent,
            reason: "Ajuste manual desde producto",
            userId: session.userId,
          },
        });
      }
    });

    revalidatePath("/products");
    revalidatePath("/inventory-entries");
    revalidatePath("/sales/new");
    revalidatePath("/dashboard");

    return {
      message: "Producto guardado correctamente.",
      status: "success",
    };
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "No se pudo guardar el producto. Inténtalo de nuevo.",
      status: "error",
    };
  }
}
