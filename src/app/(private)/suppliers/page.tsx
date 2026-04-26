import { AutoSubmitForm } from "@/components/ui/auto-submit-form";
import { prisma } from "@/lib/db/prisma";
import { getConsignmentSettlementModeLabel } from "@/lib/ui/labels";
import { tokenizeSearchQuery } from "@/lib/utils/search";
import { ConsignmentSettlementMode } from "@prisma/client";
import Link from "next/link";

import { createSupplierAction, toggleSupplierAction, updateSupplierAction } from "./actions";

type SuppliersPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

function getSupplierSettlementSummary(supplier: {
  consignmentSettlementMode: ConsignmentSettlementMode;
  defaultStoreCommissionPct: { toString(): string } | null;
}) {
  if (supplier.consignmentSettlementMode === ConsignmentSettlementMode.FIXED_COST) {
    return getConsignmentSettlementModeLabel(supplier.consignmentSettlementMode);
  }

  if (supplier.defaultStoreCommissionPct) {
    return `${supplier.defaultStoreCommissionPct}% tienda`;
  }

  return getConsignmentSettlementModeLabel(supplier.consignmentSettlementMode);
}

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const searchTokens = tokenizeSearchQuery(query);

  const suppliers = await prisma.supplier.findMany({
    where: searchTokens.length > 0
      ? {
          AND: searchTokens.map((token) => ({
            OR: [
              { supplierCode: { contains: token, mode: "insensitive" } },
              { name: { contains: token, mode: "insensitive" } },
              { contactName: { contains: token, mode: "insensitive" } },
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
          <p className="eyebrow">Proveedores</p>
          <h1>Relación comercial</h1>
        </div>
        <div className="hero-actions">
          <span className="module-meta">{suppliers.length} registrados</span>
          <Link href="/suppliers/statement" className="button button-secondary">
            Generar justificante
          </Link>
        </div>
      </div>

      <div className="module-grid">
        <article className="panel">
          <p className="card-label">Nuevo proveedor</p>
          <form action={createSupplierAction} className="entity-form">
            <label>
              <span>Nombre</span>
              <input name="name" required />
            </label>
            <label>
              <span>Código</span>
              <input value="Se genera automáticamente" disabled />
            </label>
            <label>
              <span>Persona de contacto</span>
              <input name="contactName" />
            </label>
            <label>
              <span>Teléfono</span>
              <input name="phone" />
            </label>
            <label>
              <span>Email</span>
              <input name="email" type="email" />
            </label>
            <label>
              <span>% comisión tienda por defecto</span>
              <input name="defaultStoreCommissionPct" inputMode="decimal" />
            </label>
            <label>
              <span>Liquidación consigna</span>
              <select name="consignmentSettlementMode" defaultValue={ConsignmentSettlementMode.PERCENT_COMMISSION}>
                <option value={ConsignmentSettlementMode.PERCENT_COMMISSION}>
                  Comisión porcentual
                </option>
                <option value={ConsignmentSettlementMode.FIXED_COST}>Coste fijo</option>
              </select>
            </label>
            <label className="checkbox-card full-span">
              <input type="checkbox" name="applyVatToCost" value="true" />
              <span>Aplicar IVA al coste</span>
            </label>
            <label>
              <span>Contrato PDF</span>
              <input name="contractFile" type="file" accept="application/pdf,.pdf" />
            </label>
            <label className="full-span">
              <span>Notas</span>
              <textarea name="notes" rows={4} />
            </label>
            <button className="button button-primary" type="submit">
              Guardar proveedor
            </button>
          </form>
        </article>

        <article className="panel">
          <div className="module-list-header">
            <div>
              <p className="card-label">Listado</p>
              <p>Buscador rápido, contrato, contacto y edición operativa.</p>
            </div>
          </div>

          <AutoSubmitForm className="supplier-search">
            <input
              name="q"
              defaultValue={query}
              placeholder="Nombre, código, contacto, teléfono, email o nota..."
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
            {suppliers.map((supplier) => (
              <details key={supplier.id} className="entity-card entity-card-accordion">
                <summary className="entity-card-summary">
                  <div>
                    <h3>{supplier.name}</h3>
                    <p>
                      {supplier.supplierCode || "Sin código"} · {supplier.contactName || "Sin contacto"} ·{" "}
                      {getSupplierSettlementSummary(supplier)}
                    </p>
                  </div>
                  <div className="entity-summary-meta">
                    <span className={`status-pill ${supplier.isActive ? "status-active" : ""}`}>
                      {supplier.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </summary>
                <dl className="entity-meta">
                  <div>
                    <dt>Código</dt>
                    <dd>{supplier.supplierCode || "No asignado"}</dd>
                  </div>
                  <div>
                    <dt>Teléfono</dt>
                    <dd>{supplier.phone || "No indicado"}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{supplier.email || "No indicado"}</dd>
                  </div>
                  <div>
                    <dt>Contrato</dt>
                    <dd>
                      {supplier.contractPdfUrl ? (
                        <a
                          href={supplier.contractPdfUrl}
                          className="text-link"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir PDF
                        </a>
                      ) : (
                        "No adjuntado"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>IVA al coste</dt>
                    <dd>{supplier.applyVatToCost ? "Sí, 21%" : "No"}</dd>
                  </div>
                  <div>
                    <dt>Liquidación consigna</dt>
                    <dd>{getConsignmentSettlementModeLabel(supplier.consignmentSettlementMode)}</dd>
                  </div>
                </dl>
                {supplier.notes ? <p className="entity-notes">{supplier.notes}</p> : null}

                <details className="entity-edit-block">
                  <summary>Editar proveedor</summary>
                  <form action={updateSupplierAction} className="entity-form entity-form-inline">
                    <input type="hidden" name="supplierId" value={supplier.id} />
                    <input
                      type="hidden"
                      name="existingContractPdfUrl"
                      value={supplier.contractPdfUrl ?? ""}
                    />
                    <label>
                      <span>Nombre</span>
                      <input name="name" required defaultValue={supplier.name} />
                    </label>
                    <label>
                      <span>Código</span>
                      <input
                        name="supplierCode"
                        defaultValue={supplier.supplierCode ?? ""}
                        placeholder="Se propone por iniciales"
                      />
                    </label>
                    <label>
                      <span>Persona de contacto</span>
                      <input name="contactName" defaultValue={supplier.contactName ?? ""} />
                    </label>
                    <label>
                      <span>Teléfono</span>
                      <input name="phone" defaultValue={supplier.phone ?? ""} />
                    </label>
                    <label>
                      <span>Email</span>
                      <input name="email" type="email" defaultValue={supplier.email ?? ""} />
                    </label>
                    <label>
                      <span>% comisión tienda por defecto</span>
                      <input
                        name="defaultStoreCommissionPct"
                        inputMode="decimal"
                        defaultValue={supplier.defaultStoreCommissionPct?.toString() ?? ""}
                      />
                    </label>
                    <label>
                      <span>Liquidación consigna</span>
                      <select
                        name="consignmentSettlementMode"
                        defaultValue={supplier.consignmentSettlementMode}
                      >
                        <option value={ConsignmentSettlementMode.PERCENT_COMMISSION}>
                          Comisión porcentual
                        </option>
                        <option value={ConsignmentSettlementMode.FIXED_COST}>Coste fijo</option>
                      </select>
                    </label>
                    <label className="checkbox-card full-span">
                      <input
                        type="checkbox"
                        name="applyVatToCost"
                        value="true"
                        defaultChecked={supplier.applyVatToCost}
                      />
                      <span>Aplicar IVA al coste</span>
                    </label>
                    <label>
                      <span>Nuevo contrato PDF</span>
                      <input name="contractFile" type="file" accept="application/pdf,.pdf" />
                    </label>
                    <label className="full-span">
                      <span>Notas</span>
                      <textarea name="notes" rows={4} defaultValue={supplier.notes ?? ""} />
                    </label>
                    <button className="button button-primary" type="submit">
                      Guardar cambios
                    </button>
                  </form>
                </details>

                <form action={toggleSupplierAction}>
                  <input type="hidden" name="supplierId" value={supplier.id} />
                  <input type="hidden" name="nextState" value={String(!supplier.isActive)} />
                  <button className="button button-secondary" type="submit">
                    {supplier.isActive ? "Desactivar" : "Reactivar"}
                  </button>
                </form>
              </details>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
