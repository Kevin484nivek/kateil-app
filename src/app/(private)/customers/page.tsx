import { AutoSubmitForm } from "@/components/ui/auto-submit-form";
import { prisma } from "@/lib/db/prisma";
import { tokenizeSearchQuery } from "@/lib/utils/search";

import { createCustomerAction, toggleCustomerAction } from "./actions";

type CustomersPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const searchTokens = tokenizeSearchQuery(query);

  const customers = await prisma.customer.findMany({
    where:
      searchTokens.length > 0
        ? {
            AND: searchTokens.map((token) => ({
              OR: [
                { name: { contains: token, mode: "insensitive" } },
                { phone: { contains: token, mode: "insensitive" } },
                { email: { contains: token, mode: "insensitive" } },
                { notes: { contains: token, mode: "insensitive" } },
              ],
            })),
          }
        : undefined,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Clientes</p>
          <h1>Ficha y compras</h1>
        </div>
        <span className="module-meta">{customers.length} registrados</span>
      </div>

      <div className="module-grid">
        <article className="panel">
          <p className="card-label">Nuevo cliente</p>
          <form action={createCustomerAction} className="entity-form">
            <label>
              <span>Nombre</span>
              <input name="name" required />
            </label>
            <label>
              <span>Teléfono</span>
              <input name="phone" />
            </label>
            <label>
              <span>Email</span>
              <input name="email" type="email" />
            </label>
            <label className="full-span">
              <span>Notas</span>
              <textarea name="notes" rows={4} />
            </label>
            <button className="button button-primary" type="submit">
              Guardar cliente
            </button>
          </form>
        </article>

        <article className="panel">
          <div className="module-list-header">
            <div>
              <p className="card-label">Listado</p>
              <p>Base para CRM ligero con notas e histórico de compras.</p>
            </div>
          </div>

          <AutoSubmitForm className="supplier-search">
            <input
              name="q"
              defaultValue={query}
              placeholder="Nombre, teléfono, email o nota..."
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
            {customers.map((customer) => (
              <article key={customer.id} className="entity-card">
                <div className="entity-card-header">
                  <div>
                    <h3>{customer.name}</h3>
                    <p>{customer.email || "Sin email"}</p>
                  </div>
                  <span className={`status-pill ${customer.isActive ? "status-active" : ""}`}>
                    {customer.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <dl className="entity-meta">
                  <div>
                    <dt>Teléfono</dt>
                    <dd>{customer.phone || "No indicado"}</dd>
                  </div>
                  <div>
                    <dt>Compras</dt>
                    <dd>Disponible en la siguiente fase</dd>
                  </div>
                </dl>
                {customer.notes ? <p className="entity-notes">{customer.notes}</p> : null}
                <form action={toggleCustomerAction}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <input type="hidden" name="nextState" value={String(!customer.isActive)} />
                  <button className="button button-secondary" type="submit">
                    {customer.isActive ? "Desactivar" : "Reactivar"}
                  </button>
                </form>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
