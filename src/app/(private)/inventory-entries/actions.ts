"use server";

import path from "node:path";

import {
  ExpenseCategory,
  ExpenseEntryKind,
  ExpenseSourceType,
  Prisma,
  ProductType,
  StorageFolderType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserSession } from "@/lib/auth/session";
import { buildProductCodeFromSupplierCode } from "@/lib/catalogs/supplier-code";
import { resolveProductSubtypeId, resolveSeasonId } from "@/lib/catalogs/product-taxonomy";
import { prisma } from "@/lib/db/prisma";
import { getEffectiveUnitCost } from "@/lib/finance/costs";
import { uploadFileToGoogleDriveFolderType } from "@/lib/storage/google-drive-files";
import {
  getOptionalString,
  getRequiredString,
} from "@/lib/utils/form";

function redirectInventoryError(message: string): never {
  redirect(`/inventory-entries?error=${encodeURIComponent(message)}`);
}

async function storeInventoryAttachments(files: File[]) {
  const uploadedFiles = files.filter((file) => file && file.size > 0);

  if (uploadedFiles.length === 0) {
    return [];
  }

  const storedUrls: string[] = [];

  for (const file of uploadedFiles) {
    const extension = path.extname(file.name || "").toLowerCase();
    const isPdf = extension === ".pdf" || file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");

    if (!isPdf && !isImage) {
      throw new Error("Inventory attachments must be PDF or image files");
    }

    const safeBaseName = path
      .basename(file.name, extension)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);
    const normalizedExtension = extension || (isPdf ? ".pdf" : ".bin");
    const fileName = `${safeBaseName || "inventory-document"}-${Date.now()}-${storedUrls.length + 1}${normalizedExtension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploadedUrl = await uploadFileToGoogleDriveFolderType({
      folderType: StorageFolderType.INVENTORY_ATTACHMENTS,
      fileName,
      fileBytes: bytes,
      contentType: file.type || (isPdf ? "application/pdf" : "application/octet-stream"),
    });

    if (!uploadedUrl) {
      throw new Error("No se pudo obtener URL del adjunto en Google Drive");
    }

    storedUrls.push(uploadedUrl);
  }

  return storedUrls;
}

function buildEntryNumber(sequence: number) {
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;

  return `E-${yearMonth}-${String(sequence).padStart(4, "0")}`;
}

function buildOrderNumber(sequence: number) {
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;

  return `P-${yearMonth}-${String(sequence).padStart(4, "0")}`;
}

type InventoryLineInput = {
  existingProductId: string | null;
  quantity: number;
  unitCost: string;
  newProductName: string | null;
  newProductDescription: string | null;
  newProductCategoryId: string | null;
  newProductSubtypeName: string | null;
  seasonName: string | null;
  newProductBasePrice: string | null;
  newProductType: ProductType;
  newProductSize: string | null;
  newProductColor: string | null;
};

function getTrimmedValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  return text.length > 0 ? text : null;
}

function getDecimalValue(value: FormDataEntryValue | null, key: string) {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");
  const parsed = Number(normalized);

  if (!normalized || Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid decimal value for ${key}`);
  }

  return parsed.toFixed(2);
}

function getIntValue(value: FormDataEntryValue | null, key: string) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid integer value for ${key}`);
  }

  return parsed;
}

function getInventoryLines(formData: FormData) {
  const existingProductIds = formData.getAll("lineExistingProductId");
  const quantities = formData.getAll("lineQuantity");
  const unitCosts = formData.getAll("lineUnitCost");
  const newProductNames = formData.getAll("lineNewProductName");
  const newProductDescriptions = formData.getAll("lineNewProductDescription");
  const newProductCategoryIds = formData.getAll("lineNewProductCategoryId");
  const newProductSubtypeNames = formData.getAll("lineNewProductSubtypeName");
  const seasonNames = formData.getAll("lineSeasonName");
  const newProductBasePrices = formData.getAll("lineNewProductBasePrice");
  const newProductTypes = formData.getAll("lineNewProductType");
  const newProductSizes = formData.getAll("lineNewProductSize");
  const newProductColors = formData.getAll("lineNewProductColor");

  const totalRows = Math.max(
    quantities.length,
    unitCosts.length,
    existingProductIds.length,
    newProductNames.length,
    newProductDescriptions.length,
    newProductCategoryIds.length,
    newProductSubtypeNames.length,
    seasonNames.length,
    newProductBasePrices.length,
    newProductTypes.length,
    newProductSizes.length,
    newProductColors.length,
  );

  return Array.from({ length: totalRows }, (_, index) => index)
    .map((index) => {
      const existingProductId = getTrimmedValue(existingProductIds[index] ?? null);
      const newProductName = getTrimmedValue(newProductNames[index] ?? null);
      const newProductDescription = getTrimmedValue(newProductDescriptions[index] ?? null);
      const newProductCategoryId = getTrimmedValue(newProductCategoryIds[index] ?? null);
      const newProductSubtypeName = getTrimmedValue(newProductSubtypeNames[index] ?? null);
      const seasonName = getTrimmedValue(seasonNames[index] ?? null);
      const newProductBasePrice = getTrimmedValue(newProductBasePrices[index] ?? null);
      const newProductSize = getTrimmedValue(newProductSizes[index] ?? null);
      const newProductColor = getTrimmedValue(newProductColors[index] ?? null);

      const hasAnyLineValue =
        Boolean(existingProductId) ||
        Boolean(newProductName) ||
        Boolean(newProductDescription) ||
        Boolean(newProductCategoryId) ||
        Boolean(getTrimmedValue(quantities[index] ?? null)) ||
        Boolean(getTrimmedValue(unitCosts[index] ?? null));

      if (!hasAnyLineValue) {
        return null;
      }

      if (!existingProductId && (!newProductDescription || !newProductCategoryId)) {
        return null;
      }

      return {
        existingProductId,
        quantity: getIntValue(quantities[index] ?? null, "lineQuantity"),
        unitCost: getDecimalValue(unitCosts[index] ?? null, "lineUnitCost"),
        newProductName,
        newProductDescription,
        newProductCategoryId,
        newProductSubtypeName,
        seasonName,
        newProductBasePrice,
        newProductType:
          String(newProductTypes[index] ?? "") === ProductType.CONSIGNMENT
            ? ProductType.CONSIGNMENT
            : ProductType.OWNED,
        newProductSize,
        newProductColor,
      } satisfies InventoryLineInput;
    })
    .filter((line): line is InventoryLineInput => line !== null);
}

async function resolveLineProducts(
  tx: Prisma.TransactionClient,
  supplierId: string,
  lines: InventoryLineInput[],
) {
  const supplier = await tx.supplier.findUniqueOrThrow({
    where: { id: supplierId },
  });

  const existingProducts = await tx.product.findMany({
    where: {
      id: { in: lines.map((line) => line.existingProductId).filter(Boolean) as string[] },
    },
  });

  const existingProductMap = new Map(existingProducts.map((product) => [product.id, product]));
  const categories = await tx.category.findMany();
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  let productCount = await tx.product.count();

  const resolvedLines: Array<{
    effectiveUnitCost: number;
    productId: string;
    productType: ProductType;
    quantity: number;
    unitCost: string;
  }> = [];

  for (const line of lines) {
    if (line.existingProductId) {
      const product = existingProductMap.get(line.existingProductId);

      if (!product) {
        throw new Error("Product not found for inventory operation");
      }

      if (product.supplierId !== supplier.id) {
        throw new Error("All lines must belong to the selected supplier");
      }

      resolvedLines.push({
        effectiveUnitCost: getEffectiveUnitCost({
          applyVatToCost: supplier.applyVatToCost,
          baseCost: line.unitCost,
          productType: product.productType,
        }),
        productId: product.id,
        productType: product.productType,
        quantity: line.quantity,
        unitCost: line.unitCost,
      });
      continue;
    }

    if (!line.newProductName || !line.newProductDescription || !line.newProductCategoryId) {
      throw new Error("New product lines require name, description and category");
    }

    const category = categoryMap.get(line.newProductCategoryId);

    if (!category) {
      throw new Error("Category not found for new product");
    }

    productCount += 1;
    const code = buildProductCodeFromSupplierCode({
      supplierCode: supplier.supplierCode ?? supplier.name,
      categoryName: category.name,
      stockIndex: productCount,
    });
    const productSubtypeId = await resolveProductSubtypeId(tx, {
      categoryId: category.id,
      name: line.newProductSubtypeName,
    });
    const seasonId = await resolveSeasonId(tx, {
      categoryId: category.id,
      name: line.seasonName,
    });

    const product = await tx.product.create({
      data: {
        code,
        name: line.newProductName,
        description: line.newProductDescription,
        categoryId: category.id,
        productSubtypeId,
        seasonId,
        size: line.newProductSize,
        color: line.newProductColor,
        basePrice: line.newProductBasePrice ?? line.unitCost,
        cost: line.unitCost,
        stockCurrent: 0,
        productType: line.newProductType,
        supplierId: supplier.id,
        storeCommissionPct: line.newProductType === ProductType.OWNED ? "100.00" : "0.00",
      },
    });

    resolvedLines.push({
      effectiveUnitCost: getEffectiveUnitCost({
        applyVatToCost: supplier.applyVatToCost,
        baseCost: line.unitCost,
        productType: line.newProductType,
      }),
      productId: product.id,
      productType: line.newProductType,
      quantity: line.quantity,
      unitCost: line.unitCost,
    });
  }

  return resolvedLines;
}

export async function createInventoryEntryAction(formData: FormData) {
  const session = await requireUserSession();
  const supplierId = getRequiredString(formData, "supplierId");
  const notes = getOptionalString(formData, "notes");
  const dateValue = getRequiredString(formData, "date");
  const lines = getInventoryLines(formData);

  if (lines.length === 0) {
    redirectInventoryError("Debes añadir al menos una línea de mercancía.");
  }

  let attachmentUrls: string[] = [];
  try {
    attachmentUrls = await storeInventoryAttachments(
      formData.getAll("attachments").filter((entry): entry is File => entry instanceof File),
    );
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "No se pudo subir adjuntos a Google Drive";
    redirectInventoryError(message);
  }

  const entryCount = await prisma.inventoryEntry.count();
  const entryNumber = buildEntryNumber(entryCount + 1);

  let createdEntry: { id: string; entryNumber: string } | null = null;
  try {
    createdEntry = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUniqueOrThrow({
        where: { id: supplierId },
      });
      const resolvedLines = await resolveLineProducts(tx, supplierId, lines);
      const totalCost = resolvedLines.reduce(
        (sum, line) => sum + line.quantity * line.effectiveUnitCost,
        0,
      );

      const entry = await tx.inventoryEntry.create({
        data: {
          entryNumber,
          supplierId,
          date: new Date(dateValue),
          notes,
          attachmentUrls,
          userId: session.userId,
        },
      });

      for (const line of resolvedLines) {
        await tx.inventoryEntryLine.create({
          data: {
            inventoryEntryId: entry.id,
            productId: line.productId,
            quantity: line.quantity,
            unitCost: line.unitCost,
          },
        });

        await tx.product.update({
          where: { id: line.productId },
          data: {
            stockCurrent: {
              increment: line.quantity,
            },
            cost: line.unitCost,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            type: "ENTRY",
            referenceType: "INVENTORY_ENTRY",
            referenceId: entry.id,
            quantityDelta: line.quantity,
            reason: "Inventory entry",
            notes,
            userId: session.userId,
          },
        });
      }

      await tx.expense.create({
        data: {
          year: entry.date.getFullYear(),
          month: entry.date.getMonth() + 1,
          kind: ExpenseEntryKind.EXPENSE,
          category: ExpenseCategory.MERCHANDISE,
          concept: `Entrada ${entry.entryNumber} · ${supplier.name}`,
          amount: totalCost.toFixed(2),
          notes: notes ?? "Generado automáticamente desde mercancía",
          sourceType: ExpenseSourceType.INVENTORY_ENTRY,
          sourceReferenceId: entry.id,
          userId: session.userId,
        },
      });

      return {
        id: entry.id,
        entryNumber: entry.entryNumber,
      };
    });
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "No se pudo guardar la entrada de mercancía";
    redirectInventoryError(message);
  }

  if (!createdEntry) {
    redirectInventoryError("No se pudo guardar la entrada de mercancía");
  }
  const ensuredEntry = createdEntry!;

  revalidatePath("/inventory-entries");
  revalidatePath("/inventory-entries/history");
  revalidatePath("/stock-movements");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  redirect(
    `/inventory-entries?created=entry&id=${ensuredEntry.id}&number=${encodeURIComponent(ensuredEntry.entryNumber)}`,
  );
}

export async function createPurchaseOrderAction(formData: FormData) {
  const session = await requireUserSession();
  const supplierId = getRequiredString(formData, "supplierId");
  const notes = getOptionalString(formData, "notes");
  const dateValue = getRequiredString(formData, "date");
  const expectedDateValue = getOptionalString(formData, "expectedDate");
  const lines = getInventoryLines(formData);

  if (lines.length === 0) {
    redirectInventoryError("Debes añadir al menos una línea en el pedido.");
  }

  let attachmentUrls: string[] = [];
  try {
    attachmentUrls = await storeInventoryAttachments(
      formData.getAll("attachments").filter((entry): entry is File => entry instanceof File),
    );
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "No se pudo subir adjuntos a Google Drive";
    redirectInventoryError(message);
  }

  const orderCount = await prisma.purchaseOrder.count();
  const orderNumber = buildOrderNumber(orderCount + 1);

  let createdOrder: { id: string; orderNumber: string } | null = null;
  try {
    createdOrder = await prisma.$transaction(async (tx) => {
      const resolvedLines = await resolveLineProducts(tx, supplierId, lines);

      const order = await tx.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId,
          date: new Date(dateValue),
          expectedDate: expectedDateValue ? new Date(expectedDateValue) : null,
          notes,
          attachmentUrls,
          userId: session.userId,
        },
      });

      for (const line of resolvedLines) {
        await tx.purchaseOrderLine.create({
          data: {
            purchaseOrderId: order.id,
            productId: line.productId,
            quantity: line.quantity,
            unitCost: line.unitCost,
          },
        });
      }

      return {
        id: order.id,
        orderNumber: order.orderNumber,
      };
    });
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "No se pudo guardar el pedido";
    redirectInventoryError(message);
  }

  if (!createdOrder) {
    redirectInventoryError("No se pudo guardar el pedido");
  }
  const ensuredOrder = createdOrder!;

  revalidatePath("/inventory-entries");
  revalidatePath("/inventory-entries/history");
  revalidatePath("/dashboard");
  redirect(
    `/inventory-entries?created=order&id=${ensuredOrder.id}&number=${encodeURIComponent(ensuredOrder.orderNumber)}`,
  );
}

export async function receivePurchaseOrderAction(formData: FormData) {
  const session = await requireUserSession();
  const purchaseOrderId = getRequiredString(formData, "purchaseOrderId");
  const notes = getOptionalString(formData, "notes");
  const today = new Date();
  const entryCount = await prisma.inventoryEntry.count();
  const entryNumber = buildEntryNumber(entryCount + 1);

  await prisma.$transaction(async (tx) => {
    const purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        supplier: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      throw new Error("Purchase order not found");
    }

    if (purchaseOrder.status !== "OPEN") {
      throw new Error("Only open purchase orders can be received");
    }

    const entry = await tx.inventoryEntry.create({
      data: {
        entryNumber,
        supplierId: purchaseOrder.supplierId,
        date: today,
        notes: notes ?? purchaseOrder.notes,
        attachmentUrls: purchaseOrder.attachmentUrls,
        userId: session.userId,
      },
    });

    const totalCost = purchaseOrder.lines.reduce(
      (sum, line) =>
        sum +
        line.quantity *
          getEffectiveUnitCost({
            applyVatToCost: purchaseOrder.supplier.applyVatToCost,
            baseCost: line.unitCost,
            productType: line.product.productType,
          }),
      0,
    );

    for (const line of purchaseOrder.lines) {
      await tx.inventoryEntryLine.create({
        data: {
          inventoryEntryId: entry.id,
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost,
        },
      });

      await tx.product.update({
        where: { id: line.productId },
        data: {
          stockCurrent: {
            increment: line.quantity,
          },
          cost: line.unitCost,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          type: "ENTRY",
          referenceType: "INVENTORY_ENTRY",
          referenceId: entry.id,
          quantityDelta: line.quantity,
          reason: `Received purchase order ${purchaseOrder.orderNumber}`,
          notes: notes ?? purchaseOrder.notes,
          userId: session.userId,
        },
      });
    }

    await tx.expense.create({
      data: {
        year: entry.date.getFullYear(),
        month: entry.date.getMonth() + 1,
        kind: ExpenseEntryKind.EXPENSE,
        category: ExpenseCategory.MERCHANDISE,
        concept: `Entrada ${entry.entryNumber} · ${purchaseOrder.supplier.name}`,
        amount: totalCost.toFixed(2),
        notes: notes ?? purchaseOrder.notes ?? "Generado automáticamente desde pedido recibido",
        sourceType: ExpenseSourceType.INVENTORY_ENTRY,
        sourceReferenceId: entry.id,
        userId: session.userId,
      },
    });

    await tx.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: {
        status: "RECEIVED",
        notes: notes ?? purchaseOrder.notes,
      },
    });
  });

  revalidatePath("/inventory-entries");
  revalidatePath("/inventory-entries/history");
  revalidatePath("/stock-movements");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/expenses");
}
