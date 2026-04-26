"use client";

import { useMemo, useState } from "react";

import { getSmartSearchScore } from "@/lib/utils/search";

type SupplierOption = {
  id: string;
  name: string;
  supplierCode: string | null;
};

type SupplierStatementFiltersProps = {
  suppliers: SupplierOption[];
  selectedSupplierId: string;
  mode: "month" | "year";
  year: number;
  month: number;
};

export function SupplierStatementFilters({
  suppliers,
  selectedSupplierId,
  mode,
  year,
  month,
}: SupplierStatementFiltersProps) {
  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null;
  const [query, setQuery] = useState(selectedSupplier?.name ?? "");

  const filteredSuppliers = useMemo(() => {
    if (!query.trim()) {
      return suppliers;
    }

    return suppliers
      .map((supplier) => ({
        score: getSmartSearchScore(query, [
          { value: supplier.name, weight: 5 },
          { value: supplier.supplierCode, weight: 4 },
        ]),
        supplier,
      }))
      .filter((entry) => entry.score !== null)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .map((entry) => entry.supplier);
  }, [query, suppliers]);

  return (
    <form method="get" className="entity-form supplier-statement-form">
      <label>
        <span>Buscar proveedor</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Escribe nombre o código..."
        />
      </label>
      <label>
        <span>Proveedor</span>
        <select name="supplierId" defaultValue={selectedSupplierId}>
          <option value="">Selecciona proveedor...</option>
          {filteredSuppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
              {supplier.supplierCode ? ` (${supplier.supplierCode})` : ""}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="year" value={String(year)} />
      {mode === "month" ? <input type="hidden" name="month" value={String(month)} /> : null}
      <button className="button button-primary" type="submit">
        Generar justificante
      </button>
    </form>
  );
}
