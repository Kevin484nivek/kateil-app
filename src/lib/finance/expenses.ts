import {
  ExpenseCategory,
  ExpenseEntryKind,
  ExpenseSourceType,
  Prisma,
  type RecurringExpenseRule,
} from "@prisma/client";

type ExpenseCategoryOption = { value: ExpenseCategory; label: string };

export const EXPENSE_KIND_OPTIONS: Array<{ value: ExpenseEntryKind; label: string }> = [
  { value: ExpenseEntryKind.EXPENSE, label: "Gasto" },
  { value: ExpenseEntryKind.INCOME, label: "Ingreso" },
];

export const EXPENSE_CATEGORY_OPTIONS: ExpenseCategoryOption[] = [
  { value: ExpenseCategory.RENT, label: "Alquiler" },
  { value: ExpenseCategory.SELF_EMPLOYED, label: "Autónomos" },
  { value: ExpenseCategory.ELECTRICITY, label: "Luz" },
  { value: ExpenseCategory.INTERNET, label: "Internet" },
  { value: ExpenseCategory.SECURITY, label: "Seguridad" },
  { value: ExpenseCategory.POS, label: "TPV" },
  { value: ExpenseCategory.ACCOUNTING, label: "Gestoría" },
  { value: ExpenseCategory.SUPPLIES, label: "Suministros" },
  { value: ExpenseCategory.MARKETING, label: "Marketing" },
  { value: ExpenseCategory.MERCHANDISE, label: "Mercancía" },
  { value: ExpenseCategory.OTHER, label: "Otros" },
];

export const INCOME_CATEGORY_OPTIONS: ExpenseCategoryOption[] = [
  { value: ExpenseCategory.SPACE_RENTAL, label: "Alquiler de espacio" },
  { value: ExpenseCategory.SERVICE_INCOME, label: "Servicio" },
  { value: ExpenseCategory.OTHER_INCOME, label: "Otros ingresos" },
];

export const ALL_EXPENSE_CATEGORY_OPTIONS: ExpenseCategoryOption[] = [
  ...EXPENSE_CATEGORY_OPTIONS,
  ...INCOME_CATEGORY_OPTIONS,
];

export const CATEGORY_OPTIONS_BY_KIND: Record<ExpenseEntryKind, ExpenseCategoryOption[]> = {
  [ExpenseEntryKind.EXPENSE]: EXPENSE_CATEGORY_OPTIONS,
  [ExpenseEntryKind.INCOME]: INCOME_CATEGORY_OPTIONS,
};

export function getExpenseCategoryLabel(category: ExpenseCategory) {
  return (
    ALL_EXPENSE_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category
  );
}

export function getExpenseKindLabel(kind: ExpenseEntryKind) {
  return EXPENSE_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

export function getExpenseSourceLabel(sourceType: ExpenseSourceType) {
  switch (sourceType) {
    case ExpenseSourceType.RECURRING:
      return "Recurrente";
    case ExpenseSourceType.INVENTORY_ENTRY:
      return "Mercancía";
    default:
      return "Manual";
  }
}

export function isValidYearMonth(year: number, month: number) {
  return Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12;
}

export function toYearMonthKey(year: number, month: number) {
  return year * 100 + month;
}

export function getPreviousYearMonth(year: number, month: number) {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }

  return { year, month: month - 1 };
}

export function ruleAppliesToPeriod(
  rule: Pick<RecurringExpenseRule, "startYear" | "startMonth" | "endYear" | "endMonth" | "isActive">,
  year: number,
  month: number,
) {
  if (!rule.isActive) {
    return false;
  }

  const currentKey = toYearMonthKey(year, month);
  const startKey = toYearMonthKey(rule.startYear, rule.startMonth);
  const endKey =
    rule.endYear != null && rule.endMonth != null
      ? toYearMonthKey(rule.endYear, rule.endMonth)
      : Number.POSITIVE_INFINITY;

  return currentKey >= startKey && currentKey <= endKey;
}

export async function syncRecurringExpensesForPeriods(
  tx: Prisma.TransactionClient,
  periods: Array<{ year: number; month: number }>,
) {
  if (periods.length === 0) {
    return;
  }

  const rules = await tx.recurringExpenseRule.findMany({
    where: { isActive: true },
  });

  for (const period of periods) {
    for (const rule of rules) {
      if (!ruleAppliesToPeriod(rule, period.year, period.month)) {
        continue;
      }

      await tx.expense.upsert({
        where: {
          recurringRuleId_year_month: {
            recurringRuleId: rule.id,
            year: period.year,
            month: period.month,
          },
        },
        create: {
          year: period.year,
          month: period.month,
          kind: rule.kind,
          category: rule.category,
          concept: rule.concept,
          amount: rule.amount,
          notes: rule.notes,
          sourceType: ExpenseSourceType.RECURRING,
          recurringRuleId: rule.id,
        },
        update: {
          kind: rule.kind,
          category: rule.category,
          concept: rule.concept,
          amount: rule.amount,
          notes: rule.notes,
          sourceType: ExpenseSourceType.RECURRING,
        },
      });
    }
  }
}
