import { ProductType } from "@prisma/client";

const PURCHASE_VAT_MULTIPLIER = 1.21;

type Decimalish = { toString(): string } | number | string | null | undefined;

function toNumber(value: Decimalish) {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value.toString());
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function getEffectiveOwnedCost(baseCost: Decimalish, applyVatToCost: boolean) {
  const normalizedBaseCost = toNumber(baseCost);

  return roundMoney(
    applyVatToCost ? normalizedBaseCost * PURCHASE_VAT_MULTIPLIER : normalizedBaseCost,
  );
}

export function getEffectiveUnitCost(input: {
  applyVatToCost: boolean;
  baseCost: Decimalish;
  productType: ProductType;
}) {
  if (input.productType !== ProductType.OWNED) {
    return roundMoney(toNumber(input.baseCost));
  }

  return getEffectiveOwnedCost(input.baseCost, input.applyVatToCost);
}
