"use server";

import { ConsignmentSettlementMode, PaymentMethod, ProductType, SaleKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getEffectiveUnitCost } from "@/lib/finance/costs";
import { getOptionalString, getRequiredString } from "@/lib/utils/form";

function buildSaleNumber(sequence: number) {
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;

  return `V-${yearMonth}-${String(sequence).padStart(4, "0")}`;
}

function computeSaleAmounts(input: {
  consignmentSettlementMode: ConsignmentSettlementMode;
  productType: ProductType;
  subtotal: number;
  storeCommissionPct: number | null;
  unitCost: number;
  quantity: number;
}) {
  if (input.productType === ProductType.CONSIGNMENT) {
    if (input.consignmentSettlementMode === ConsignmentSettlementMode.FIXED_COST) {
      const supplierAmount = Number((input.unitCost * input.quantity).toFixed(2));
      const storeAmount = Number((input.subtotal - supplierAmount).toFixed(2));

      return {
        storeAmount: storeAmount.toFixed(2),
        supplierAmount: supplierAmount.toFixed(2),
      };
    }

    const pct = input.storeCommissionPct ?? 0;
    const storeAmount = Number(((input.subtotal * pct) / 100).toFixed(2));
    const supplierAmount = Number((input.subtotal - storeAmount).toFixed(2));

    return {
      storeAmount: storeAmount.toFixed(2),
      supplierAmount: supplierAmount.toFixed(2),
    };
  }

  const storeAmount = input.subtotal;
  const supplierAmount = 0;

  return {
    storeAmount: storeAmount.toFixed(2),
    supplierAmount: supplierAmount.toFixed(2),
  };
}

class SaleStockError extends Error {
  constructor(productName: string) {
    super(productName);
    this.name = "SaleStockError";
  }
}

class SaleReturnValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleReturnValidationError";
  }
}

function parseRequiredPositiveInt(value: FormDataEntryValue | null, key: string) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid integer for ${key}`);
  }

  return parsed;
}

function parseRequiredNonNegativeDecimal(value: FormDataEntryValue | null, key: string) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(normalized);

  if (normalized.length === 0 || Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid decimal for ${key}`);
  }

  return parsed;
}

function parseOptionalPct(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().replace(",", ".");

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);

  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("Invalid discount percentage");
  }

  return parsed;
}

function getUnitCostSnapshot(input: {
  applyVatToCost: boolean;
  consignmentSettlementMode: ConsignmentSettlementMode;
  cost: { toString(): string } | number;
  productType: ProductType;
}) {
  if (
    input.productType === ProductType.CONSIGNMENT &&
    input.consignmentSettlementMode !== ConsignmentSettlementMode.FIXED_COST
  ) {
    return null;
  }

  return getEffectiveUnitCost({
    applyVatToCost: input.applyVatToCost,
    baseCost: input.cost,
    productType: input.productType,
  }).toFixed(2);
}

export async function createSaleAction(formData: FormData) {
  const session = await requireUserSession();
  const saleModeValue = String(formData.get("saleMode") ?? "").trim();
  const saleKind = saleModeValue === SaleKind.RETURN_EXCHANGE ? SaleKind.RETURN_EXCHANGE : SaleKind.NORMAL;
  const originalSaleId = getOptionalString(formData, "originalSaleId");

  const customerId = getOptionalString(formData, "customerId");
  const newCustomerName = getOptionalString(formData, "newCustomerName");
  const newCustomerPhone = getOptionalString(formData, "newCustomerPhone");
  const newCustomerEmail = getOptionalString(formData, "newCustomerEmail");
  const newCustomerNotes = getOptionalString(formData, "newCustomerNotes");
  const notes = getOptionalString(formData, "notes");
  const saleDiscountPct = parseOptionalPct(formData.get("saleDiscountPct"));
  const paymentMethodValue = getRequiredString(formData, "paymentMethod");

  const paymentMethod =
    paymentMethodValue === PaymentMethod.CARD
      ? PaymentMethod.CARD
      : paymentMethodValue === PaymentMethod.BIZUM
        ? PaymentMethod.BIZUM
        : PaymentMethod.CASH;

  const productIds = formData.getAll("lineProductId");
  const quantities = formData.getAll("lineQuantity");
  const soldUnitPrices = formData.getAll("lineSoldUnitPrice");
  const lineDiscountPcts = formData.getAll("lineDiscountPct");

  const saleLines = productIds
    .map((entry, index) => {
      const productId = String(entry).trim();

      if (!productId) {
        return null;
      }

      return {
        productId,
        quantity: parseRequiredPositiveInt(quantities[index] ?? null, `lineQuantity[${index}]`),
        soldUnitPrice: parseRequiredNonNegativeDecimal(
          soldUnitPrices[index] ?? null,
          `lineSoldUnitPrice[${index}]`,
        ),
        lineDiscountPct: parseOptionalPct(lineDiscountPcts[index] ?? null),
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  const returnSaleLineIds = formData.getAll("returnLineSaleLineId");
  const returnProductIds = formData.getAll("returnLineProductId");
  const returnQuantities = formData.getAll("returnLineQuantity");
  const returnUnitPrices = formData.getAll("returnLineUnitPrice");

  const returnLines = returnSaleLineIds
    .map((entry, index) => {
      const originalSaleLineId = String(entry).trim();

      if (!originalSaleLineId) {
        return null;
      }

      return {
        originalSaleLineId,
        productId: String(returnProductIds[index] ?? "").trim(),
        quantity: parseRequiredPositiveInt(
          returnQuantities[index] ?? null,
          `returnLineQuantity[${index}]`,
        ),
        refundedUnitPrice: parseRequiredNonNegativeDecimal(
          returnUnitPrices[index] ?? null,
          `returnLineUnitPrice[${index}]`,
        ),
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  if (saleLines.length === 0 && returnLines.length === 0) {
    redirect("/sales/new?error=missing_lines");
  }

  if (saleKind === SaleKind.NORMAL && returnLines.length > 0) {
    redirect("/sales/new?error=return&detail=Activa modo devolución para procesar productos devueltos.");
  }

  const saleCount = await prisma.sale.count();
  const saleNumber = buildSaleNumber(saleCount + 1);

  try {
    const saleId = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          id: { in: saleLines.map((line) => line.productId) },
          isActive: true,
        },
        include: {
          supplier: true,
        },
      });

      const productMap = new Map(products.map((product) => [product.id, product]));
      let resolvedCustomerId = customerId;

      if (!resolvedCustomerId && newCustomerName) {
        const customer = await tx.customer.create({
          data: {
            name: newCustomerName,
            phone: newCustomerPhone,
            email: newCustomerEmail?.toLowerCase() ?? null,
            notes: newCustomerNotes,
          },
        });

        resolvedCustomerId = customer.id;
      }

      const requestedQuantityByProduct = new Map<string, number>();
      let saleItemsTotalAmount = 0;

      const computedSaleLines = saleLines.map((line) => {
        const product = productMap.get(line.productId);

        if (!product) {
          throw new Error("Product not found for sale");
        }

        const accumulatedRequestedQuantity =
          (requestedQuantityByProduct.get(line.productId) ?? 0) + line.quantity;

        requestedQuantityByProduct.set(line.productId, accumulatedRequestedQuantity);

        if (product.stockCurrent < accumulatedRequestedQuantity) {
          throw new SaleStockError(product.name);
        }

        const unitPrice = Number(line.soldUnitPrice);
        const grossSubtotal = Number((unitPrice * line.quantity).toFixed(2));
        const subtotalAfterLineDiscount = Number(
          (grossSubtotal * (1 - line.lineDiscountPct / 100)).toFixed(2),
        );
        const finalSubtotal = Number(
          (subtotalAfterLineDiscount * (1 - saleDiscountPct / 100)).toFixed(2),
        );
        const effectiveUnitPrice = Number((finalSubtotal / line.quantity).toFixed(2));
        const unitCostSnapshot = getUnitCostSnapshot({
          applyVatToCost: product.supplier.applyVatToCost,
          consignmentSettlementMode: product.supplier.consignmentSettlementMode,
          cost: product.cost,
          productType: product.productType,
        });
        const { storeAmount, supplierAmount } = computeSaleAmounts({
          consignmentSettlementMode: product.supplier.consignmentSettlementMode,
          productType: product.productType,
          subtotal: finalSubtotal,
          storeCommissionPct:
            product.storeCommissionPct !== null ? Number(product.storeCommissionPct) : null,
          unitCost: unitCostSnapshot == null ? 0 : Number(unitCostSnapshot),
          quantity: line.quantity,
        });

        saleItemsTotalAmount += finalSubtotal;

        return {
          product,
          quantity: line.quantity,
          soldUnitPrice: effectiveUnitPrice.toFixed(2),
          subtotal: finalSubtotal.toFixed(2),
          unitCostSnapshot,
          storeAmount,
          supplierAmount,
        };
      });

      let returnTotalAmount = 0;
      const computedReturnLines: Array<{
        originalSaleLineId: string;
        productId: string;
        quantity: number;
        refundedUnitPrice: string;
        subtotal: string;
        originalSaleNumber: string;
      }> = [];

      if (saleKind === SaleKind.RETURN_EXCHANGE) {
        if (!originalSaleId) {
          throw new SaleReturnValidationError("Debes seleccionar el ticket original.");
        }

        if (returnLines.length === 0) {
          throw new SaleReturnValidationError("Añade al menos una línea devuelta.");
        }

        const originalSale = await tx.sale.findUnique({
          where: { id: originalSaleId },
          include: {
            lines: true,
          },
        });

        if (!originalSale) {
          throw new SaleReturnValidationError("No se encontró el ticket original.");
        }

        const originalLineMap = new Map(originalSale.lines.map((line) => [line.id, line]));
        const requestedReturnLineIds = returnLines.map((line) => line.originalSaleLineId);
        const previousReturns = await tx.saleReturnLine.groupBy({
          by: ["originalSaleLineId"],
          where: {
            originalSaleLineId: { in: requestedReturnLineIds },
          },
          _sum: {
            quantity: true,
          },
        });
        const previouslyReturnedByLine = new Map(
          previousReturns.map((entry) => [
            entry.originalSaleLineId,
            entry._sum.quantity ?? 0,
          ]),
        );

        for (const returnLine of returnLines) {
          const originalLine = originalLineMap.get(returnLine.originalSaleLineId);

          if (!originalLine) {
            throw new SaleReturnValidationError("Una línea de devolución no pertenece al ticket original.");
          }

          if (originalLine.productId !== returnLine.productId) {
            throw new SaleReturnValidationError("Hay una línea devuelta con producto inconsistente.");
          }

          const previouslyReturned = previouslyReturnedByLine.get(originalLine.id) ?? 0;
          const remainingQuantity = originalLine.quantity - previouslyReturned;

          if (remainingQuantity <= 0) {
            throw new SaleReturnValidationError("Una línea ya fue devuelta completamente.");
          }

          if (returnLine.quantity > remainingQuantity) {
            throw new SaleReturnValidationError(
              `No puedes devolver más unidades de las vendidas en línea (${remainingQuantity} disponibles).`,
            );
          }

          const subtotal = Number((returnLine.refundedUnitPrice * returnLine.quantity).toFixed(2));
          returnTotalAmount += subtotal;

          computedReturnLines.push({
            originalSaleLineId: originalLine.id,
            productId: originalLine.productId,
            quantity: returnLine.quantity,
            refundedUnitPrice: returnLine.refundedUnitPrice.toFixed(2),
            subtotal: subtotal.toFixed(2),
            originalSaleNumber: originalSale.saleNumber,
          });
        }
      }

      const netTotalAmount = Number((saleItemsTotalAmount - returnTotalAmount).toFixed(2));

      const sale = await tx.sale.create({
        data: {
          saleNumber,
          date: new Date(),
          customerId: resolvedCustomerId,
          userId: session.userId,
          paymentMethod,
          saleKind,
          originalSaleId: saleKind === SaleKind.RETURN_EXCHANGE ? originalSaleId : null,
          saleItemsTotalAmount: saleItemsTotalAmount.toFixed(2),
          returnTotalAmount: returnTotalAmount.toFixed(2),
          totalAmount: netTotalAmount.toFixed(2),
          notes,
        },
      });

      for (const line of computedSaleLines) {
        await tx.saleLine.create({
          data: {
            saleId: sale.id,
            productId: line.product.id,
            quantity: line.quantity,
            soldUnitPrice: line.soldUnitPrice,
            subtotal: line.subtotal,
            productTypeSnapshot: line.product.productType,
            unitCostSnapshot: line.unitCostSnapshot,
            storeCommissionPctSnapshot: line.product.storeCommissionPct,
            storeAmount: line.storeAmount,
            supplierAmount: line.supplierAmount,
          },
        });

        await tx.product.update({
          where: { id: line.product.id },
          data: {
            stockCurrent: {
              decrement: line.quantity,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: line.product.id,
            type: "SALE",
            referenceType: "SALE",
            referenceId: sale.id,
            quantityDelta: -line.quantity,
            reason: "Sale completed",
            notes,
            userId: session.userId,
          },
        });
      }

      for (const returnLine of computedReturnLines) {
        await tx.saleReturnLine.create({
          data: {
            saleId: sale.id,
            originalSaleLineId: returnLine.originalSaleLineId,
            productId: returnLine.productId,
            quantity: returnLine.quantity,
            refundedUnitPrice: returnLine.refundedUnitPrice,
            subtotal: returnLine.subtotal,
          },
        });

        await tx.product.update({
          where: { id: returnLine.productId },
          data: {
            stockCurrent: {
              increment: returnLine.quantity,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: returnLine.productId,
            type: "ADJUSTMENT",
            referenceType: "SALE",
            referenceId: sale.id,
            quantityDelta: returnLine.quantity,
            reason: `Return from ${returnLine.originalSaleNumber}`,
            notes,
            userId: session.userId,
          },
        });
      }

      return sale.id;
    });

    revalidatePath("/sales/new");
    revalidatePath("/sales/history");
    revalidatePath("/customers");
    revalidatePath("/products");
    revalidatePath("/stock-movements");
    revalidatePath("/dashboard");

    redirect(`/sales/new?created=1&saleId=${saleId}&saleNumber=${encodeURIComponent(saleNumber)}`);
  } catch (error) {
    if (error instanceof SaleStockError) {
      redirect(`/sales/new?error=stock&product=${encodeURIComponent(error.message)}`);
    }

    if (error instanceof SaleReturnValidationError) {
      redirect(`/sales/new?error=return&detail=${encodeURIComponent(error.message)}`);
    }

    redirect("/sales/new?error=invalid_sale");
  }
}
