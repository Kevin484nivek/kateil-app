import { ConsignmentSettlementMode, PaymentMethod, ProductType } from "@prisma/client";

export const MONTH_OPTIONS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
] as const;

export function getMonthLabel(month: number) {
  return MONTH_OPTIONS.find((option) => option.value === month)?.label ?? String(month);
}

export function getProductTypeLabel(productType: ProductType | string) {
  return String(productType) === ProductType.CONSIGNMENT ? "Consigna" : "Propio";
}

export function getConsignmentSettlementModeLabel(
  mode: ConsignmentSettlementMode | string | null | undefined,
) {
  return String(mode) === ConsignmentSettlementMode.FIXED_COST
    ? "Coste fijo"
    : "Comisión porcentual";
}

export function getPaymentMethodLabel(paymentMethod: PaymentMethod | "CASH" | "CARD" | "BIZUM") {
  switch (paymentMethod) {
    case PaymentMethod.CASH:
    case "CASH":
      return "Efectivo";
    case PaymentMethod.BIZUM:
    case "BIZUM":
      return "Bizum";
    default:
      return "Tarjeta";
  }
}
