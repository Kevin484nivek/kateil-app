import type { Route } from "next";
import Link from "next/link";

import { requireUserSession } from "@/lib/auth/session";
import { PeriodSelector } from "@/components/ui/period-selector";
import { prisma } from "@/lib/db/prisma";
import { requireModuleAccess } from "@/lib/platform/modules";
import { getPaymentMethodLabel } from "@/lib/ui/labels";
import { tokenizeSearchQuery } from "@/lib/utils/search";
import { APP_TIME_ZONE, formatMadridDateTime } from "@/lib/utils/datetime";

type SalesHistoryPageProps = {
  searchParams?: Promise<{
    page?: string;
    mode?: string;
    q?: string;
    year?: string;
    month?: string;
  }>;
};

const PAGE_SIZE = 50;
type SalesHistoryPeriodMode = "month" | "year";

function formatCurrency(value: string | number | { toString(): string }) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value.toString()));
}

function getCurrentPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function getPeriodMode(value: string | undefined): SalesHistoryPeriodMode {
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

function buildSalesHistoryHref({
  mode,
  month,
  page,
  q,
  year,
}: {
  mode: SalesHistoryPeriodMode;
  month: number;
  page?: number;
  q?: string;
  year: number;
}) {
  const params = new URLSearchParams();

  if (mode !== "month") {
    params.set("mode", mode);
  }

  params.set("year", String(year));

  if (mode !== "year") {
    params.set("month", String(month));
  }

  if (q?.trim()) {
    params.set("q", q.trim());
  }

  if (page && page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return (query ? `/sales/history?${query}` : "/sales/history") as Route;
}

function SalesHistoryPeriodTabs({
  currentMode,
  month,
  q,
  year,
}: {
  currentMode: SalesHistoryPeriodMode;
  month: number;
  q?: string;
  year: number;
}) {
  const tabs: Array<{ label: string; mode: SalesHistoryPeriodMode }> = [
    { label: "Mes", mode: "month" },
    { label: "Año", mode: "year" },
  ];

  return (
    <div className="module-chip-row dashboard-period-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.mode}
          href={buildSalesHistoryHref({
            mode: tab.mode,
            month,
            q,
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

function SalesHistoryYearTabs({
  currentMode,
  month,
  q,
  selectedYear,
  years,
}: {
  currentMode: SalesHistoryPeriodMode;
  month: number;
  q?: string;
  selectedYear: number;
  years: number[];
}) {
  return (
    <div className="module-chip-row dashboard-period-tabs">
      {years.map((year) => (
        <Link
          key={year}
          href={buildSalesHistoryHref({
            mode: currentMode,
            month,
            q,
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

function SalesHistoryMonthTabs({
  selectedMonth,
  q,
  selectedYear,
}: {
  selectedMonth: number;
  q?: string;
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
            href={buildSalesHistoryHref({
              mode: "month",
              month,
              q,
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

export default async function SalesHistoryPage({ searchParams }: SalesHistoryPageProps) {
  const session = await requireUserSession();
  await requireModuleAccess(session, "SALES_CORE");

  const resolvedSearchParams = await searchParams;
  const currentPageRequest = getCurrentPage(resolvedSearchParams?.page);
  const currentMode = getPeriodMode(resolvedSearchParams?.mode);
  const query = resolvedSearchParams?.q?.trim() ?? "";
  const searchTokens = tokenizeSearchQuery(query);
  const earliestSale = await prisma.sale.findFirst({
    select: { date: true },
    orderBy: { date: "asc" },
  });
  const latestSale = await prisma.sale.findFirst({
    select: { date: true },
    orderBy: { date: "desc" },
  });

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

  const periodWhere = {
    date: {
      gte: periodBounds.start,
      lt: periodBounds.end,
    },
    ...(searchTokens.length > 0
      ? {
          AND: searchTokens.map((token) => ({
            OR: [
              { saleNumber: { contains: token, mode: "insensitive" as const } },
              { customer: { name: { contains: token, mode: "insensitive" as const } } },
              {
                lines: {
                  some: {
                    OR: [
                      { product: { code: { contains: token, mode: "insensitive" as const } } },
                      { product: { name: { contains: token, mode: "insensitive" as const } } },
                      {
                        product: {
                          description: { contains: token, mode: "insensitive" as const },
                        },
                      },
                      {
                        product: {
                          supplier: { name: { contains: token, mode: "insensitive" as const } },
                        },
                      },
                    ],
                  },
                },
              },
              {
                returnLines: {
                  some: {
                    OR: [
                      { product: { code: { contains: token, mode: "insensitive" as const } } },
                      { product: { name: { contains: token, mode: "insensitive" as const } } },
                      {
                        product: {
                          supplier: { name: { contains: token, mode: "insensitive" as const } },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          })),
        }
      : {}),
  };

  const startYear = earliestSale?.date.getFullYear() ?? selectedYear;
  const endYear = latestSale?.date.getFullYear() ?? selectedYear;
  const availableYears = Array.from(
    { length: Math.max(endYear - startYear + 1, 1) },
    (_, index) => endYear - index,
  );

  const totalSales = await prisma.sale.count({ where: periodWhere });
  const totalPages = Math.max(1, Math.ceil(totalSales / PAGE_SIZE));
  const currentPage = Math.min(currentPageRequest, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const sales = await prisma.sale.findMany({
    where: periodWhere,
    include: {
      customer: true,
      originalSale: {
        select: {
          saleNumber: true,
        },
      },
      _count: {
        select: {
          lines: true,
          returnLines: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
  });

  const periodLabel =
    currentMode === "year"
      ? new Intl.DateTimeFormat("es-ES", { year: "numeric", timeZone: APP_TIME_ZONE }).format(periodReferenceDate)
      : new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: APP_TIME_ZONE }).format(periodReferenceDate);

  const periodSummary =
    currentMode === "year"
      ? `Ventas registradas durante ${periodLabel}.`
      : `Ventas registradas durante ${periodLabel}. Cambia el mes o el año para revisar cualquier tramo del historico.`;

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Ventas</p>
          <h1>Histórico</h1>
          <p className="lede">{periodSummary}</p>
        </div>
        <span className="module-meta">
          {totalSales} ventas · página {currentPage} de {totalPages}
        </span>
      </div>

      <article className="panel">
        <PeriodSelector
          action="/sales/history"
          hiddenFields={{ q: query }}
          mode={currentMode}
          month={selectedMonth}
          monthHref={buildSalesHistoryHref({
            mode: "month",
            month: selectedMonth,
            q: query,
            year: selectedYear,
          })}
          year={selectedYear}
          yearHref={buildSalesHistoryHref({
            mode: "year",
            month: selectedMonth,
            q: query,
            year: selectedYear,
          })}
          years={availableYears}
        />
        <form method="get" className="supplier-search">
          <input type="hidden" name="mode" value={currentMode} />
          <input type="hidden" name="year" value={String(selectedYear)} />
          {currentMode === "month" ? (
            <input type="hidden" name="month" value={String(selectedMonth)} />
          ) : null}
          <input
            name="q"
            defaultValue={query}
            placeholder="Venta, clienta, producto, código o proveedor..."
          />
          <button className="button button-secondary" type="submit">
            Buscar
          </button>
        </form>
        <div className="active-filter-row" aria-label="Filtros activos">
          <span className="active-filter-label">Filtros activos</span>
          <span className="active-filter-chip">Periodo: {periodLabel}</span>
          {query ? <span className="active-filter-chip">Búsqueda: {query}</span> : null}
        </div>
        <p className="card-label">Ventas registradas</p>
        {totalSales > 0 ? (
          <div className="pagination-bar">
            <p className="pagination-meta">
              Mostrando {skip + 1}-{Math.min(skip + sales.length, totalSales)} de {totalSales} ventas
            </p>
            <div className="hero-actions">
              <Link
                href={buildSalesHistoryHref({
                  mode: currentMode,
                  month: selectedMonth,
                  page: Math.max(1, currentPage - 1),
                  q: query,
                  year: selectedYear,
                })}
                className="button button-secondary"
                aria-disabled={currentPage === 1}
              >
                Anterior
              </Link>
              <Link
                href={buildSalesHistoryHref({
                  mode: currentMode,
                  month: selectedMonth,
                  page: Math.min(totalPages, currentPage + 1),
                  q: query,
                  year: selectedYear,
                })}
                className="button button-secondary"
                aria-disabled={currentPage === totalPages}
              >
                Siguiente
              </Link>
            </div>
          </div>
        ) : null}
        {sales.length === 0 ? (
          <p>Aún no hay ventas registradas. La primera venta aparecerá aquí en cuanto se confirme.</p>
        ) : (
          <div className="entity-list">
            {sales.map((sale) => (
              <article key={sale.id} className="entity-card">
                <div className="entity-card-header">
                  <div>
                    <h3>{sale.saleNumber}</h3>
                    <p>
                      {formatMadridDateTime(sale.date)} · {getPaymentMethodLabel(sale.paymentMethod)} ·{" "}
                      {sale.customer?.name || "Sin cliente"}
                    </p>
                    {sale.saleKind === "RETURN_EXCHANGE" ? (
                      <p>
                        Cambio/devolución{sale.originalSale ? ` · Origen ${sale.originalSale.saleNumber}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <span className="status-pill status-active">
                    {formatCurrency(sale.totalAmount)}
                  </span>
                </div>
                <p className="entity-notes">
                  {sale._count.lines} líneas nuevas · {sale._count.returnLines} líneas devueltas
                </p>
                <Link
                  href={
                    `/sales/history/${sale.id}?${new URLSearchParams({
                      mode: currentMode,
                      month: String(selectedMonth),
                      page: String(currentPage),
                      ...(query ? { q: query } : {}),
                      year: String(selectedYear),
                    }).toString()}` as Route
                  }
                  className="button button-secondary"
                >
                  Ver detalle
                </Link>
              </article>
            ))}
          </div>
        )}
        {totalSales > 0 ? (
          <div className="pagination-bar">
            <p className="pagination-meta">
              Página {currentPage} de {totalPages}
            </p>
            <div className="hero-actions">
              <Link
                href={buildSalesHistoryHref({
                  mode: currentMode,
                  month: selectedMonth,
                  page: Math.max(1, currentPage - 1),
                  q: query,
                  year: selectedYear,
                })}
                className="button button-secondary"
                aria-disabled={currentPage === 1}
              >
                Anterior
              </Link>
              <Link
                href={buildSalesHistoryHref({
                  mode: currentMode,
                  month: selectedMonth,
                  page: Math.min(totalPages, currentPage + 1),
                  q: query,
                  year: selectedYear,
                })}
                className="button button-secondary"
                aria-disabled={currentPage === totalPages}
              >
                Siguiente
              </Link>
            </div>
          </div>
        ) : null}
      </article>
    </section>
  );
}
