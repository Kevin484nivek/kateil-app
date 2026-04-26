import { InventoryFlowBuilder } from "@/components/ui/inventory-flow-builder";
import { prisma } from "@/lib/db/prisma";

import { createInventoryEntryAction, createPurchaseOrderAction } from "./actions";

type InventoryEntriesPageProps = {
  searchParams?: Promise<{
    created?: string;
    error?: string;
    id?: string;
    number?: string;
  }>;
};

export default async function InventoryEntriesPage({ searchParams }: InventoryEntriesPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const [suppliers, products, categories, productSubtypes, seasons] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { supplier: true, category: true, productSubtype: true, season: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.productSubtype.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.season.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const supplierOptions = suppliers.map((supplier) => ({
    applyVatToCost: supplier.applyVatToCost,
    id: supplier.id,
    name: supplier.name,
    supplierCode: supplier.supplierCode,
  }));
  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));
  const productOptions = products.map((product) => ({
    id: product.id,
    name: product.name,
    code: product.code,
    supplierId: product.supplierId,
    supplierName: product.supplier.name,
    categoryName: product.category.name,
    productSubtypeName: product.productSubtype?.name ?? null,
    seasonName: product.season?.name ?? null,
    cost: product.cost.toString(),
    productType: product.productType,
    stockCurrent: product.stockCurrent,
    searchText: [
      product.code,
      product.name,
      product.supplier.name,
      product.category.name,
      product.productSubtype?.name,
      product.season?.name,
      product.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));
  const productSubtypeOptions = productSubtypes.map((subtype) => ({
    categoryId: subtype.categoryId,
    id: subtype.id,
    name: subtype.name,
  }));
  const seasonOptions = seasons.map((season) => ({
    categoryId: season.categoryId,
    id: season.id,
    name: season.name,
  }));

  const successState =
    resolvedSearchParams.created && resolvedSearchParams.id && resolvedSearchParams.number
      ? {
          type:
            resolvedSearchParams.created === "order"
              ? ("order" as const)
              : ("entry" as const),
          id: resolvedSearchParams.id,
          number: resolvedSearchParams.number,
        }
      : null;

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Mercancía</p>
          <h1>Entradas y pedidos</h1>
        </div>
        <span className="module-meta">Alta rápida, entrada inmediata o pedido futuro</span>
      </div>

      <InventoryFlowBuilder
        categories={categoryOptions}
        createInventoryEntryAction={createInventoryEntryAction}
        createPurchaseOrderAction={createPurchaseOrderAction}
        initialSuccess={successState}
        productSubtypes={productSubtypeOptions}
        products={productOptions}
        seasons={seasonOptions}
        suppliers={supplierOptions}
      />
      {resolvedSearchParams.error ? (
        <article className="panel panel-accent">
          <p className="card-label">No se pudo guardar la operación</p>
          <p>{resolvedSearchParams.error}</p>
        </article>
      ) : null}
    </section>
  );
}
