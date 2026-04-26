import type { Route } from "next";
import Link from "next/link";

import { AutoSubmitForm } from "@/components/ui/auto-submit-form";
import { prisma } from "@/lib/db/prisma";
import { tokenizeSearchQuery } from "@/lib/utils/search";
import { formatMadridDateTime } from "@/lib/utils/datetime";

type InventoryEntriesHistoryPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function InventoryEntriesHistoryPage({
  searchParams,
}: InventoryEntriesHistoryPageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const searchTokens = tokenizeSearchQuery(query);

  const [entries, orders] = await Promise.all([
    prisma.inventoryEntry.findMany({
      where:
        searchTokens.length > 0
          ? {
              AND: searchTokens.map((token) => ({
                OR: [
                  { entryNumber: { contains: token, mode: "insensitive" } },
                  { supplier: { name: { contains: token, mode: "insensitive" } } },
                  {
                    lines: {
                      some: {
                        OR: [
                          { product: { name: { contains: token, mode: "insensitive" } } },
                          { product: { code: { contains: token, mode: "insensitive" } } },
                        ],
                      },
                    },
                  },
                ],
              })),
            }
          : undefined,
      include: {
        supplier: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.purchaseOrder.findMany({
      where:
        searchTokens.length > 0
          ? {
              AND: searchTokens.map((token) => ({
                OR: [
                  { orderNumber: { contains: token, mode: "insensitive" } },
                  { supplier: { name: { contains: token, mode: "insensitive" } } },
                  {
                    lines: {
                      some: {
                        OR: [
                          { product: { name: { contains: token, mode: "insensitive" } } },
                          { product: { code: { contains: token, mode: "insensitive" } } },
                        ],
                      },
                    },
                  },
                ],
              })),
            }
          : undefined,
      include: {
        supplier: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Mercancía</p>
          <h1>Histórico</h1>
        </div>
        <Link href="/inventory-entries" className="button button-secondary">
          Volver a mercancía
        </Link>
      </div>

      <div className="module-grid">
        <article className="panel">
          <p className="card-label">Entradas registradas</p>
          <AutoSubmitForm className="supplier-search">
            <input
              name="q"
              defaultValue={query}
              placeholder="Entrada, proveedor, producto o código..."
            />
            <button className="button button-secondary" type="submit">
              Buscar
            </button>
          </AutoSubmitForm>
          {query ? (
            <div className="active-filter-row" aria-label="Filtros activos">
              <span className="active-filter-label">Filtros activos</span>
              <span className="active-filter-chip">Búsqueda: {query}</span>
            </div>
          ) : null}
          <div className="entity-list">
            {entries.map((entry) => (
              <article key={entry.id} className="entity-card">
                <div className="entity-card-header">
                  <div>
                    <h3>
                      <Link href={`/inventory-entries/${entry.id}` as Route}>
                        {entry.entryNumber}
                      </Link>
                    </h3>
                    <p>
                      {entry.supplier.name} · {formatMadridDateTime(entry.createdAt)}
                    </p>
                  </div>
                  <span className="status-pill status-active">{entry.lines.length} líneas</span>
                </div>
                <div className="hero-actions">
                  <Link
                    href={`/inventory-entries/${entry.id}/delivery-note` as Route}
                    className="button button-secondary"
                  >
                    Ver albarán
                  </Link>
                </div>
                {entry.attachmentUrls.length > 0 ? (
                  <p className="sales-line-caption">
                    {entry.attachmentUrls.length} adjunto{entry.attachmentUrls.length === 1 ? "" : "s"}
                  </p>
                ) : null}
                <div className="entry-summary-list">
                  {entry.lines.map((line) => (
                    <div key={line.id} className="entry-summary-row">
                      <span>{line.product.name}</span>
                      <span>
                        +{line.quantity} · {line.unitCost.toString()} €
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="card-label">Pedidos futuros</p>
          <div className="entity-list">
            {orders.map((order) => (
              <article key={order.id} className="entity-card">
                <div className="entity-card-header">
                  <div>
                    <h3>
                      <Link href={`/inventory-entries/orders/${order.id}` as Route}>
                        {order.orderNumber}
                      </Link>
                    </h3>
                    <p>
                      {order.supplier.name} · {formatMadridDateTime(order.createdAt)}
                    </p>
                  </div>
                  <span className="status-pill status-active">{order.status}</span>
                </div>
                {order.attachmentUrls.length > 0 ? (
                  <p className="sales-line-caption">
                    {order.attachmentUrls.length} adjunto{order.attachmentUrls.length === 1 ? "" : "s"}
                  </p>
                ) : null}
                <div className="entry-summary-list">
                  {order.lines.map((line) => (
                    <div key={line.id} className="entry-summary-row">
                      <span>{line.product.name}</span>
                      <span>
                        {line.quantity} · {line.unitCost.toString()} €
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
