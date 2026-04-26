import { AutoSubmitForm } from "@/components/ui/auto-submit-form";
import { prisma } from "@/lib/db/prisma";
import { tokenizeSearchQuery } from "@/lib/utils/search";
import { formatMadridDateTime } from "@/lib/utils/datetime";

type StockMovementsPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function StockMovementsPage({ searchParams }: StockMovementsPageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const searchTokens = tokenizeSearchQuery(query);

  const movements = await prisma.stockMovement.findMany({
    where:
      searchTokens.length > 0
        ? {
            AND: searchTokens.map((token) => ({
              OR: [
                { referenceId: { contains: token, mode: "insensitive" } },
                { product: { name: { contains: token, mode: "insensitive" } } },
                { product: { code: { contains: token, mode: "insensitive" } } },
                { user: { email: { contains: token, mode: "insensitive" } } },
                { user: { name: { contains: token, mode: "insensitive" } } },
              ],
            })),
          }
        : undefined,
    include: {
      product: true,
      user: true,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Stock</p>
          <h1>Movimientos</h1>
        </div>
        <span className="module-meta">{movements.length} recientes</span>
      </div>

      <article className="panel">
        <p className="card-label">Trazabilidad</p>
        <p>
          Cada cambio de inventario queda registrado con producto, tipo, cantidad,
          referencia y usuario. Ya muestra altas iniciales y entradas de mercancía.
        </p>

        <AutoSubmitForm className="supplier-search">
          <input
            name="q"
            defaultValue={query}
            placeholder="Producto, código, tipo, referencia o usuario..."
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

        <div className="movements-table">
          <div className="movements-row movements-row-head">
            <span>Fecha</span>
            <span>Producto</span>
            <span>Tipo</span>
            <span>Cantidad</span>
            <span>Referencia</span>
            <span>Usuario</span>
          </div>
          {movements.map((movement) => (
            <div key={movement.id} className="movements-row">
              <span>{formatMadridDateTime(movement.createdAt)}</span>
              <span>{movement.product.name}</span>
              <span>{movement.type}</span>
              <span>{movement.quantityDelta > 0 ? `+${movement.quantityDelta}` : movement.quantityDelta}</span>
              <span>{movement.referenceType}</span>
              <span>{movement.user.email}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
