"use server";

import { ExpenseCategory, ExpenseEntryKind, ExpenseSourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireUserSession } from "@/lib/auth/session";
import {
  getPreviousYearMonth,
  isValidYearMonth,
  syncRecurringExpensesForPeriods,
  toYearMonthKey,
} from "@/lib/finance/expenses";
import { prisma } from "@/lib/db/prisma";
import { getOptionalString, getRequiredString } from "@/lib/utils/form";

function parseRequiredMonth(formData: FormData, key: string) {
  const value = Number.parseInt(getRequiredString(formData, key), 10);

  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new Error(`Invalid month for ${key}`);
  }

  return value;
}

function parseRequiredYear(formData: FormData, key: string) {
  const value = Number.parseInt(getRequiredString(formData, key), 10);

  if (!Number.isInteger(value) || value < 2020 || value > 2100) {
    throw new Error(`Invalid year for ${key}`);
  }

  return value;
}

function parseAmount(formData: FormData, key: string) {
  const normalized = getRequiredString(formData, key).replace(",", ".");
  const value = Number(normalized);

  if (Number.isNaN(value) || value < 0) {
    throw new Error(`Invalid amount for ${key}`);
  }

  return value.toFixed(2);
}

function parseCategory(formData: FormData, key: string) {
  const value = getRequiredString(formData, key);

  if (!Object.values(ExpenseCategory).includes(value as ExpenseCategory)) {
    throw new Error(`Invalid category for ${key}`);
  }

  return value as ExpenseCategory;
}

function parseKind(formData: FormData, key: string) {
  const value = getRequiredString(formData, key);

  if (!Object.values(ExpenseEntryKind).includes(value as ExpenseEntryKind)) {
    throw new Error(`Invalid kind for ${key}`);
  }

  return value as ExpenseEntryKind;
}

function revalidateExpensesSurface() {
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/inventory-entries");
}

export async function createExpenseAction(formData: FormData) {
  const session = await requireUserSession();
  const year = parseRequiredYear(formData, "year");
  const month = parseRequiredMonth(formData, "month");
  const kind = parseKind(formData, "kind");
  const category = parseCategory(formData, "category");
  const concept = getRequiredString(formData, "concept");
  const amount = parseAmount(formData, "amount");
  const notes = getOptionalString(formData, "notes");
  const isRecurring = String(formData.get("isRecurring")) === "true";

  if (isRecurring) {
    await prisma.$transaction(async (tx) => {
      const rule = await tx.recurringExpenseRule.create({
        data: {
          kind,
          category,
          concept,
          amount,
          notes,
          startYear: year,
          startMonth: month,
        },
      });

      await syncRecurringExpensesForPeriods(tx, [{ year, month }]);

      await tx.expense.updateMany({
        where: {
          recurringRuleId: rule.id,
          year,
          month,
        },
        data: {
          userId: session.userId,
        },
      });
    });
  } else {
    await prisma.expense.create({
      data: {
        year,
        month,
        kind,
        category,
        concept,
        amount,
        notes,
        sourceType: ExpenseSourceType.MANUAL,
        userId: session.userId,
      },
    });
  }

  revalidateExpensesSurface();
}

export async function updateExpenseAction(formData: FormData) {
  const expenseId = getRequiredString(formData, "expenseId");
  const year = parseRequiredYear(formData, "year");
  const month = parseRequiredMonth(formData, "month");
  const kind = parseKind(formData, "kind");
  const category = parseCategory(formData, "category");
  const concept = getRequiredString(formData, "concept");
  const amount = parseAmount(formData, "amount");
  const notes = getOptionalString(formData, "notes");

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      year,
      month,
      kind,
      category,
      concept,
      amount,
      notes,
    },
  });

  revalidateExpensesSurface();
}

export async function deleteExpenseAction(formData: FormData) {
  const expenseId = getRequiredString(formData, "expenseId");

  await prisma.expense.delete({
    where: { id: expenseId },
  });

  revalidateExpensesSurface();
}

export async function updateRecurringExpenseRuleAction(formData: FormData) {
  const ruleId = getRequiredString(formData, "ruleId");
  const effectiveYear = parseRequiredYear(formData, "effectiveYear");
  const effectiveMonth = parseRequiredMonth(formData, "effectiveMonth");
  const kind = parseKind(formData, "kind");
  const category = parseCategory(formData, "category");
  const concept = getRequiredString(formData, "concept");
  const amount = parseAmount(formData, "amount");
  const notes = getOptionalString(formData, "notes");
  const shouldStayActive = String(formData.get("isActive")) === "true";

  await prisma.$transaction(async (tx) => {
    const rule = await tx.recurringExpenseRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new Error("Recurring rule not found");
    }

    const effectiveKey = toYearMonthKey(effectiveYear, effectiveMonth);
    const startKey = toYearMonthKey(rule.startYear, rule.startMonth);

    if (effectiveKey <= startKey) {
      await tx.recurringExpenseRule.update({
        where: { id: rule.id },
        data: {
          kind,
          category,
          concept,
          amount,
          notes,
          isActive: shouldStayActive,
          endYear: shouldStayActive ? rule.endYear : effectiveYear,
          endMonth: shouldStayActive ? rule.endMonth : effectiveMonth,
        },
      });

      await tx.expense.updateMany({
        where: { recurringRuleId: rule.id },
        data: {
          kind,
          category,
          concept,
          amount,
          notes,
        },
      });

      if (!shouldStayActive) {
        await tx.expense.deleteMany({
          where: {
            recurringRuleId: rule.id,
            OR: [
              { year: { gt: effectiveYear } },
              { year: effectiveYear, month: { gte: effectiveMonth } },
            ],
          },
        });
      }

      return;
    }

    const previousPeriod = getPreviousYearMonth(effectiveYear, effectiveMonth);
    const originalEndYear = rule.endYear;
    const originalEndMonth = rule.endMonth;
    const existingPeriods = await tx.expense.findMany({
      where: {
        recurringRuleId: rule.id,
      },
      select: {
        year: true,
        month: true,
      },
      distinct: ["year", "month"],
    });

    await tx.recurringExpenseRule.update({
      where: { id: rule.id },
      data: {
        endYear: previousPeriod.year,
        endMonth: previousPeriod.month,
      },
    });

    await tx.expense.deleteMany({
      where: {
        recurringRuleId: rule.id,
        OR: [
          { year: { gt: effectiveYear } },
          { year: effectiveYear, month: { gte: effectiveMonth } },
        ],
      },
    });

    if (!shouldStayActive) {
      return;
    }

    const newRule = await tx.recurringExpenseRule.create({
      data: {
        kind,
        category,
        concept,
        amount,
        notes,
        startYear: effectiveYear,
        startMonth: effectiveMonth,
        endYear: originalEndYear,
        endMonth: originalEndMonth,
        isActive: true,
      },
    });

    const periodsToSync = [
      { year: effectiveYear, month: effectiveMonth },
      ...existingPeriods.filter((period) =>
        toYearMonthKey(period.year, period.month) >= effectiveKey,
      ),
    ];

    await syncRecurringExpensesForPeriods(tx, periodsToSync);
    await tx.expense.updateMany({
      where: {
        recurringRuleId: newRule.id,
      },
      data: {
        userId: null,
      },
    });
  });

  revalidateExpensesSurface();
}

export async function deactivateRecurringExpenseRuleAction(formData: FormData) {
  const ruleId = getRequiredString(formData, "ruleId");
  const effectiveYear = parseRequiredYear(formData, "effectiveYear");
  const effectiveMonth = parseRequiredMonth(formData, "effectiveMonth");

  if (!isValidYearMonth(effectiveYear, effectiveMonth)) {
    throw new Error("Invalid effective period");
  }

  const previousPeriod = getPreviousYearMonth(effectiveYear, effectiveMonth);

  await prisma.$transaction(async (tx) => {
    await tx.recurringExpenseRule.update({
      where: { id: ruleId },
      data: {
        isActive: false,
        endYear: previousPeriod.year,
        endMonth: previousPeriod.month,
      },
    });

    await tx.expense.deleteMany({
      where: {
        recurringRuleId: ruleId,
        OR: [
          { year: { gt: effectiveYear } },
          { year: effectiveYear, month: { gte: effectiveMonth } },
        ],
      },
    });
  });

  revalidateExpensesSurface();
}
