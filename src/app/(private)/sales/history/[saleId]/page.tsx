import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUserSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireModuleAccess } from "@/lib/platform/modules";
import { getPaymentMethodLabel } from "@/lib/ui/labels";
import { formatMadridDateTime } from "@/lib/utils/datetime";

function formatCurrency(value: string | number | { toString(): string }) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value.toString()));
}

function formatNullableCurrency(value: number | null) {
  return value == null ? "No disponible" : formatCurrency(value);
}

function getLineProfitAmount(line: {
  productTypeSnapshot: "OWNED" | "CONSIGNMENT";
  quantity: number;
  storeAmount: string | number | { toString(): string };
  subtotal: string | number | { toString(): string };
  unitCostSnapshot?: string | number | { toString(): string } | null;
}) {
  if (line.productTypeSnapshot === "CONSIGNMENT") {
    return Number(line.storeAmount);
  }

  if (line.unitCostSnapshot == null) {
    return null;
  }

  return Number(line.subtotal) - Number(line.unitCostSnapshot) * line.quantity;
}

type SaleDetailPageProps = {
  params: Promise<{
    saleId: string;
  }>;
  searchParams?: Promise<{
    backHref?: string;
    backLabel?: string;
    created?: string;
    mode?: string;
    month?: string;
    page?: string;
    q?: string;
    year?: string;
  }>;
};

export default async function SaleDetailPage({ params, searchParams }: SaleDetailPageProps) {
  const session = await requireUserSession();
  await requireModuleAccess(session, "SALES_CORE");

  const { saleId } = await params;
  const query = await searchParams;
  const backParams = new URLSearchParams();

  if (query?.mode === "year") {
    backParams.set("mode", "year");
  }

  if (query?.year) {
    backParams.set("year", query.year);
  }

  if (query?.mode !== "year" && query?.month) {
    backParams.set("month", query.month);
  }

  if (query?.q) {
    backParams.set("q", query.q);
  }

  if (query?.page && query.page !== "1") {
    backParams.set("page", query.page);
  }

  const backHref = (backParams.toString()
    ? `/sales/history?${backParams.toString()}`
    : "/sales/history") as Route;
  const backLabel = query?.backLabel ?? "Volver al histórico";

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: true,
      originalSale: {
        select: {
          id: true,
          saleNumber: true,
        },
      },
      user: true,
      lines: {
        include: {
          product: {
            include: {
              supplier: true,
            },
          },
        },
      },
      returnLines: {
        include: {
          product: true,
          originalSaleLine: true,
        },
      },
    },
  });

  if (!sale) {
    notFound();
  }

  const totalSupplierAmount = sale.lines.reduce(
    (sum, line) => sum + Number(line.supplierAmount),
    0,
  );
  const lineProfitAmounts = sale.lines.map((line) => getLineProfitAmount(line));
  const totalCalculatedProfit = lineProfitAmounts.every((amount) => amount != null)
    ? lineProfitAmounts.reduce((sum, amount) => sum + (amount ?? 0), 0)
    : null;

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Detalle de venta</p>
          <h1>{sale.saleNumber}</h1>
        </div>
        <Link href={backHref} className="button button-secondary">
          {backLabel}
        </Link>
      </div>

      {query?.created === "1" ? (
        <article className="panel panel-success">
          <p className="card-label">Venta confirmada</p>
          <p>La venta se ha registrado correctamente y el stock ya ha sido actualizado.</p>
        </article>
      ) : null}

      <div className="module-grid">
        <article className="panel">
          <p className="card-label">Cabecera</p>
          <dl className="entity-meta">
            <div>
              <dt>Fecha</dt>
              <dd>{formatMadridDateTime(sale.date)}</dd>
            </div>
            <div>
              <dt>Pago</dt>
              <dd>{getPaymentMethodLabel(sale.paymentMethod)}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{sale.saleKind === "RETURN_EXCHANGE" ? "Devolución / cambio" : "Venta normal"}</dd>
            </div>
            <div>
              <dt>Cliente</dt>
              <dd>{sale.customer?.name || "Venta sin cliente"}</dd>
            </div>
            <div>
              <dt>Usuario</dt>
              <dd>{sale.user.email}</dd>
            </div>
            <div>
              <dt>Ticket origen</dt>
              <dd>
                {sale.originalSale ? (
                  <Link href={`/sales/history/${sale.originalSale.id}` as Route} className="text-link">
                    {sale.originalSale.saleNumber}
                  </Link>
                ) : (
                  "No aplica"
                )}
              </dd>
            </div>
          </dl>
          {sale.notes ? <p className="entity-notes">{sale.notes}</p> : null}
        </article>

        <article className="panel panel-accent">
          <p className="card-label">Resumen</p>
          <dl className="entity-meta">
            <div>
              <dt>Total venta (líneas nuevas)</dt>
              <dd>{formatCurrency(sale.saleItemsTotalAmount)}</dd>
            </div>
            <div>
              <dt>Total devolución</dt>
              <dd>{formatCurrency(sale.returnTotalAmount)}</dd>
            </div>
            <div>
              <dt>Saldo neto</dt>
              <dd>{formatCurrency(sale.totalAmount)}</dd>
            </div>
            <div>
              <dt>Margen / comisión tienda</dt>
              <dd>{formatNullableCurrency(totalCalculatedProfit)}</dd>
            </div>
            <div>
              <dt>Importe proveedor</dt>
              <dd>{formatCurrency(totalSupplierAmount)}</dd>
            </div>
            <div>
              <dt>Líneas</dt>
              <dd>{sale.lines.length}</dd>
            </div>
            <div>
              <dt>Líneas devueltas</dt>
              <dd>{sale.returnLines.length}</dd>
            </div>
          </dl>
        </article>
      </div>

      <article className="panel">
        <p className="card-label">Líneas</p>
        <div className="movements-table">
          <div className="movements-row movements-row-head">
            <span>Producto</span>
            <span>Proveedor</span>
            <span>Cantidad</span>
            <span>Precio venta</span>
            <span>Subtotal</span>
            <span>Coste unit.</span>
            <span>Margen / comisión</span>
          </div>
          {sale.lines.map((line) => {
            const lineProfitAmount = getLineProfitAmount(line);

            return (
              <div key={line.id} className="movements-row">
                <span>
                  <Link
                    href={
                      `/products?${new URLSearchParams({
                        backToSaleHref: `/sales/history/${sale.id}?${new URLSearchParams({
                          ...(query?.created === "1" ? { created: "1" } : {}),
                          ...(query?.mode ? { mode: query.mode } : {}),
                          ...(query?.month ? { month: query.month } : {}),
                          ...(query?.page ? { page: query.page } : {}),
                          ...(query?.q ? { q: query.q } : {}),
                          ...(query?.year ? { year: query.year } : {}),
                          backHref,
                          backLabel: "Volver al histórico",
                        }).toString()}`,
                        backToSaleLabel: `Volver a ${sale.saleNumber}`,
                        q: line.product.code,
                      }).toString()}` as Route
                    }
                    className="text-link"
                  >
                    {line.product.name}
                  </Link>
                </span>
                <span>{line.product.supplier.name}</span>
                <span>{line.quantity}</span>
                <span>{formatCurrency(line.soldUnitPrice)}</span>
                <span>{formatCurrency(line.subtotal)}</span>
                <span>
                  {line.unitCostSnapshot != null ? formatCurrency(line.unitCostSnapshot) : "Sin coste"}
                </span>
                <span>{formatNullableCurrency(lineProfitAmount)}</span>
              </div>
            );
          })}
        </div>
      </article>

      {sale.returnLines.length > 0 ? (
        <article className="panel">
          <p className="card-label">Líneas devueltas</p>
          <div className="movements-table">
            <div className="movements-row movements-row-head">
              <span>Producto</span>
              <span>Cantidad</span>
              <span>Precio devolución</span>
              <span>Subtotal devolución</span>
            </div>
            {sale.returnLines.map((line) => (
              <div key={line.id} className="movements-row">
                <span>
                  {line.product.code} · {line.product.name}
                </span>
                <span>{line.quantity}</span>
                <span>{formatCurrency(line.refundedUnitPrice)}</span>
                <span>{formatCurrency(line.subtotal)}</span>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}
