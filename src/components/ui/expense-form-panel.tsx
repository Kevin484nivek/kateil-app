"use client";

import type { ExpenseEntryKind } from "@prisma/client";
import { useEffect, useState } from "react";

import { MONTH_OPTIONS } from "@/lib/ui/labels";
import { sanitizeNumericInput } from "@/lib/utils/numeric-input";

type ExpenseCategoryOption = {
  value: string;
  label: string;
};

type ExpenseFormPanelProps = {
  categoryGroups: Record<ExpenseEntryKind, ExpenseCategoryOption[]>;
  defaultYear: number;
  defaultMonth: number;
  createExpenseAction: (formData: FormData) => void | Promise<void>;
};

export function ExpenseFormPanel({
  categoryGroups,
  defaultYear,
  defaultMonth,
  createExpenseAction,
}: ExpenseFormPanelProps) {
  const [isRecurring, setIsRecurring] = useState(false);
  const [kind, setKind] = useState<ExpenseEntryKind>("EXPENSE");
  const [category, setCategory] = useState(categoryGroups.EXPENSE[0]?.value ?? "");
  const [amount, setAmount] = useState("");
  const activeCategories = categoryGroups[kind] ?? [];

  useEffect(() => {
    const nextCategory = activeCategories[0]?.value ?? "";

    if (!activeCategories.some((option) => option.value === category)) {
      setCategory(nextCategory);
    }
  }, [activeCategories, category]);

  return (
    <form
      action={createExpenseAction}
      className="entity-form expense-form-panel"
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;

        if (
          event.key === "Enter" &&
          !(target instanceof HTMLTextAreaElement) &&
          !(target instanceof HTMLButtonElement)
        ) {
          event.preventDefault();
        }
      }}
    >
      <label>
        <span>Tipo</span>
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as ExpenseEntryKind)}
          required
        >
          <option value="EXPENSE">Gasto</option>
          <option value="INCOME">Ingreso</option>
        </select>
      </label>
      <label>
        <span>Año</span>
        <input name="year" type="number" min="2020" max="2100" defaultValue={defaultYear} required />
      </label>
      <label>
        <span>Mes</span>
        <select name="month" defaultValue={String(defaultMonth)} required>
          {MONTH_OPTIONS.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Categoría</span>
        <select
          name="category"
          required
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {activeCategories.map((category) => (
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
          placeholder="0,00"
          value={amount}
          onChange={(event) =>
            setAmount(sanitizeNumericInput(event.target.value, { maxDecimals: 2 }))
          }
          required
        />
      </label>
      <label className="full-span">
        <span>Concepto</span>
        <input name="concept" placeholder="Ej. Alquiler local" required />
      </label>
      <label className="full-span">
        <span>Notas</span>
        <textarea name="notes" rows={3} />
      </label>
      <label className="checkbox-card full-span">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(event) => setIsRecurring(event.target.checked)}
        />
        <span>Recurrente mensual con el mismo importe hasta que se edite</span>
      </label>
      <input type="hidden" name="isRecurring" value={String(isRecurring)} />
      <button className="button button-primary" type="submit">
        {kind === "INCOME" ? "Guardar ingreso" : "Guardar gasto"}
      </button>
    </form>
  );
}
