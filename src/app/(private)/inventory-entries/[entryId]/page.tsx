import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { formatMadridDate, formatMadridDateTime, formatMadridTime } from "@/lib/utils/datetime";

type InventoryEntryDetailPageProps = {
  params: Promise<{
    entryId: string;
  }>;
};

export default async function InventoryEntryDetailPage({
  params,
}: InventoryEntryDetailPageProps) {
  const { entryId } = await params;
  const entry = await prisma.inventoryEntry.findUnique({
    where: { id: entryId },
    include: {
      supplier: true,
      user: true,
      lines: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!entry) {
    notFound();
  }

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Mercancía</p>
          <h1>{entry.entryNumber}</h1>
          <p>
            {entry.supplier.name} · {formatMadridDateTime(entry.createdAt)}
          </p>
        </div>
        <div className="hero-actions">
          <Link
            href={`/inventory-entries/${entry.id}/delivery-note`}
            className="button button-primary"
          >
            Ver albarán
          </Link>
          <Link href="/inventory-entries/history" className="button button-secondary">
            Volver al histórico
          </Link>
        </div>
      </div>

      <div className="module-grid">
        <article className="panel">
          <p className="card-label">Detalle de entrada</p>
          <dl className="entity-meta">
            <div>
              <dt>Proveedor</dt>
              <dd>{entry.supplier.name}</dd>
            </div>
            <div>
              <dt>Registrada por</dt>
              <dd>{entry.user.email}</dd>
            </div>
            <div>
              <dt>Fecha operativa</dt>
              <dd>{formatMadridDate(entry.date)}</dd>
            </div>
            <div>
              <dt>Hora registro</dt>
              <dd>{formatMadridTime(entry.createdAt)}</dd>
            </div>
          </dl>
          {entry.notes ? <p className="entity-notes">{entry.notes}</p> : null}
          {entry.attachmentUrls.length > 0 ? (
            <div className="entity-list">
              <article className="entity-card">
                <p className="card-label">Adjuntos</p>
                <div className="entry-summary-list">
                  {entry.attachmentUrls.map((attachmentUrl, index) => (
                    <div key={attachmentUrl} className="entry-summary-row">
                      <span>Documento {index + 1}</span>
                      <a className="text-link" href={attachmentUrl} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <p className="card-label">Líneas</p>
          <div className="entity-list">
            {entry.lines.map((line) => (
              <article key={line.id} className="entity-card">
                <div className="entity-card-header">
                  <div>
                    <h3>{line.product.name}</h3>
                    <p>
                      {line.product.code}
                    </p>
                  </div>
                  <span className="status-pill status-active">
                    +{line.quantity} uds
                  </span>
                </div>
                <dl className="entity-meta">
                  <div>
                    <dt>Coste unitario</dt>
                    <dd>{line.unitCost.toString()} €</dd>
                  </div>
                  <div>
                    <dt>Impacto stock</dt>
                    <dd>+{line.quantity}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
