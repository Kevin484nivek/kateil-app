import type { Route } from "next";
import { ExpenseEntryKind } from "@prisma/client";
import Link from "next/link";

import { PeriodSelector } from "@/components/ui/period-selector";
import { prisma } from "@/lib/db/prisma";
import { getPaymentMethodLabel } from "@/lib/ui/labels";
import { APP_TIME_ZONE, formatMadridDate, formatMadridDateTime } from "@/lib/utils/datetime";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("es-ES").format(value);
}

function toNumber(value: { toString(): string } | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : Number(value.toString());
}

function getLineProfitAmount(line: {
  productTypeSnapshot: "OWNED" | "CONSIGNMENT";
  quantity: number;
  storeAmount: { toString(): string } | number | null | undefined;
  subtotal: { toString(): string } | number | null | undefined;
  unitCostSnapshot?: { toString(): string } | number | null | undefined;
}) {
  if (line.productTypeSnapshot === "CONSIGNMENT") {
    return toNumber(line.storeAmount);
  }

  if (line.unitCostSnapshot == null) {
    return 0;
  }

  return Number(
    (toNumber(line.subtotal) - toNumber(line.unitCostSnapshot) * line.quantity).toFixed(2),
  );
}

const RELIABLE_PROFIT_START = new Date(2026, 0, 1);

function getPeriodBounds(now: Date) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return { monthStart, nextMonthStart, todayStart, tomorrowStart };
}

type RankedRow = {
  label: string;
  secondary?: string;
  amount: number;
  units?: number;
};

type MetricCardItem = {
  label: string;
  value: string;
  tone: "base" | "soft";
  help?: string;
};

type DashboardView = "general" | "sales" | "suppliers" | "operations";
type DashboardPeriodMode = "month" | "year";

type DashboardPageProps = {
  searchParams?: Promise<{
    view?: string;
    mode?: string;
    year?: string;
    month?: string;
  }>;
};

function getDashboardPeriodMode(mode: string | undefined): DashboardPeriodMode {
  return mode === "year" ? "year" : "month";
}

function getIntegerParam(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function getMonthBounds(referenceDate: Date) {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const nextMonthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);

  return {
    start: monthStart,
    end: nextMonthStart,
  };
}

function getYearBounds(referenceDate: Date) {
  const yearStart = new Date(referenceDate.getFullYear(), 0, 1);
  const nextYearStart = new Date(referenceDate.getFullYear() + 1, 0, 1);

  return {
    start: yearStart,
    end: nextYearStart,
  };
}

function getMadridDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: APP_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    day: Number(valueByType.get("day")),
    month: Number(valueByType.get("month")),
    year: Number(valueByType.get("year")),
  };
}

function getMadridTodayBounds(now: Date) {
  const { day, month, year } = getMadridDateParts(now);
  const todayStart = new Date(year, month - 1, day);

  return {
    start: todayStart,
    end: new Date(year, month - 1, day + 1),
  };
}

function getMadridWorkWeekBounds(now: Date) {
  const { day, month, year } = getMadridDateParts(now);
  const todayStart = new Date(year, month - 1, day);
  const dayOfWeek = todayStart.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayStart = new Date(year, month - 1, day + mondayOffset);

  return {
    start: mondayStart,
    end: new Date(
      mondayStart.getFullYear(),
      mondayStart.getMonth(),
      mondayStart.getDate() + 5,
    ),
  };
}

function buildDashboardHref({
  month,
  mode,
  view,
  year,
}: {
  month?: number;
  mode?: DashboardPeriodMode;
  view?: DashboardView;
  year?: number;
}) {
  const params = new URLSearchParams();

  if (view && view !== "general") {
    params.set("view", view);
  }

  if (mode && mode !== "month") {
    params.set("mode", mode);
  }

  if (year != null) {
    params.set("year", String(year));
  }

  if (mode !== "year" && month != null) {
    params.set("month", String(month));
  }

  const query = params.toString();
  return (query ? `/dashboard?${query}` : "/dashboard") as Route;
}

function getDashboardView(view: string | undefined): DashboardView {
  switch (view) {
    case "sales":
      return "sales";
    case "suppliers":
      return "suppliers";
    case "operations":
      return "operations";
    default:
      return "general";
  }
}

function getViewMeta(view: DashboardView) {
  if (view === "sales") {
    return {
      eyebrow: "Ventas",
      title: "Rendimiento comercial",
      description:
        "Detalle de tickets, descuentos, métodos de pago y evolución reciente para leer el pulso comercial del negocio.",
    };
  }

  if (view === "suppliers") {
    return {
      eyebrow: "Proveedor",
      title: "Marcas y proveedores",
      description:
        "Seguimiento del peso comercial, margen tienda y saldo pendiente para entender qué marcas están tirando del negocio.",
    };
  }

  if (view === "operations") {
    return {
      eyebrow: "Operativa",
      title: "Control operativo diario",
      description:
        "Stock, entradas, pedidos y movimientos recientes para tener una vista rápida de la actividad interna y las alertas.",
    };
  }

  return {
    eyebrow: "Dashboard",
    title: "Vista general del negocio",
    description:
      "KPIs y analítica comercial del periodo seleccionado para controlar ventas, márgenes y rendimiento de producto desde una sola pantalla.",
  };
}

function DashboardTabs({ currentView }: { currentView: DashboardView }) {
  const tabs: Array<{ label: string; view: DashboardView }> = [
    { label: "General", view: "general" },
    { label: "Ventas", view: "sales" },
    { label: "Proveedor", view: "suppliers" },
    { label: "Operativa", view: "operations" },
  ];

  return (
    <div className="module-chip-row dashboard-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.view}
          href={
            (tab.view === "general" ? "/dashboard" : `/dashboard?view=${tab.view}`) as Route
          }
          className={`button ${currentView === tab.view ? "button-primary" : "button-secondary"}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function DashboardPeriodTabs({
  currentMode,
  currentView,
  month,
  year,
}: {
  currentMode: DashboardPeriodMode;
  currentView: DashboardView;
  month: number;
  year: number;
}) {
  const tabs: Array<{ label: string; mode: DashboardPeriodMode }> = [
    { label: "Mes", mode: "month" },
    { label: "Año", mode: "year" },
  ];

  return (
    <div className="module-chip-row dashboard-period-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.mode}
          href={buildDashboardHref({
            mode: tab.mode,
            month,
            view: currentView,
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

function DashboardYearTabs({
  currentMode,
  currentView,
  month,
  selectedYear,
  years,
}: {
  currentMode: DashboardPeriodMode;
  currentView: DashboardView;
  month: number;
  selectedYear: number;
  years: number[];
}) {
  return (
    <div className="module-chip-row dashboard-period-tabs">
      {years.map((year) => (
        <Link
          key={year}
          href={buildDashboardHref({
            mode: currentMode,
            month,
            view: currentView,
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

function DashboardMonthTabs({
  currentView,
  selectedMonth,
  selectedYear,
}: {
  currentView: DashboardView;
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
            href={buildDashboardHref({
              mode: "month",
              month,
              view: currentView,
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

function RankedPanel({
  empty,
  emptyLabel,
  meta,
  rows,
  title,
  tone,
}: {
  emptyLabel: string;
  empty: string;
  meta: string;
  rows: RankedRow[];
  title: string;
  tone?: "accent" | "success";
}) {
  return (
    <article className={`panel ${tone === "accent" ? "panel-accent" : tone === "success" ? "panel-success" : ""}`}>
      <div className="dashboard-panel-header">
        <div>
          <p className="card-label">{title}</p>
          <p>{emptyLabel}</p>
        </div>
        <span className="module-meta">{meta}</span>
      </div>
      {rows.length === 0 ? (
        <p className="dashboard-empty">{empty}</p>
      ) : (
        <div className="dashboard-ranked-list">
          {rows.map((row) => (
            <div key={`${row.label}-${row.secondary ?? ""}`} className="dashboard-ranked-row">
              <div>
                <strong>{row.label}</strong>
                <span>
                  {row.secondary
                    ? row.secondary
                    : row.units != null
                      ? `${formatCount(row.units)} uds`
                      : ""}
                </span>
              </div>
              <span>{formatCurrency(row.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function getSalesSnapshot(
  sales: Array<{
    lines: Array<{
      productTypeSnapshot: "OWNED" | "CONSIGNMENT";
      quantity: number;
      storeAmount: { toString(): string } | number | null | undefined;
      subtotal: { toString(): string } | number | null | undefined;
      unitCostSnapshot?: { toString(): string } | number | null | undefined;
    }>;
    totalAmount: { toString(): string } | number | null | undefined;
  }>,
) {
  const revenue = sales.reduce((sum, sale) => sum + toNumber(sale.totalAmount), 0);
  const units = sales.reduce(
    (sum, sale) => sale.lines.reduce((lineSum, line) => lineSum + line.quantity, sum),
    0,
  );
  const profit = sales.reduce(
    (sum, sale) =>
      sale.lines.reduce((lineSum, line) => lineSum + getLineProfitAmount(line), sum),
    0,
  );

  return {
    averageTicket: sales.length > 0 ? revenue / sales.length : 0,
    profit,
    revenue,
    tickets: sales.length,
    units,
  };
}

function MetricCard({ card }: { card: MetricCardItem }) {
  return (
    <article className={`metric-card ${card.tone === "soft" ? "metric-card-soft" : ""}`}>
      <div className="metric-card-label-row">
        <p className="card-label">{card.label}</p>
        {card.help ? (
          <span className="metric-card-info" title={card.help} aria-label={card.help}>
            i
          </span>
        ) : null}
      </div>
      <strong>{card.value}</strong>
    </article>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const currentView = getDashboardView(resolvedSearchParams?.view);
  const currentMode = getDashboardPeriodMode(resolvedSearchParams?.mode);
  const viewMeta = getViewMeta(currentView);
  const now = new Date();
  const todayBounds = getMadridTodayBounds(now);
  const workWeekBounds = getMadridWorkWeekBounds(now);
  const earliestSale = await prisma.sale.findFirst({
    select: {
      date: true,
    },
    orderBy: {
      date: "asc",
    },
  });
  const latestSale = await prisma.sale.findFirst({
    select: {
      date: true,
    },
    orderBy: {
      date: "desc",
    },
  });
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

  const periodLatestSale = await prisma.sale.findFirst({
    select: {
      date: true,
    },
    where: {
      date: {
        gte: periodBounds.start,
        lt: periodBounds.end,
      },
    },
    orderBy: {
      date: "desc",
    },
  });

  const referenceDay = periodLatestSale?.date ?? periodReferenceDate;
  const periodStart = periodBounds.start;
  const periodEnd = periodBounds.end;

  const startYear = earliestSale?.date.getFullYear() ?? selectedYear;
  const endYear = latestSale?.date.getFullYear() ?? selectedYear;
  const availableYears = Array.from(
    { length: Math.max(endYear - startYear + 1, 1) },
    (_, index) => endYear - index,
  );

  const [
    salesMonthCount,
    monthRevenueAggregate,
    periodFinanceAggregate,
    monthSales,
    monthTopCustomers,
    activeSuppliersCount,
    activeProductsCount,
    productsWithLowStock,
    productsWithoutStock,
    stockUnitsAggregate,
    openPurchaseOrdersCount,
    recentInventoryEntries,
    recentStockMovements,
    todaySales,
    workWeekSales,
  ] = await Promise.all([
    prisma.sale.count({
      where: {
        date: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
    }),
    prisma.sale.aggregate({
      where: {
        date: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.expense.groupBy({
      by: ["kind"],
      where:
        currentMode === "year"
          ? { year: selectedYear }
          : {
              year: selectedYear,
              month: selectedMonth,
            },
      _sum: {
        amount: true,
      },
    }),
    prisma.sale.findMany({
      where: {
        date: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
      include: {
        customer: true,
        lines: {
          include: {
            product: {
              include: {
                category: true,
                supplier: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    }),
    prisma.sale.groupBy({
      by: ["customerId"],
      where: {
        date: {
          gte: periodStart,
          lt: periodEnd,
        },
        customerId: {
          not: null,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          totalAmount: "desc",
        },
      },
      take: 5,
    }),
    prisma.supplier.count({
      where: { isActive: true },
    }),
    prisma.product.count({
      where: { isActive: true },
    }),
    prisma.product.count({
      where: {
        isActive: true,
        stockCurrent: {
          gt: 0,
          lte: 2,
        },
      },
    }),
    prisma.product.count({
      where: {
        isActive: true,
        stockCurrent: {
          lte: 0,
        },
      },
    }),
    prisma.product.aggregate({
      _sum: {
        stockCurrent: true,
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        status: "OPEN",
      },
    }),
    prisma.inventoryEntry.findMany({
      include: {
        supplier: true,
        lines: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.stockMovement.findMany({
      include: {
        product: true,
        user: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.sale.findMany({
      where: {
        date: {
          gte: todayBounds.start,
          lt: todayBounds.end,
        },
      },
      include: {
        lines: true,
      },
    }),
    prisma.sale.findMany({
      where: {
        date: {
          gte: workWeekBounds.start,
          lt: workWeekBounds.end,
        },
      },
      include: {
        lines: true,
      },
    }),
  ]);

  const customerIds = monthTopCustomers
    .map((customer) => customer.customerId)
    .filter((customerId): customerId is string => Boolean(customerId));

  const customers = customerIds.length
    ? await prisma.customer.findMany({
        where: {
          id: {
            in: customerIds,
          },
        },
      })
    : [];

  const customerMap = new Map(customers.map((customer) => [customer.id, customer.name]));

  const monthRevenue = toNumber(monthRevenueAggregate._sum.totalAmount);
  const stockUnits = stockUnitsAggregate._sum.stockCurrent ?? 0;
  const hasReliableProfit = periodStart >= RELIABLE_PROFIT_START;
  const periodExpenseAmount = periodFinanceAggregate
    .filter((entry) => entry.kind === ExpenseEntryKind.EXPENSE)
    .reduce((sum, entry) => sum + toNumber(entry._sum.amount), 0);
  const periodIncomeAmount = periodFinanceAggregate
    .filter((entry) => entry.kind === ExpenseEntryKind.INCOME)
    .reduce((sum, entry) => sum + toNumber(entry._sum.amount), 0);

  const calculatedProfitMonth = monthSales.reduce(
    (total, sale) =>
      total +
      sale.lines.reduce((saleTotal, line) => saleTotal + getLineProfitAmount(line), 0),
    0,
  );

  const supplierPendingMonth = monthSales.reduce(
    (total, sale) =>
      total +
      sale.lines.reduce((saleTotal, line) => saleTotal + toNumber(line.supplierAmount), 0),
    0,
  );

  const categoryMap = new Map<string, RankedRow>();
  const supplierMap = new Map<string, RankedRow>();
  const productMap = new Map<string, RankedRow>();
  const paymentMethodMap = new Map<string, RankedRow>();
  let unitsMonth = 0;
  let grossBeforeDiscountMonth = 0;

  for (const sale of monthSales) {
    for (const line of sale.lines) {
      const subtotal = toNumber(line.subtotal);
      const quantity = line.quantity;
      const grossLine = toNumber(line.soldUnitPrice) * quantity;
      unitsMonth += quantity;
      grossBeforeDiscountMonth += grossLine;

      const categoryName = line.product.category.name;
      const categoryRow = categoryMap.get(categoryName) ?? {
        label: categoryName,
        amount: 0,
        units: 0,
      };
      categoryRow.amount += subtotal;
      categoryRow.units = (categoryRow.units ?? 0) + quantity;
      categoryMap.set(categoryName, categoryRow);

      const supplierName = line.product.supplier.name;
      const supplierRow = supplierMap.get(supplierName) ?? {
        label: supplierName,
        amount: 0,
        units: 0,
      };
      supplierRow.amount += subtotal;
      supplierRow.units = (supplierRow.units ?? 0) + quantity;
      supplierMap.set(supplierName, supplierRow);

      const productKey = line.product.id;
      const productRow = productMap.get(productKey) ?? {
        label: line.product.name,
        secondary: `${formatCount(quantity)} uds · ${line.product.code} · ${line.product.supplier.name}`,
        amount: 0,
        units: 0,
      };
      productRow.amount += subtotal;
      productRow.units = (productRow.units ?? 0) + quantity;
      productRow.secondary = `${formatCount(productRow.units ?? 0)} uds · ${line.product.code} · ${line.product.supplier.name}`;
      productMap.set(productKey, productRow);

      const paymentKey = sale.paymentMethod;
      const paymentRow = paymentMethodMap.get(paymentKey) ?? {
        label: getPaymentMethodLabel(paymentKey),
        amount: 0,
        units: 0,
      };
      paymentRow.amount += subtotal;
      paymentRow.units = (paymentRow.units ?? 0) + 1;
      paymentMethodMap.set(paymentKey, paymentRow);
    }
  }

  const salesByCategory = Array.from(categoryMap.values())
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 6);

  const salesBySupplier = Array.from(supplierMap.values())
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 6);

  const topProducts = Array.from(productMap.values())
    .sort((left, right) => {
      if ((right.units ?? 0) !== (left.units ?? 0)) {
        return (right.units ?? 0) - (left.units ?? 0);
      }

      return right.amount - left.amount;
    })
    .slice(0, 5);

  const topCustomers = monthTopCustomers.map((customer) => ({
    label: customerMap.get(customer.customerId ?? "") ?? "Cliente sin nombre",
    secondary: `${customer._count._all} ventas`,
    amount: toNumber(customer._sum.totalAmount),
  }));

  const paymentBreakdown = Array.from(paymentMethodMap.values()).sort(
    (left, right) => right.amount - left.amount,
  );
  const todaySnapshot = getSalesSnapshot(todaySales);
  const workWeekSnapshot = getSalesSnapshot(workWeekSales);

  const averageTicketMonth = salesMonthCount > 0 ? monthRevenue / salesMonthCount : 0;
  const averageDiscountMonth =
    grossBeforeDiscountMonth > 0
      ? ((grossBeforeDiscountMonth - monthRevenue) / grossBeforeDiscountMonth) * 100
      : 0;

  const recentSales = monthSales.slice(0, 5).map((sale) => ({
    label: sale.saleNumber,
    secondary: `${getPaymentMethodLabel(sale.paymentMethod)} · ${sale.customer?.name ?? "Sin clienta"} · ${formatMadridDate(sale.date)}`,
    amount: toNumber(sale.totalAmount),
  }));

  const pendingBySupplier = Array.from(supplierMap.entries())
    .map(([supplierName]) => {
      let amount = 0;
      let units = 0;

      for (const sale of monthSales) {
        for (const line of sale.lines) {
          if (line.product.supplier.name === supplierName) {
            amount += toNumber(line.supplierAmount);
            units += line.quantity;
          }
        }
      }

      return {
        label: supplierName,
        amount,
        units,
      };
    })
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 6);

  const storeProfitBySupplier = hasReliableProfit
    ? Array.from(supplierMap.entries())
        .map(([supplierName]) => {
          let amount = 0;
          let units = 0;

          for (const sale of monthSales) {
            for (const line of sale.lines) {
              if (line.product.supplier.name === supplierName) {
                amount += getLineProfitAmount(line);
                units += line.quantity;
              }
            }
          }

          return {
            label: supplierName,
            amount,
            units,
          };
        })
        .sort((left, right) => right.amount - left.amount)
        .slice(0, 6)
    : [];

  const recentEntriesRows = recentInventoryEntries.map((entry) => ({
    label: entry.entryNumber,
    secondary: `${entry.supplier.name} · ${formatMadridDateTime(entry.createdAt)}`,
    amount: entry.lines.reduce((sum, line) => sum + line.quantity * toNumber(line.unitCost), 0),
    units: entry.lines.reduce((sum, line) => sum + line.quantity, 0),
  }));

  const recentMovementRows = recentStockMovements.map((movement) => ({
    label: movement.product.name,
    secondary: `${movement.type} · ${movement.user.email} · ${formatMadridDateTime(movement.createdAt)}`,
    amount: Math.abs(movement.quantityDelta),
  }));

  const monthLabel =
    currentMode === "year"
      ? new Intl.DateTimeFormat("es-ES", {
          year: "numeric",
          timeZone: APP_TIME_ZONE,
        }).format(periodReferenceDate)
      : new Intl.DateTimeFormat("es-ES", {
          month: "long",
          year: "numeric",
          timeZone: APP_TIME_ZONE,
        }).format(periodReferenceDate);

  const activeDayLabel = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeZone: APP_TIME_ZONE,
  }).format(referenceDay);

  const periodExplainer =
    currentMode === "year"
      ? `Resumen anual del ${monthLabel} con los datos actualmente registrados en la app.`
      : `Resumen mensual de ${monthLabel}. Cambia el mes o el año para revisar cualquier tramo del historico.`;

  const periodSalesLabel = currentMode === "year" ? "Ventas del año" : "Ventas del mes";
  const periodRevenueLabel = currentMode === "year" ? "Ingresos del año" : "Ingresos del mes";
  const periodUnitsLabel = currentMode === "year" ? "Unidades vendidas del año" : "Unidades vendidas";
  const periodTicketLabel = currentMode === "year" ? "Ticket medio anual" : "Ticket medio";
  const periodBrandSalesLabel =
    currentMode === "year" ? "Marcas con ventas en el año" : "Marcas con ventas";
  const periodTicketsLabel = currentMode === "year" ? "Tickets del año" : "Tickets del periodo";
  const grossMarginLabel =
    currentMode === "year" ? "Margen comercial del año" : "Margen comercial ventas";
  const grossMarginDisplayValue = hasReliableProfit
    ? formatCurrency(calculatedProfitMonth)
    : "No disponible";
  const netResultValue = hasReliableProfit
    ? formatCurrency(calculatedProfitMonth - periodExpenseAmount + periodIncomeAmount)
    : "No disponible";

  const generalCards: MetricCardItem[] = [
    { label: periodTicketsLabel, value: formatCount(salesMonthCount), tone: "soft" },
    { label: periodRevenueLabel, value: formatCurrency(monthRevenue), tone: "base" },
    { label: periodTicketLabel, value: formatCurrency(averageTicketMonth), tone: "soft" },
    {
      label: grossMarginLabel,
      value: grossMarginDisplayValue,
      tone: "soft",
      help: "Suma del margen comercial de ventas del periodo: en producto propio calcula venta menos coste efectivo y en consigna toma la comisión de tienda.",
    },
    { label: periodUnitsLabel, value: formatCount(unitsMonth), tone: "base" },
  ];

  const salesCards = [
    { label: periodTicketsLabel, value: formatCount(salesMonthCount), tone: "soft" },
    { label: periodRevenueLabel, value: formatCurrency(monthRevenue), tone: "base" },
    { label: periodTicketLabel, value: formatCurrency(averageTicketMonth), tone: "base" },
    { label: "Descuento medio", value: `${averageDiscountMonth.toFixed(1)}%`, tone: "soft" },
    { label: periodUnitsLabel, value: formatCount(unitsMonth), tone: "base" },
  ];

  const supplierCards = [
    { label: "Proveedores activos", value: formatCount(activeSuppliersCount), tone: "soft" },
    { label: periodRevenueLabel, value: formatCurrency(monthRevenue), tone: "base" },
    { label: grossMarginLabel, value: grossMarginDisplayValue, tone: "base" },
    { label: "Pendiente proveedor", value: formatCurrency(supplierPendingMonth), tone: "soft" },
    { label: periodBrandSalesLabel, value: formatCount(salesBySupplier.length), tone: "base" },
  ];

  const operationsCards: MetricCardItem[] = [
    { label: "Productos activos", value: formatCount(activeProductsCount), tone: "soft" },
    { label: "Unidades en stock", value: formatCount(stockUnits), tone: "base" },
    { label: "Stock bajo", value: formatCount(productsWithLowStock), tone: "base" },
    { label: "Sin stock", value: formatCount(productsWithoutStock), tone: "soft" },
    { label: "Pedidos abiertos", value: formatCount(openPurchaseOrdersCount), tone: "base" },
    {
      label: "Gastos",
      value: formatCurrency(periodExpenseAmount),
      tone: "soft",
      help: "Suma de salidas del periodo registradas en Finanzas, incluida la mercancía entrante.",
    },
    {
      label: "Ingresos",
      value: formatCurrency(periodIncomeAmount),
      tone: "base",
      help: "Suma de ingresos manuales o recurrentes registrados en Finanzas para este periodo.",
    },
    {
      label: grossMarginLabel,
      value: grossMarginDisplayValue,
      tone: "soft",
      help: "Suma del margen comercial de ventas del periodo: en producto propio calcula venta menos coste efectivo y en consigna toma la comisión de tienda.",
    },
    {
      label: "Resultado neto del periodo",
      value: netResultValue,
      tone: "base",
      help: "Margen comercial de ventas menos gastos del periodo más ingresos del periodo.",
    },
  ];
  const dailyCards: MetricCardItem[] = [
    { label: "Tickets hoy", value: formatCount(todaySnapshot.tickets), tone: "soft" },
    { label: "Venta hoy", value: formatCurrency(todaySnapshot.revenue), tone: "base" },
    { label: "Unidades hoy", value: formatCount(todaySnapshot.units), tone: "soft" },
    {
      label: "Margen/comisión hoy",
      value: formatCurrency(todaySnapshot.profit),
      tone: "base",
      help: "Producto propio: venta menos coste efectivo. Consigna: comisión de tienda.",
    },
    { label: "Ticket medio hoy", value: formatCurrency(todaySnapshot.averageTicket), tone: "soft" },
  ];
  const workWeekCards: MetricCardItem[] = [
    { label: "Tickets semana", value: formatCount(workWeekSnapshot.tickets), tone: "soft" },
    { label: "Venta semana", value: formatCurrency(workWeekSnapshot.revenue), tone: "base" },
    { label: "Unidades semana", value: formatCount(workWeekSnapshot.units), tone: "soft" },
    {
      label: "Margen/comisión semana",
      value: formatCurrency(workWeekSnapshot.profit),
      tone: "base",
      help: "Semana laboral actual, de lunes a viernes.",
    },
    {
      label: "Ticket medio semana",
      value: formatCurrency(workWeekSnapshot.averageTicket),
      tone: "soft",
    },
  ];

  return (
    <section className="dashboard">
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">{viewMeta.eyebrow}</p>
          <h1>{viewMeta.title}</h1>
          <p className="lede">{viewMeta.description}</p>
          <DashboardTabs currentView={currentView} />
          <PeriodSelector
            action="/dashboard"
            hiddenFields={currentView === "general" ? undefined : { view: currentView }}
            mode={currentMode}
            month={selectedMonth}
            monthHref={buildDashboardHref({
              mode: "month",
              month: selectedMonth,
              view: currentView,
              year: selectedYear,
            })}
            year={selectedYear}
            yearHref={buildDashboardHref({
              mode: "year",
              month: selectedMonth,
              view: currentView,
              year: selectedYear,
            })}
            years={availableYears}
          />
        </div>

        <div className="hero-summary">
          <p className="card-label">Periodo activo</p>
          <h2>{monthLabel}</h2>
          <p>{periodExplainer}</p>
          <p>Día de referencia: {activeDayLabel}.</p>
        </div>
      </div>

      {currentView === "general" ? (
        <>
          <article className="panel dashboard-today-panel">
            <div className="module-list-header">
              <div>
                <p className="card-label">Hoy en tienda</p>
                <p>
                  Lectura rápida del día actual. Si todavía no hay ventas, la semana laboral
                  ayuda a mantener contexto.
                </p>
              </div>
              <span className="module-meta">{formatMadridDate(now)}</span>
            </div>
            <div className="dashboard-kpi-grid">
              {dailyCards.map((card) => (
                <MetricCard key={card.label} card={card} />
              ))}
            </div>
          </article>

          <article className="panel dashboard-today-panel">
            <div className="module-list-header">
              <div>
                <p className="card-label">Semana actual</p>
                <p>Lunes a viernes de la semana en curso, no los últimos siete días.</p>
              </div>
            </div>
            <div className="dashboard-kpi-grid">
              {workWeekCards.map((card) => (
                <MetricCard key={card.label} card={card} />
              ))}
            </div>
          </article>

          <div className="dashboard-kpi-grid">
            {generalCards.map((card) => (
              <MetricCard key={card.label} card={card} />
            ))}
          </div>

          <div className="dashboard-analytics-grid">
            <RankedPanel
              title="Ventas por categoría"
              emptyLabel="Importe vendido este mes agrupado por familia principal."
              meta={`${salesByCategory.length} categorías`}
              rows={salesByCategory}
              empty="Aún no hay ventas este mes. En cuanto registres tickets, este bloque mostrará el reparto por categoría."
            />
            <RankedPanel
              title="Ventas por proveedor o marca"
              emptyLabel="Volumen vendido este mes según la marca o proveedor del producto."
              meta={`${salesBySupplier.length} visibles`}
              rows={salesBySupplier}
              empty="Este bloque se llenará cuando existan ventas asociadas a productos con proveedor."
              tone="accent"
            />
            <RankedPanel
              title="Top productos"
              emptyLabel="Los productos con más salida este mes, ordenados por unidades vendidas."
              meta="Top 5"
              rows={topProducts}
              empty="Aún no hay productos en ranking porque no existen ventas registradas este mes."
            />
            <RankedPanel
              title="Top clientas"
              emptyLabel="Ranking mensual por importe de compra confirmado."
              meta={`${topCustomers.length} clientas`}
              rows={topCustomers}
              empty="Cuando empieces a vender con clienta asignada, aquí verás el ranking de fidelidad y valor."
              tone="success"
            />
          </div>
        </>
      ) : null}

      {currentView === "sales" ? (
        <>
          <div className="dashboard-kpi-grid">
            {salesCards.map((card) => (
              <MetricCard key={card.label} card={card as MetricCardItem} />
            ))}
          </div>

          <div className="dashboard-analytics-grid">
            <RankedPanel
              title="Métodos de pago"
              emptyLabel="Distribución mensual de tickets e importe por forma de pago."
              meta={`${paymentBreakdown.length} métodos`}
              rows={paymentBreakdown.map((row) => ({
                ...row,
                secondary: `${formatCount(row.units ?? 0)} tickets`,
              }))}
              empty="Cuando registres ventas, aquí verás cómo se reparte la caja entre efectivo, tarjeta y Bizum."
            />
            <RankedPanel
              title="Ventas por categoría"
              emptyLabel="Reparto mensual del ingreso comercial por familia principal."
              meta={`${salesByCategory.length} categorías`}
              rows={salesByCategory}
              empty="Este bloque se activará en cuanto haya ventas registradas en el mes."
              tone="accent"
            />
            <RankedPanel
              title="Últimos tickets"
              emptyLabel="Las ventas más recientes del mes actual."
              meta={`${recentSales.length} tickets`}
              rows={recentSales}
              empty="Todavía no hay tickets recientes para mostrar en esta vista."
            />
            <RankedPanel
              title="Top clientas"
              emptyLabel="Ranking de clientas por importe total comprado en el mes."
              meta={`${topCustomers.length} clientas`}
              rows={topCustomers}
              empty="Cuando el histórico tenga clienta asignada, aquí verás la fidelidad y el valor de compra."
              tone="success"
            />
          </div>
        </>
      ) : null}

      {currentView === "suppliers" ? (
        <>
          <div className="dashboard-kpi-grid">
            {supplierCards.map((card) => (
              <MetricCard key={card.label} card={card as MetricCardItem} />
            ))}
          </div>

          <div className="dashboard-analytics-grid">
            <RankedPanel
              title="Ventas por proveedor o marca"
              emptyLabel="Qué proveedores mueven más volumen este mes."
              meta={`${salesBySupplier.length} visibles`}
              rows={salesBySupplier}
              empty="Aún no hay actividad comercial suficiente para ordenar proveedores por ventas."
            />
            <RankedPanel
              title="Pendiente proveedor"
              emptyLabel="Importe pendiente de liquidar por proveedor según las ventas del mes."
              meta={`${pendingBySupplier.length} proveedores`}
              rows={pendingBySupplier}
              empty="Cuando tengas ventas con producto y proveedor, aquí verás qué saldo queda por liquidar."
              tone="accent"
            />
            <RankedPanel
              title="Beneficio calculado por proveedor"
              emptyLabel="Margen calculado por línea usando comisión en consigna y coste snapshot en producto propio."
              meta={`${storeProfitBySupplier.length} proveedores`}
              rows={storeProfitBySupplier}
              empty={
                hasReliableProfit
                  ? "Este ranking se activará con las primeras ventas que incluyan snapshots económicos."
                  : "No disponible antes de enero de 2026, cuando comienza el cálculo fiable con coste snapshot."
              }
            />
            <RankedPanel
              title="Top productos por proveedor"
              emptyLabel="Productos más fuertes del mes, con proveedor visible en el resumen."
              meta="Top 5"
              rows={topProducts}
              empty="Cuando se registren ventas, esta vista resaltará qué piezas tiran mejor dentro de cada marca."
              tone="success"
            />
          </div>
        </>
      ) : null}

      {currentView === "operations" ? (
        <>
          <div className="dashboard-kpi-grid">
            {operationsCards.map((card) => (
              <MetricCard key={card.label} card={card} />
            ))}
          </div>

          <div className="dashboard-analytics-grid">
            <RankedPanel
              title="Últimas entradas"
              emptyLabel="Recepciones recientes de mercancía con proveedor y coste estimado."
              meta={`${recentEntriesRows.length} recientes`}
              rows={recentEntriesRows.map((row) => ({
                ...row,
                secondary: `${row.secondary} · ${formatCount(row.units ?? 0)} uds`,
              }))}
              empty="No hay entradas recientes todavía. Este panel te ayudará a revisar actividad de mercancía."
            />
            <RankedPanel
              title="Últimos movimientos"
              emptyLabel="Trazabilidad resumida de stock para detectar actividad y ajustes."
              meta={`${recentMovementRows.length} movimientos`}
              rows={recentMovementRows}
              empty="Cuando existan movimientos de stock, aquí verás la última actividad operativa."
              tone="accent"
            />
            <article className="panel">
              <div className="dashboard-panel-header">
                <div>
                  <p className="card-label">Alertas operativas</p>
                  <p>Indicadores rápidos para saber si la tienda necesita acción.</p>
                </div>
                <span className="module-meta">Resumen</span>
              </div>
              <div className="dashboard-alert-grid">
                <div className="dashboard-alert-card">
                  <strong>{formatCount(productsWithLowStock)}</strong>
                  <span>Productos con stock bajo</span>
                </div>
                <div className="dashboard-alert-card">
                  <strong>{formatCount(productsWithoutStock)}</strong>
                  <span>Productos agotados</span>
                </div>
                <div className="dashboard-alert-card">
                  <strong>{formatCount(openPurchaseOrdersCount)}</strong>
                  <span>Pedidos futuros abiertos</span>
                </div>
                <div className="dashboard-alert-card">
                  <strong>{formatCount(stockUnits)}</strong>
                  <span>Unidades activas en stock</span>
                </div>
              </div>
            </article>
            <RankedPanel
              title="Ventas por categoría"
              emptyLabel="Cruce operativo rápido para ver qué familias se están moviendo."
              meta={`${salesByCategory.length} categorías`}
              rows={salesByCategory}
              empty="En cuanto haya ventas en curso, este bloque completará la lectura operativa del día a día."
              tone="success"
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
