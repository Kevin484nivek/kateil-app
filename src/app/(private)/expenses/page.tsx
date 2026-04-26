import type { Route } from "next";
import { ExpenseCategory, ExpenseEntryKind } from "@prisma/client";
import Link from "next/link";

import { ActionForm } from "@/components/ui/action-form";
import { ExpenseFormPanel } from "@/components/ui/expense-form-panel";
import { PeriodSelector } from "@/components/ui/period-selector";
import { prisma } from "@/lib/db/prisma";
import {
  ALL_EXPENSE_CATEGORY_OPTIONS,
  CATEGORY_OPTIONS_BY_KIND,
  getExpenseCategoryLabel,
  getExpenseKindLabel,
  getExpenseSourceLabel,
  syncRecurringExpensesForPeriods,
} from "@/lib/finance/expenses";
import { getMonthLabel, MONTH_OPTIONS } from "@/lib/ui/labels";
import { getSmartSearchScore } from "@/lib/utils/search";

import {
  createExpenseAction,
  deactivateRecurringExpenseRuleAction,
  updateExpenseAction,
  updateRecurringExpenseRuleAction,
  deleteExpenseAction,
} from "./actions";

type ExpensesPageProps = {
  searchParams?: Promise<{
    movementPage?: string;
    mode?: string;
    q?: string;
    year?: string;
    month?: string;
  }>;
};

type ExpensePeriodMode = "month" | "year";
const MOVEMENTS_PAGE_SIZE = 10;

function getPeriodMode(value: string | undefined): ExpensePeriodMode {
  return value === "year" ? "year" : "month";
}

function getIntegerParam(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function buildExpensesHref({
  movementPage,
  mode,
  q,
  year,
  month,
}: {
  movementPage?: number;
  mode: ExpensePeriodMode;
  q?: string;
  year: number;
  month?: number;
}) {
  const params = new URLSearchParams();

  if (mode !== "month") {
    params.set("mode", mode);
  }

  params.set("year", String(year));

  if (q) {
    params.set("q", q);
  }

  if (mode === "month" && month != null) {
    params.set("month", String(month));
  }

  if (movementPage && movementPage > 1) {
    params.set("movementPage", String(movementPage));
  }

  const query = params.toString();
  return (query ? `/expenses?${query}` : "/expenses") as Route;
}

function formatCurrency(value: string | number | { toString(): string }) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value.toString()));
}

function formatCount(value: number) {
  return new Intl.NumberFormat("es-ES").format(value);
}

function getCurrentMovementPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function ExpenseQuickActions({
  expense,
}: {
  expense: Awaited<ReturnType<typeof prisma.expense.findMany>>[number];
}) {
  return (
    <details className="entity-card entity-card-accordion">
      <summary className="entity-card-summary">
        <div>
          <h3>{expense.concept}</h3>
          <p>
            {getExpenseKindLabel(expense.kind)} · {getExpenseCategoryLabel(expense.category)} ·{" "}
            {getExpenseSourceLabel(expense.sourceType)} · {getMonthLabel(expense.month)} {expense.year} ·{" "}
            {formatCurrency(expense.amount)}
          </p>
        </div>
      </summary>
      <ActionForm action={updateExpenseAction} className="entity-form entity-form-inline">
        <input type="hidden" name="expenseId" value={expense.id} />
        <label>
          <span>Año</span>
          <input name="year" type="number" min="2020" max="2100" defaultValue={expense.year} required />
        </label>
        <label>
          <span>Mes</span>
          <select name="month" defaultValue={String(expense.month)} required>
            {MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select name="kind" defaultValue={expense.kind}>
            <option value={ExpenseEntryKind.EXPENSE}>Gasto</option>
            <option value={ExpenseEntryKind.INCOME}>Ingreso</option>
          </select>
        </label>
        <label>
          <span>Categoría</span>
          <select name="category" defaultValue={expense.category}>
            {ALL_EXPENSE_CATEGORY_OPTIONS.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Importe</span>
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue={expense.amount.toString()}
            required
          />
        </label>
        <label className="full-span">
          <span>Concepto</span>
          <input name="concept" defaultValue={expense.concept} required />
        </label>
        <label className="full-span">
          <span>Notas</span>
          <textarea name="notes" rows={3} defaultValue={expense.notes ?? ""} />
        </label>
        <button className="button button-primary" type="submit">
          Guardar cambios
        </button>
      </ActionForm>
      <ActionForm action={deleteExpenseAction}>
        <input type="hidden" name="expenseId" value={expense.id} />
        <button className="button button-secondary" type="submit">
          Eliminar movimiento
        </button>
      </ActionForm>
    </details>
  );
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = (await searchParams) ?? {};
  const now = new Date();
  const mode = getPeriodMode(params.mode);
  const selectedYear = getIntegerParam(params.year) ?? now.getFullYear();
  const selectedMonth = getIntegerParam(params.month) ?? now.getMonth() + 1;
  const movementQuery = params.q?.trim() ?? "";
  const requestedMovementPage = getCurrentMovementPage(params.movementPage);

  try {
    await prisma.$transaction(async (tx) => {
      if (mode === "year") {
        await syncRecurringExpensesForPeriods(
          tx,
          Array.from({ length: 12 }, (_, index) => ({
            year: selectedYear,
            month: index + 1,
          })),
        );
      } else {
        await syncRecurringExpensesForPeriods(tx, [{ year: selectedYear, month: selectedMonth }]);
      }
    });
  } catch (error) {
    console.error("Failed to sync recurring expenses for selected period", error);
  }

  const [expenses, recurringRules] = await Promise.all([
    prisma.expense.findMany({
      where:
        mode === "year"
          ? { year: selectedYear }
          : {
              year: selectedYear,
              month: selectedMonth,
            },
      include: {
        recurringRule: true,
      },
      orderBy: [{ month: "asc" }, { category: "asc" }, { createdAt: "asc" }],
    }),
    prisma.recurringExpenseRule.findMany({
      orderBy: [{ isActive: "desc" }, { category: "asc" }, { concept: "asc" }],
    }),
  ]);

  const totalExpenseAmount = expenses
    .filter((expense) => expense.kind === ExpenseEntryKind.EXPENSE)
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  const totalIncomeAmount = expenses
    .filter((expense) => expense.kind === ExpenseEntryKind.INCOME)
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  const netAmount = totalIncomeAmount - totalExpenseAmount;
  const merchandiseAmount = expenses
    .filter(
      (expense) =>
        expense.kind === ExpenseEntryKind.EXPENSE && expense.sourceType === "INVENTORY_ENTRY",
    )
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  const expensesByCategory = Array.from(
    expenses.reduce((map, expense) => {
      if (expense.kind !== ExpenseEntryKind.EXPENSE) {
        return map;
      }

      const current = map.get(expense.category) ?? 0;
      map.set(expense.category, current + Number(expense.amount));
      return map;
    }, new Map<ExpenseCategory, number>()),
  ).sort((left, right) => right[1] - left[1]);

  const incomeByCategory = Array.from(
    expenses.reduce((map, expense) => {
      if (expense.kind !== ExpenseEntryKind.INCOME) {
        return map;
      }

      const current = map.get(expense.category) ?? 0;
      map.set(expense.category, current + Number(expense.amount));
      return map;
    }, new Map<ExpenseCategory, number>()),
  ).sort((left, right) => right[1] - left[1]);

  const expensesByMonth = Array.from(
    expenses.reduce((map, expense) => {
      const signedAmount =
        expense.kind === ExpenseEntryKind.INCOME ? Number(expense.amount) : -Number(expense.amount);
      const current = map.get(expense.month) ?? 0;
      map.set(expense.month, current + signedAmount);
      return map;
    }, new Map<number, number>()),
  ).sort((left, right) => left[0] - right[0]);
  const availableYears = Array.from({ length: 4 }, (_, index) => now.getFullYear() - index);
  const monthLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const selectedPeriodLabel =
    mode === "year" ? String(selectedYear) : `${getMonthLabel(selectedMonth)} ${selectedYear}`;
  const filteredMovements = movementQuery
    ? expenses
        .map((expense) => ({
          expense,
          score: getSmartSearchScore(movementQuery, [
            { value: expense.concept, weight: 5 },
            { value: getExpenseCategoryLabel(expense.category), weight: 4 },
            { value: getExpenseKindLabel(expense.kind), weight: 3 },
            { value: getExpenseSourceLabel(expense.sourceType), weight: 3 },
            { value: getMonthLabel(expense.month), weight: 2 },
            { value: String(expense.year), weight: 2 },
            { value: expense.notes, weight: 1 },
          ]),
        }))
        .filter((entry) => entry.score !== null)
        .sort((left, right) => {
          const scoreDiff = (right.score ?? 0) - (left.score ?? 0);

          if (scoreDiff !== 0) {
            return scoreDiff;
          }

          return right.expense.createdAt.getTime() - left.expense.createdAt.getTime();
        })
        .map((entry) => entry.expense)
    : expenses;
  const totalMovementPages = Math.max(
    1,
    Math.ceil(filteredMovements.length / MOVEMENTS_PAGE_SIZE),
  );
  const currentMovementPage = Math.min(requestedMovementPage, totalMovementPages);
  const movementPageStart = (currentMovementPage - 1) * MOVEMENTS_PAGE_SIZE;
  const visibleMovements = filteredMovements.slice(
    movementPageStart,
    movementPageStart + MOVEMENTS_PAGE_SIZE,
  );

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Finanzas</p>
          <h1>Gastos e ingresos</h1>
          <p className="lede">
            Controla movimientos manuales, recurrencias y mercancía entrante en el periodo seleccionado.
          </p>
        </div>
      </div>

      <PeriodSelector
        action="/expenses"
        hiddenFields={{ q: movementQuery }}
        mode={mode}
        month={selectedMonth}
        monthHref={buildExpensesHref({
          mode: "month",
          q: movementQuery,
          year: selectedYear,
          month: selectedMonth,
        })}
        year={selectedYear}
        yearHref={buildExpensesHref({
          mode: "year",
          q: movementQuery,
          year: selectedYear,
        })}
        years={availableYears}
      />

      <div className="dashboard-kpi-grid">
        <article className="metric-card">
          <p className="card-label">Gastos del periodo</p>
          <strong>{formatCurrency(totalExpenseAmount)}</strong>
        </article>
        <article className="metric-card">
          <p className="card-label">Ingresos del periodo</p>
          <strong>{formatCurrency(totalIncomeAmount)}</strong>
        </article>
        <article className="metric-card">
          <p className="card-label">Balance neto</p>
          <strong>{formatCurrency(netAmount)}</strong>
        </article>
        <article className="metric-card metric-card-soft">
          <p className="card-label">Mercancía entrante</p>
          <strong>{formatCurrency(merchandiseAmount)}</strong>
        </article>
      </div>

      <div className="module-grid">
        <article className="panel">
          <p className="card-label">Nuevo movimiento</p>
          <ExpenseFormPanel
            categoryGroups={CATEGORY_OPTIONS_BY_KIND}
            defaultYear={selectedYear}
            defaultMonth={selectedMonth}
            createExpenseAction={createExpenseAction}
          />
        </article>

        <article className="panel">
          <p className="card-label">Resumen del periodo</p>
          {mode === "year" ? (
            <div className="entity-list">
              <article className="entity-card">
                <div className="entity-card-header">
                  <div>
                    <h3>Balance por mes</h3>
                    <p>{selectedYear}</p>
                  </div>
                </div>
                <div className="entry-summary-list">
                  {expensesByMonth.map(([month, amount]) => (
                    <div key={month} className="entry-summary-row">
                      <span>{getMonthLabel(month)}</span>
                      <span>{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : null}

          <div className="entity-list">
            <article className="entity-card">
              <div className="entity-card-header">
                <div>
                  <h3>Categorías de gasto</h3>
                  <p>
                    {mode === "year"
                      ? `Resumen anual ${selectedYear}`
                      : `${getMonthLabel(selectedMonth)} ${selectedYear}`}
                  </p>
                </div>
              </div>
              <div className="entry-summary-list">
                {expensesByCategory.length === 0 ? (
                  <div className="entry-summary-row">
                    <span>Sin gastos en el periodo</span>
                    <span>—</span>
                  </div>
                ) : (
                  expensesByCategory.map(([category, amount]) => (
                    <div key={category} className="entry-summary-row">
                      <span>{getExpenseCategoryLabel(category)}</span>
                      <span>{formatCurrency(amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </article>
            <article className="entity-card">
              <div className="entity-card-header">
                <div>
                  <h3>Categorías de ingreso</h3>
                  <p>
                    {mode === "year"
                      ? `Resumen anual ${selectedYear}`
                      : `${getMonthLabel(selectedMonth)} ${selectedYear}`}
                  </p>
                </div>
              </div>
              <div className="entry-summary-list">
                {incomeByCategory.length === 0 ? (
                  <div className="entry-summary-row">
                    <span>Sin ingresos en el periodo</span>
                    <span>—</span>
                  </div>
                ) : (
                  incomeByCategory.map(([category, amount]) => (
                    <div key={category} className="entry-summary-row">
                      <span>{getExpenseCategoryLabel(category)}</span>
                      <span>{formatCurrency(amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </article>
          </div>
        </article>
      </div>

      <div className="module-grid">
        <article className="panel">
          <div className="module-list-header">
            <div>
              <p className="card-label">Movimientos del periodo</p>
              <p>
                Busca por concepto, categoría u origen y revisa solo 10 movimientos por página.
              </p>
            </div>
            <span className="module-meta">
              {filteredMovements.length} resultados · página {currentMovementPage} de {totalMovementPages}
            </span>
          </div>
          <form method="get" className="products-filters">
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="year" value={String(selectedYear)} />
            {mode === "month" ? (
              <input type="hidden" name="month" value={String(selectedMonth)} />
            ) : null}
            <label className="products-search">
              <span>Buscador</span>
              <input
                name="q"
                defaultValue={movementQuery}
                placeholder="Concepto, categoría, origen, mes..."
              />
            </label>
            <button className="button button-secondary" type="submit">
              Filtrar
            </button>
          </form>
          <div className="active-filter-row" aria-label="Filtros activos">
            <span className="active-filter-label">Filtros activos</span>
            <span className="active-filter-chip">Periodo: {selectedPeriodLabel}</span>
            {movementQuery ? (
              <span className="active-filter-chip">Búsqueda: {movementQuery}</span>
            ) : null}
          </div>
          <div className="entity-list">
            {visibleMovements.length === 0 ? (
              <article className="entity-card">
                <p>
                  {movementQuery
                    ? "No hay movimientos que coincidan con esa búsqueda."
                    : "No hay movimientos cargados en este periodo."}
                </p>
              </article>
            ) : (
              visibleMovements.map((expense) => (
                <ExpenseQuickActions key={`summary-${expense.id}`} expense={expense} />
              ))
            )}
          </div>
          {totalMovementPages > 1 ? (
            <div className="module-chip-row dashboard-period-tabs">
              <Link
                href={buildExpensesHref({
                  movementPage: Math.max(1, currentMovementPage - 1),
                  mode,
                  q: movementQuery,
                  year: selectedYear,
                  month: selectedMonth,
                })}
                className={`button ${currentMovementPage === 1 ? "button-secondary" : "button-primary"}`}
              >
                Anterior
              </Link>
              {Array.from({ length: totalMovementPages }, (_, index) => index + 1).map((page) => (
                <Link
                  key={page}
                  href={buildExpensesHref({
                    movementPage: page,
                    mode,
                    q: movementQuery,
                    year: selectedYear,
                    month: selectedMonth,
                  })}
                  className={`button ${page === currentMovementPage ? "button-primary" : "button-secondary"}`}
                >
                  {page}
                </Link>
              ))}
              <Link
                href={buildExpensesHref({
                  movementPage: Math.min(totalMovementPages, currentMovementPage + 1),
                  mode,
                  q: movementQuery,
                  year: selectedYear,
                  month: selectedMonth,
                })}
                className={`button ${currentMovementPage === totalMovementPages ? "button-secondary" : "button-primary"}`}
              >
                Siguiente
              </Link>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <div className="module-list-header">
            <div>
              <p className="card-label">Movimientos recurrentes</p>
              <p>Mensuales, con el mismo importe hasta que edites desde qué fecha cambia.</p>
            </div>
            <span className="module-meta">{formatCount(recurringRules.length)} reglas</span>
          </div>
          <div className="entity-list">
            {recurringRules.length === 0 ? (
              <article className="entity-card">
                <p>Aún no hay recurrencias activas.</p>
              </article>
            ) : (
              recurringRules.map((rule) => (
                <details key={rule.id} className="entity-card entity-card-accordion">
                  <summary className="entity-card-summary">
                    <div>
                      <h3>{rule.concept}</h3>
                      <p>
                        {getExpenseKindLabel(rule.kind)} · {getExpenseCategoryLabel(rule.category)} · {formatCurrency(rule.amount)} · desde{" "}
                        {getMonthLabel(rule.startMonth)} {rule.startYear}
                      </p>
                    </div>
                    <div className="entity-summary-meta">
                      <span className={`status-pill ${rule.isActive ? "status-active" : ""}`}>
                        {rule.isActive ? "Activa" : "Cerrada"}
                      </span>
                    </div>
                  </summary>
                  {rule.notes ? <p className="entity-notes">{rule.notes}</p> : null}
                  <details className="entity-edit-block" open>
                    <summary>Editar recurrencia</summary>
                    <ActionForm action={updateRecurringExpenseRuleAction} className="entity-form entity-form-inline">
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <input type="hidden" name="isActive" value="true" />
                      <label>
                        <span>Tipo</span>
                        <select name="kind" defaultValue={rule.kind}>
                          <option value={ExpenseEntryKind.EXPENSE}>Gasto</option>
                          <option value={ExpenseEntryKind.INCOME}>Ingreso</option>
                        </select>
                      </label>
                      <label>
                        <span>Categoría</span>
                        <select name="category" defaultValue={rule.category}>
                          {ALL_EXPENSE_CATEGORY_OPTIONS.map((category) => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Importe</span>
                        <input
                          name="amount"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          defaultValue={rule.amount.toString()}
                          required
                        />
                      </label>
                      <label>
                        <span>Aplica desde año</span>
                        <input name="effectiveYear" type="number" min="2020" max="2100" defaultValue={selectedYear} required />
                      </label>
                      <label>
                        <span>Aplica desde mes</span>
                        <select
                          name="effectiveMonth"
                          defaultValue={String(mode === "month" ? selectedMonth : rule.startMonth)}
                          required
                        >
                          {MONTH_OPTIONS.map((month) => (
                            <option key={month.value} value={month.value}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="full-span">
                        <span>Concepto</span>
                        <input name="concept" defaultValue={rule.concept} required />
                      </label>
                      <label className="full-span">
                        <span>Notas</span>
                        <textarea name="notes" rows={3} defaultValue={rule.notes ?? ""} />
                      </label>
                      <button className="button button-primary" type="submit">
                        Guardar cambios
                      </button>
                    </ActionForm>
                  </details>
                  {rule.isActive ? (
                    <ActionForm action={deactivateRecurringExpenseRuleAction}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <input type="hidden" name="effectiveYear" value={String(selectedYear)} />
                      <input
                        type="hidden"
                        name="effectiveMonth"
                        value={String(mode === "month" ? selectedMonth : 1)}
                      />
                      <button className="button button-secondary" type="submit">
                        Desactivar desde el periodo seleccionado
                      </button>
                    </ActionForm>
                  ) : null}
                </details>
              ))
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
