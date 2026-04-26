import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { formatMadridDate, formatMadridDateTime } from "@/lib/utils/datetime";

type PurchaseOrderDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function PurchaseOrderDetailPage({
  params,
}: PurchaseOrderDetailPageProps) {
  const { orderId } = await params;
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
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

  if (!order) {
    notFound();
  }

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Mercancía</p>
          <h1>{order.orderNumber}</h1>
          <p>
            {order.supplier.name} · {formatMadridDateTime(order.createdAt)}
          </p>
        </div>
        <Link href="/inventory-entries/history" className="button button-secondary">
          Volver al histórico
        </Link>
      </div>

      <div className="module-grid">
        <article className="panel">
          <p className="card-label">Detalle del pedido</p>
          <dl className="entity-meta">
            <div>
              <dt>Proveedor</dt>
              <dd>{order.supplier.name}</dd>
            </div>
            <div>
              <dt>Registrado por</dt>
              <dd>{order.user.email}</dd>
            </div>
            <div>
              <dt>Fecha pedido</dt>
              <dd>{formatMadridDate(order.date)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{order.status}</dd>
            </div>
          </dl>
          {order.notes ? <p className="entity-notes">{order.notes}</p> : null}
          {order.attachmentUrls.length > 0 ? (
            <div className="entity-list">
              <article className="entity-card">
                <p className="card-label">Adjuntos</p>
                <div className="entry-summary-list">
                  {order.attachmentUrls.map((attachmentUrl, index) => (
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
            {order.lines.map((line) => (
              <article key={line.id} className="entity-card">
                <div className="entity-card-header">
                  <div>
                    <h3>{line.product.name}</h3>
                    <p>{line.product.code}</p>
                  </div>
                  <span className="status-pill status-active">{line.quantity} uds</span>
                </div>
                <dl className="entity-meta">
                  <div>
                    <dt>Coste unitario</dt>
                    <dd>{line.unitCost.toString()} €</dd>
                  </div>
                  <div>
                    <dt>Total línea</dt>
                    <dd>{(Number(line.unitCost) * line.quantity).toFixed(2)} €</dd>
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
