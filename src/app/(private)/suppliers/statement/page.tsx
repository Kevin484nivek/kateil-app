import type { Route } from "next";
import Link from "next/link";

import { PeriodSelector } from "@/components/ui/period-selector";
import { PrintButton } from "@/components/ui/print-button";
import { SupplierStatementFilters } from "@/components/ui/supplier-statement-filters";
import { prisma } from "@/lib/db/prisma";
import { getConsignmentSettlementModeLabel } from "@/lib/ui/labels";
import { APP_TIME_ZONE, formatMadridDate, formatMadridDateTime } from "@/lib/utils/datetime";
import { ConsignmentSettlementMode } from "@prisma/client";

type SupplierStatementPageProps = {
  searchParams?: Promise<{
    supplierId?: string;
    mode?: string;
    year?: string;
    month?: string;
  }>;
};

type StatementPeriodMode = "month" | "year";

function formatCurrency(value: string | number | { toString(): string }) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value.toString()));
}

function formatCount(value: number) {
  return new Intl.NumberFormat("es-ES").format(value);
}

function getSettlementCellLabel({
  defaultStoreCommissionPct,
  lineStoreCommissionPct,
  settlementMode,
}: {
  defaultStoreCommissionPct: { toString(): string } | null;
  lineStoreCommissionPct: { toString(): string } | null;
  settlementMode: ConsignmentSettlementMode;
}) {
  if (settlementMode === ConsignmentSettlementMode.FIXED_COST) {
    return getConsignmentSettlementModeLabel(settlementMode);
  }

  if (lineStoreCommissionPct != null) {
    return `${Number(lineStoreCommissionPct).toFixed(2)}%`;
  }

  if (defaultStoreCommissionPct != null) {
    return `${Number(defaultStoreCommissionPct).toFixed(2)}%`;
  }

  return "—";
}

function getPeriodMode(value: string | undefined): StatementPeriodMode {
  return value === "year" ? "year" : "month";
}

function getIntegerParam(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function getMonthBounds(referenceDate: Date) {
  return {
    start: new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1),
    end: new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1),
  };
}

function getYearBounds(referenceDate: Date) {
  return {
    start: new Date(referenceDate.getFullYear(), 0, 1),
    end: new Date(referenceDate.getFullYear() + 1, 0, 1),
  };
}

function buildStatementHref({
  supplierId,
  mode,
  month,
  year,
}: {
  supplierId?: string;
  mode: StatementPeriodMode;
  month?: number;
  year?: number;
}) {
  const params = new URLSearchParams();

  if (supplierId) {
    params.set("supplierId", supplierId);
  }

  if (mode !== "month") {
    params.set("mode", mode);
  }

  if (year != null) {
    params.set("year", String(year));
  }

  if (mode !== "year" && month != null) {
    params.set("month", String(month));
  }

  const query = params.toString();
  return (query ? `/suppliers/statement?${query}` : "/suppliers/statement") as Route;
}

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function StatementPeriodTabs({
  currentMode,
  supplierId,
  month,
  year,
}: {
  currentMode: StatementPeriodMode;
  supplierId?: string;
  month: number;
  year: number;
}) {
  const tabs: Array<{ label: string; mode: StatementPeriodMode }> = [
    { label: "Mes", mode: "month" },
    { label: "Año", mode: "year" },
  ];

  return (
    <div className="module-chip-row dashboard-period-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.mode}
          href={buildStatementHref({
            supplierId,
            mode: tab.mode,
            month,
            year,
          })}
          className={`button ${currentMode === tab.mode ? "button-primary" : "button-secondary"}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function StatementYearTabs({
  currentMode,
  supplierId,
  month,
  selectedYear,
  years,
}: {
  currentMode: StatementPeriodMode;
  supplierId?: string;
  month: number;
  selectedYear: number;
  years: number[];
}) {
  return (
    <div className="module-chip-row dashboard-period-tabs">
      {years.map((year) => (
        <Link
          key={year}
          href={buildStatementHref({
            supplierId,
            mode: currentMode,
            month,
            year,
          })}
          className={`button ${selectedYear === year ? "button-primary" : "button-secondary"}`}
        >
          {year}
        </Link>
      ))}
    </div>
  );
}

function StatementMonthTabs({
  supplierId,
  selectedMonth,
  selectedYear,
}: {
  supplierId?: string;
  selectedMonth: number;
  selectedYear: number;
}) {
  const monthLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  return (
    <div className="module-chip-row dashboard-period-tabs">
      {monthLabels.map((label, index) => {
        const month = index + 1;

        return (
          <Link
            key={label}
            href={buildStatementHref({
              supplierId,
              mode: "month",
              month,
              year: selectedYear,
            })}
            className={`button ${selectedMonth === month ? "button-primary" : "button-secondary"}`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function SupplierStatementPage({ searchParams }: SupplierStatementPageProps) {
  const resolvedSearchParams = await searchParams;
  const selectedSupplierId = resolvedSearchParams?.supplierId?.trim() || "";
  const currentMode = getPeriodMode(resolvedSearchParams?.mode);

  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      supplierCode: true,
      defaultStoreCommissionPct: true,
      consignmentSettlementMode: true,
    },
  });

  const selectedSupplier =
    suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null;

  const [earliestSale, latestSale] = selectedSupplier
    ? await Promise.all([
        prisma.sale.findFirst({
          select: { date: true },
          where: {
            lines: {
              some: {
                product: {
                  supplierId: selectedSupplier.id,
                },
              },
            },
          },
          orderBy: { date: "asc" },
        }),
        prisma.sale.findFirst({
          select: { date: true },
          where: {
            lines: {
              some: {
                product: {
                  supplierId: selectedSupplier.id,
                },
              },
            },
          },
          orderBy: { date: "desc" },
        }),
      ])
    : [null, null];

  const now = new Date();
  const defaultReferenceDate = latestSale?.date ?? now;
  const parsedYear = getIntegerParam(resolvedSearchParams?.year);
  const parsedMonth = getIntegerParam(resolvedSearchParams?.month);
  const selectedYear = parsedYear ?? defaultReferenceDate.getFullYear();
  const selectedMonth =
    parsedMonth && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : defaultReferenceDate.getMonth() + 1;

  const periodReferenceDate =
    currentMode === "year"
      ? new Date(selectedYear, 0, 1)
      : new Date(selectedYear, selectedMonth - 1, 1);

  const periodBounds =
    currentMode === "year"
      ? getYearBounds(periodReferenceDate)
      : getMonthBounds(periodReferenceDate);

  const startYear = earliestSale?.date.getFullYear() ?? selectedYear;
  const endYear = latestSale?.date.getFullYear() ?? selectedYear;
  const availableYears = Array.from(
    { length: Math.max(endYear - startYear + 1, 1) },
    (_, index) => endYear - index,
  );

  const saleLines = selectedSupplier
    ? await prisma.saleLine.findMany({
        where: {
          product: {
            supplierId: selectedSupplier.id,
          },
          sale: {
            date: {
              gte: periodBounds.start,
              lt: periodBounds.end,
            },
          },
        },
        include: {
          product: true,
          sale: true,
        },
        orderBy: [{ sale: { date: "asc" } }, { product: { name: "asc" } }],
      })
    : [];

  const unitsSold = saleLines.reduce((sum, line) => sum + line.quantity, 0);
  const totalSoldAmount = saleLines.reduce((sum, line) => sum + Number(line.subtotal), 0);
  const totalStoreAmount = saleLines.reduce((sum, line) => sum + Number(line.storeAmount), 0);
  const totalSupplierAmount = saleLines.reduce((sum, line) => sum + Number(line.supplierAmount), 0);

  const periodLabel =
    currentMode === "year"
      ? new Intl.DateTimeFormat("es-ES", { year: "numeric", timeZone: APP_TIME_ZONE }).format(periodReferenceDate)
      : new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: APP_TIME_ZONE }).format(periodReferenceDate);

  const generatedAt = formatMadridDateTime(new Date(), {
    dateStyle: "long",
    timeStyle: "short",
  });
  const printFilename = selectedSupplier
    ? `liquidacion-${selectedSupplier.supplierCode ? selectedSupplier.supplierCode.toLowerCase() : toSlug(selectedSupplier.name)}-${
        currentMode === "year"
          ? String(selectedYear)
          : `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`
      }`
    : undefined;

  return (
    <section className="module-page">
      <div className="module-header print-hidden">
        <div>
          <p className="eyebrow">Proveedores</p>
          <h1>Justificante de liquidación</h1>
          <p className="lede">
            Selecciona proveedor y periodo para generar una vista imprimible con las ventas
            y el importe pendiente de liquidación.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/suppliers" className="button button-secondary">
            Volver a proveedores
          </Link>
          {selectedSupplier ? <PrintButton filename={printFilename} /> : null}
        </div>
      </div>

      <article className="panel print-hidden">
        <SupplierStatementFilters
          suppliers={suppliers}
          selectedSupplierId={selectedSupplierId}
          mode={currentMode}
          year={selectedYear}
          month={selectedMonth}
        />

        {selectedSupplier ? (
          <PeriodSelector
            action="/suppliers/statement"
            hiddenFields={{ supplierId: selectedSupplier.id }}
            mode={currentMode}
            month={selectedMonth}
            monthHref={buildStatementHref({
              supplierId: selectedSupplier.id,
              mode: "month",
              month: selectedMonth,
              year: selectedYear,
            })}
            year={selectedYear}
            yearHref={buildStatementHref({
              supplierId: selectedSupplier.id,
              mode: "year",
              month: selectedMonth,
              year: selectedYear,
            })}
            years={availableYears}
          />
        ) : null}
      </article>

      {!selectedSupplier ? (
        <article className="panel panel-accent">
          <p className="card-label">Siguiente paso</p>
          <p>Elige un proveedor para preparar su justificante imprimible.</p>
        </article>
      ) : (
        <article className="supplier-statement-paper">
          <div className="supplier-statement-header">
            <div>
              <p className="eyebrow">Kateil</p>
              <h2>Justificante de liquidación</h2>
              <p className="supplier-statement-subtitle">Arte en movimiento</p>
            </div>
            <div className="supplier-statement-meta">
              <div>
                <dt>Proveedor</dt>
                <dd>
                  {selectedSupplier.name}
                  {selectedSupplier.supplierCode ? ` · ${selectedSupplier.supplierCode}` : ""}
                </dd>
              </div>
              <div>
                <dt>Periodo</dt>
                <dd>{periodLabel}</dd>
              </div>
              <div>
                <dt>Generado</dt>
                <dd>{generatedAt}</dd>
              </div>
            </div>
          </div>

          <div className="supplier-statement-summary">
            <article className="metric-card">
              <p className="card-label">Unidades vendidas</p>
              <strong>{formatCount(unitsSold)}</strong>
            </article>
            <article className="metric-card">
              <p className="card-label">Importe vendido</p>
              <strong>{formatCurrency(totalSoldAmount)}</strong>
            </article>
            <article className="metric-card">
              <p className="card-label">
                {selectedSupplier.consignmentSettlementMode === ConsignmentSettlementMode.FIXED_COST
                  ? "Margen tienda"
                  : "Comisión tienda"}
              </p>
              <strong>{formatCurrency(totalStoreAmount)}</strong>
            </article>
            <article className="metric-card metric-card-soft">
              <p className="card-label">Pendiente proveedor</p>
              <strong>{formatCurrency(totalSupplierAmount)}</strong>
            </article>
          </div>

          <div className="supplier-statement-table-wrap">
            {saleLines.length === 0 ? (
              <div className="supplier-statement-empty">
                No hay ventas registradas para este proveedor en el periodo seleccionado.
              </div>
            ) : (
              <table className="supplier-statement-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Venta</th>
                    <th scope="col">Producto</th>
                    <th scope="col">Código</th>
                    <th scope="col">Cant.</th>
                    <th scope="col">Precio</th>
                    <th scope="col">Subtotal</th>
                    <th scope="col">Liquidación</th>
                    <th scope="col">Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {saleLines.map((line) => (
                    <tr key={line.id}>
                      <td>{formatMadridDate(line.sale.date)}</td>
                      <td>{line.sale.saleNumber}</td>
                      <td>{line.product.name}</td>
                      <td>{line.product.code}</td>
                      <td>{line.quantity}</td>
                      <td>{formatCurrency(line.soldUnitPrice)}</td>
                      <td>{formatCurrency(line.subtotal)}</td>
                      <td>
                        {getSettlementCellLabel({
                          defaultStoreCommissionPct: selectedSupplier.defaultStoreCommissionPct,
                          lineStoreCommissionPct: line.storeCommissionPctSnapshot,
                          settlementMode: selectedSupplier.consignmentSettlementMode,
                        })}
                      </td>
                      <td>{formatCurrency(line.supplierAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>
      )}
    </section>
  );
}
