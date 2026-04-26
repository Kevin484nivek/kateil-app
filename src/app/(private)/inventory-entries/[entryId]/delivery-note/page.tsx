import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/ui/print-button";
import { prisma } from "@/lib/db/prisma";
import { formatMadridDate, formatMadridDateTime, formatMadridTime } from "@/lib/utils/datetime";

type InventoryEntryDeliveryNotePageProps = {
  params: Promise<{
    entryId: string;
  }>;
};

function formatMoney(value: number | string | { toString(): string }) {
  return `${Number(value).toFixed(2)} €`;
}

export default async function InventoryEntryDeliveryNotePage({
  params,
}: InventoryEntryDeliveryNotePageProps) {
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

  const totalUnits = entry.lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalCost = entry.lines.reduce((sum, line) => sum + line.quantity * Number(line.unitCost), 0);

  return (
    <section className="module-page">
      <div className="module-header print-hidden">
        <div>
          <p className="eyebrow">Mercancía</p>
          <h1>Albarán de entrada</h1>
          <p>
            {entry.entryNumber} · {entry.supplier.name}
          </p>
        </div>
        <div className="hero-actions">
          <Link href={`/inventory-entries/${entry.id}`} className="button button-secondary">
            Volver al detalle
          </Link>
          <PrintButton
            filename={`albaran-${entry.entryNumber.toLowerCase()}`}
            label="Imprimir albarán"
          />
        </div>
      </div>

      <article className="inventory-delivery-note-paper">
        <header className="inventory-delivery-note-header">
          <div>
            <p className="eyebrow">Kateil Platform</p>
            <h2>Albarán de entrada</h2>
            <p className="inventory-delivery-note-subtitle">
              Documento de recepción de mercancía registrado en el sistema.
            </p>
          </div>

          <dl className="inventory-delivery-note-meta">
            <div>
              <dt>Entrada</dt>
              <dd>{entry.entryNumber}</dd>
            </div>
            <div>
              <dt>Proveedor</dt>
              <dd>{entry.supplier.name}</dd>
            </div>
            <div>
              <dt>Fecha operativa</dt>
              <dd>{formatMadridDate(entry.date)}</dd>
            </div>
            <div>
              <dt>Hora registro</dt>
              <dd>{formatMadridTime(entry.createdAt)}</dd>
            </div>
            <div>
              <dt>Generado</dt>
              <dd>{formatMadridDateTime(entry.createdAt)}</dd>
            </div>
            <div>
              <dt>Registrado por</dt>
              <dd>{entry.user.name ?? entry.user.email}</dd>
            </div>
          </dl>
        </header>

        <section className="inventory-delivery-note-summary">
          <article className="metric-card">
            <p className="card-label">Líneas</p>
            <strong>{entry.lines.length}</strong>
          </article>
          <article className="metric-card">
            <p className="card-label">Unidades</p>
            <strong>{totalUnits}</strong>
          </article>
          <article className="metric-card metric-card-soft">
            <p className="card-label">Coste total</p>
            <strong>{formatMoney(totalCost)}</strong>
          </article>
          <article className="metric-card">
            <p className="card-label">Adjuntos</p>
            <strong>{entry.attachmentUrls.length}</strong>
          </article>
        </section>

        {entry.notes ? (
          <section className="inventory-delivery-note-notes">
            <p className="card-label">Notas</p>
            <p>{entry.notes}</p>
          </section>
        ) : null}

        <div className="inventory-delivery-note-table-wrap">
          <table className="inventory-delivery-note-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Código</th>
                <th>Cantidad</th>
                <th>Coste unitario</th>
                <th>Total línea</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.product.name}</td>
                  <td>{line.product.code}</td>
                  <td>{line.quantity}</td>
                  <td>{formatMoney(line.unitCost)}</td>
                  <td>{formatMoney(line.quantity * Number(line.unitCost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
