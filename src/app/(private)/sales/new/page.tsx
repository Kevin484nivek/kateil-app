import { SaleBuilder } from "@/components/ui/sale-builder";
import { FloatingNoticeHost } from "@/components/ui/floating-notice-host";
import { SaleSuccessNotice } from "@/components/ui/sale-success-notice";
import { requireUserSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireModuleAccess } from "@/lib/platform/modules";
import { getProductTypeLabel } from "@/lib/ui/labels";

import { createSaleAction } from "../actions";

type NewSalePageProps = {
  searchParams?: Promise<{
    created?: string;
    detail?: string;
    error?: string;
    product?: string;
    saleId?: string;
    saleNumber?: string;
  }>;
};

function resolveSaleMessage(input: { detail?: string; error?: string; product?: string }) {
  if (input.error === "missing_lines") {
    return "Añade al menos una línea de venta o devolución antes de confirmar.";
  }

  if (input.error === "stock") {
    return `No hay stock suficiente para ${input.product ?? "el producto seleccionado"}.`;
  }

  if (input.error === "return") {
    return input.detail ?? "No se pudo validar la devolución/cambio.";
  }

  if (input.error === "invalid_sale") {
    return "La venta no se pudo registrar. Revisa cantidades, precio y stock.";
  }

  return null;
}

export default async function NewSalePage({ searchParams }: NewSalePageProps) {
  const session = await requireUserSession();
  await requireModuleAccess(session, "SALES_CORE");

  const [products, customers, recentSales] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: {
        supplier: true,
        category: true,
        productSubtype: true,
        season: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.sale.findMany({
      where: {
        saleKind: "NORMAL",
      },
      include: {
        customer: true,
        lines: {
          include: {
            product: true,
            returnLines: {
              select: { quantity: true },
            },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 250,
    }),
  ]);
  const params = await searchParams;
  const message = resolveSaleMessage({
    detail: params?.detail,
    error: params?.error,
    product: params?.product,
  });
  const initialSuccess =
    params?.created === "1" && params.saleId && params.saleNumber
      ? {
          id: params.saleId,
          saleNumber: params.saleNumber,
        }
      : null;
  const productOptions = products.map((product) => ({
    id: product.id,
    name: product.name,
    code: product.code,
    description: product.description,
    basePrice: product.basePrice.toString(),
    stockCurrent: product.stockCurrent,
    supplierName: product.supplier.name,
    categoryName: product.category.name,
    productSubtypeName: product.productSubtype?.name ?? null,
    seasonName: product.season?.name ?? null,
    productType: product.productType,
    size: product.size,
    color: product.color,
    searchText: [
      product.code,
      product.name,
      product.description,
      product.supplier.name,
      product.category.name,
      product.productSubtype?.name,
      product.season?.name,
      getProductTypeLabel(product.productType),
      product.size,
      product.color,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));
  const originalSales = recentSales.map((sale) => ({
    id: sale.id,
    saleNumber: sale.saleNumber,
    date: sale.date.toISOString(),
    customerName: sale.customer?.name ?? null,
    lines: sale.lines.map((line) => ({
      saleLineId: line.id,
      productId: line.productId,
      productName: line.product.name,
      productCode: line.product.code,
      quantity: line.quantity,
      soldUnitPrice: line.soldUnitPrice.toString(),
      returnedQuantity: line.returnLines.reduce((sum, item) => sum + item.quantity, 0),
    })),
  }));

  return (
    <section className="module-page">
      <FloatingNoticeHost />
      {initialSuccess ? <SaleSuccessNotice saleNumber={initialSuccess.saleNumber} /> : null}

      <div className="module-header">
        <div>
          <p className="eyebrow">Nueva venta</p>
          <h1>Pantalla TPV</h1>
        </div>
        <span className="module-meta">{products.length} productos disponibles</span>
      </div>

      <SaleBuilder
        customers={customers}
        errorMessage={message}
        formAction={createSaleAction}
        originalSales={originalSales}
        products={productOptions}
      />
    </section>
  );
}
