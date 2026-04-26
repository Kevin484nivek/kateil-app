import type { Route } from "next";
import Link from "next/link";
import { ProductType } from "@prisma/client";

import { FloatingNoticeHost } from "@/components/ui/floating-notice-host";
import { ProductForm } from "@/components/ui/product-form";
import { prisma } from "@/lib/db/prisma";
import { getProductTypeLabel } from "@/lib/ui/labels";
import { tokenizeSearchQuery } from "@/lib/utils/search";

import { toggleProductAction, updateProductAction } from "./actions";

type ProductsPageProps = {
  searchParams?: Promise<{
    backToSaleHref?: string;
    backToSaleLabel?: string;
    category?: string;
    page?: string;
    q?: string;
    status?: string;
    stock?: string;
    supplier?: string;
    type?: string;
  }>;
};

type ProductSearchFilters = NonNullable<Awaited<ProductsPageProps["searchParams"]>>;

const PAGE_SIZE = 50;
const DEFAULT_STOCK_FILTER = "with";

function getCurrentPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildProductsPageHref(
  filters: ProductSearchFilters,
  page: number,
) {
  const params = new URLSearchParams();

  if (filters.backToSaleHref) {
    params.set("backToSaleHref", filters.backToSaleHref);
  }

  if (filters.backToSaleLabel) {
    params.set("backToSaleLabel", filters.backToSaleLabel);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.stock) {
    params.set("stock", filters.stock);
  }

  if (filters.supplier) {
    params.set("supplier", filters.supplier);
  }

  if (filters.type) {
    params.set("type", filters.type);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return (query ? `/products?${query}` : "/products") as Route;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const requestedFilters = (await searchParams) ?? {};
  const filters: ProductSearchFilters = {
    ...requestedFilters,
    stock: requestedFilters.stock ?? DEFAULT_STOCK_FILTER,
  };
  const requestedPage = getCurrentPage(filters.page);
  const searchTokens = tokenizeSearchQuery(filters.q ?? "");
  const where = {
    ...(filters.category ? { categoryId: filters.category } : {}),
    ...(filters.supplier ? { supplierId: filters.supplier } : {}),
    ...(filters.type ? { productType: filters.type as ProductType } : {}),
    ...(filters.status === "active"
      ? { isActive: true }
      : filters.status === "inactive"
        ? { isActive: false }
        : {}),
    ...(filters.stock === "with"
      ? { stockCurrent: { gt: 0 } }
      : filters.stock === "empty"
        ? { stockCurrent: { lte: 0 } }
        : {}),
    ...(searchTokens.length > 0
      ? {
          AND: searchTokens.map((token) => ({
            OR: [
              { code: { contains: token, mode: "insensitive" as const } },
              { name: { contains: token, mode: "insensitive" as const } },
              { description: { contains: token, mode: "insensitive" as const } },
              { supplier: { name: { contains: token, mode: "insensitive" as const } } },
              { category: { name: { contains: token, mode: "insensitive" as const } } },
              { productSubtype: { name: { contains: token, mode: "insensitive" as const } } },
              { season: { name: { contains: token, mode: "insensitive" as const } } },
            ],
          })),
        }
      : {}),
  };

  const totalProducts = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const [
    products,
    suppliers,
    categories,
    productSubtypes,
    seasons,
    totalUnitsAggregate,
    activeProducts,
    withStock,
  ] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        productSubtype: true,
        season: true,
        supplier: true,
      },
      orderBy: [{ isActive: "desc" }, { stockCurrent: "desc" }, { createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.productSubtype.findMany({
      where: { isActive: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      include: { category: true },
    }),
    prisma.season.findMany({
      where: { isActive: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      include: { category: true },
    }),
    prisma.product.aggregate({
      where,
      _sum: {
        stockCurrent: true,
      },
    }),
    prisma.product.count({
      where: {
        ...where,
        isActive: true,
      },
    }),
    prisma.product.count({
      where: {
        ...where,
        stockCurrent: {
          gt: 0,
        },
      },
    }),
  ]);
  const totalUnits = totalUnitsAggregate._sum.stockCurrent ?? 0;
  const supplierOptions = suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }));
  const categoryOptions = categories.map((category) => ({ id: category.id, name: category.name }));
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
  const activeFilterChips = [
    ...(filters.q ? [`Búsqueda: ${filters.q}`] : []),
    ...(filters.supplier
      ? [`Proveedor: ${suppliers.find((supplier) => supplier.id === filters.supplier)?.name ?? "seleccionado"}`]
      : []),
    ...(filters.category
      ? [`Categoría: ${categories.find((category) => category.id === filters.category)?.name ?? "seleccionada"}`]
      : []),
    ...(filters.type ? [`Tipo: ${getProductTypeLabel(filters.type as ProductType)}`] : []),
    ...(filters.stock === "with"
      ? ["Stock: con stock"]
      : filters.stock === "empty"
        ? ["Stock: sin stock"]
        : []),
    ...(filters.status === "active"
      ? ["Estado: activos"]
      : filters.status === "inactive"
        ? ["Estado: inactivos"]
        : []),
  ];

  return (
    <section className="module-page">
      <FloatingNoticeHost />
      <div className="module-header">
        <div>
          <div>
            <p className="eyebrow">Productos</p>
            <h1>Stock y catálogo</h1>
          </div>
        </div>
        <div className="hero-actions">
          <span className="module-meta">
            {totalProducts} visibles · página {currentPage} de {totalPages}
          </span>
          <Link href="/catalogs" className="button button-secondary">
            Configuración de catálogo
          </Link>
        </div>
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <p className="card-label">Productos activos</p>
          <strong>{activeProducts}</strong>
        </article>
        <article className="metric-card metric-card-soft">
          <p className="card-label">Unidades en stock</p>
          <strong>{totalUnits}</strong>
        </article>
        <article className="metric-card">
          <p className="card-label">Con stock</p>
          <strong>{withStock}</strong>
        </article>
        <article className="metric-card metric-card-soft">
          <p className="card-label">Sin stock</p>
          <strong>{totalProducts - withStock}</strong>
        </article>
      </div>

      <article className="panel">
        <form method="get" className="products-filters">
          {filters.backToSaleHref ? (
            <input type="hidden" name="backToSaleHref" value={filters.backToSaleHref} />
          ) : null}
          {filters.backToSaleLabel ? (
            <input type="hidden" name="backToSaleLabel" value={filters.backToSaleLabel} />
          ) : null}
          <label className="products-search">
            <span>Buscador</span>
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Código, nombre, proveedor, categoría, subtipo..."
            />
          </label>
          <label>
            <span>Proveedor</span>
            <select name="supplier" defaultValue={filters.supplier ?? ""}>
              <option value="">Todos</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Categoría</span>
            <select name="category" defaultValue={filters.category ?? ""}>
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select name="type" defaultValue={filters.type ?? ""}>
              <option value="">Todos</option>
              <option value={ProductType.OWNED}>{getProductTypeLabel(ProductType.OWNED)}</option>
              <option value={ProductType.CONSIGNMENT}>{getProductTypeLabel(ProductType.CONSIGNMENT)}</option>
            </select>
          </label>
          <label>
            <span>Stock</span>
            <select name="stock" defaultValue={filters.stock ?? DEFAULT_STOCK_FILTER}>
              <option value="">Todo</option>
              <option value="with">Con stock</option>
              <option value="empty">Sin stock</option>
            </select>
          </label>
          <label>
            <span>Estado</span>
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </label>
          <div className="products-filter-actions">
            <button className="button button-primary" type="submit">
              Filtrar
            </button>
            <Link href="/products" className="button button-secondary">
              Limpiar
            </Link>
          </div>
        </form>
        {activeFilterChips.length > 0 ? (
          <div className="active-filter-row" aria-label="Filtros activos">
            <span className="active-filter-label">Filtros activos</span>
            {activeFilterChips.map((chip) => (
              <span key={chip} className="active-filter-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </article>

      <article className="panel">
        <div className="module-list-header">
          <div>
            <p className="card-label">Listado principal</p>
            <p>Consulta rápida de stock, catálogo y producto activo sin mezclarlo con entradas.</p>
          </div>
        </div>

        {totalProducts > 0 ? (
          <div className="pagination-bar">
            <p className="pagination-meta">
              Mostrando {skip + 1}-{Math.min(skip + products.length, totalProducts)} de {totalProducts}
              productos
            </p>
            <div className="hero-actions">
              {filters.backToSaleHref ? (
                <Link href={filters.backToSaleHref as Route} className="button button-secondary">
                  {filters.backToSaleLabel ?? "Volver a la venta"}
                </Link>
              ) : (
                <>
                  <Link
                    href={buildProductsPageHref(filters, Math.max(1, currentPage - 1))}
                    className="button button-secondary"
                    aria-disabled={currentPage === 1}
                  >
                    Anterior
                  </Link>
                  <Link
                    href={buildProductsPageHref(filters, Math.min(totalPages, currentPage + 1))}
                    className="button button-secondary"
                    aria-disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}

        <div className="entity-list">
          {products.map((product) => (
            <details key={product.id} className="entity-card entity-card-accordion">
              <summary className="entity-card-summary">
                <div>
                  <h3>{product.name}</h3>
                  <p>
                    {product.code} · {product.category.name}
                    {product.productSubtype ? ` · ${product.productSubtype.name}` : ""}
                    {product.season ? ` · ${product.season.name}` : ""}
                    {" · "}
                    {product.supplier.name}
                  </p>
                </div>
                <div className="entity-summary-meta">
                  <span className={`status-pill ${product.isActive ? "status-active" : ""}`}>
                    {product.isActive ? "Activo" : "Inactivo"}
                  </span>
                  <strong>{product.stockCurrent} uds</strong>
                </div>
              </summary>
              <dl className="entity-meta">
                <div>
                  <dt>Tipo</dt>
                  <dd>{getProductTypeLabel(product.productType)}</dd>
                </div>
                <div>
                  <dt>Stock</dt>
                  <dd>{product.stockCurrent}</dd>
                </div>
                <div>
                  <dt>PVP</dt>
                  <dd>{product.basePrice.toString()} €</dd>
                </div>
                <div>
                  <dt>Coste</dt>
                  <dd>{product.cost.toString()} €</dd>
                </div>
                <div>
                  <dt>% tienda</dt>
                  <dd>
                    {product.productType === ProductType.OWNED
                      ? "100%"
                      : `${product.storeCommissionPct?.toString() ?? "0"}%`}
                  </dd>
                </div>
                <div>
                  <dt>Subtipo</dt>
                  <dd>{product.productSubtype?.name ?? "Sin definir"}</dd>
                </div>
                <div>
                  <dt>Temporada</dt>
                  <dd>{product.season?.name ?? "Sin definir"}</dd>
                </div>
              </dl>
              <p className="entity-notes">{product.description}</p>
              {product.notes ? <p className="entity-notes">{product.notes}</p> : null}
              <details className="entity-edit-block">
                <summary>Editar producto</summary>
                <ProductForm
                  categories={categoryOptions}
                  formAction={updateProductAction}
                  initialValues={{
                    basePrice: product.basePrice.toString(),
                    categoryId: product.categoryId,
                    color: product.color,
                    cost: product.cost.toString(),
                    description: product.description,
                    id: product.id,
                    name: product.name,
                    notes: product.notes,
                    productSubtypeName: product.productSubtype?.name ?? null,
                    productType: product.productType,
                    seasonName: product.season?.name ?? null,
                    size: product.size,
                    stockCurrent: product.stockCurrent,
                    storeCommissionPct: product.storeCommissionPct?.toString() ?? null,
                    supplierId: product.supplierId,
                  }}
                  productSubtypes={productSubtypeOptions}
                  seasons={seasonOptions}
                  showStockInitial={false}
                  showStockCurrent
                  submitLabel="Guardar cambios"
                  suppliers={supplierOptions}
                />
              </details>
              <form action={toggleProductAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="nextState" value={String(!product.isActive)} />
                <button className="button button-secondary" type="submit">
                  {product.isActive ? "Desactivar" : "Reactivar"}
                </button>
              </form>
            </details>
          ))}
            {products.length === 0 ? (
              <article className="entity-card">
                <h3>Sin resultados</h3>
                <p>
                  Ajusta los filtros o ve a <Link href="/inventory-entries">Mercancía</Link> para
                  dar de alta nuevas entradas o productos.
                </p>
              </article>
            ) : null}
        </div>

        {totalProducts > 0 ? (
          <div className="pagination-bar">
            <p className="pagination-meta">
              Página {currentPage} de {totalPages}
            </p>
            <div className="hero-actions">
              {filters.backToSaleHref ? (
                <Link href={filters.backToSaleHref as Route} className="button button-secondary">
                  {filters.backToSaleLabel ?? "Volver a la venta"}
                </Link>
              ) : (
                <>
                  <Link
                    href={buildProductsPageHref(filters, Math.max(1, currentPage - 1))}
                    className="button button-secondary"
                    aria-disabled={currentPage === 1}
                  >
                    Anterior
                  </Link>
                  <Link
                    href={buildProductsPageHref(filters, Math.min(totalPages, currentPage + 1))}
                    className="button button-secondary"
                    aria-disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </article>
    </section>
  );
}
