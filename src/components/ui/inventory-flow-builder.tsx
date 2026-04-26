"use client";

import { ProductType } from "@prisma/client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type FormEvent } from "react";

import { getProductTypeLabel } from "@/lib/ui/labels";
import { sanitizeIntegerInput, sanitizeNumericInput } from "@/lib/utils/numeric-input";
import { getSmartSearchScore } from "@/lib/utils/search";

type SupplierOption = {
  applyVatToCost: boolean;
  id: string;
  name: string;
  supplierCode?: string | null;
};

type CategoryOption = {
  id: string;
  name: string;
};

type NameOption = {
  categoryId: string;
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  name: string;
  code: string;
  productType: ProductType;
  supplierId: string;
  supplierName: string;
  categoryName: string;
  productSubtypeName: string | null;
  seasonName: string | null;
  cost: string;
  stockCurrent: number;
  searchText: string;
};

type InventoryMode = "entry" | "order";
type LineMode = "existing" | "new";

type DraftLine = {
  id: number;
  mode: LineMode;
  existingProductId: string;
  searchQuery: string;
  quantity: string;
  unitCost: string;
  newProductName: string;
  newProductDescription: string;
  newProductCategoryId: string;
  newProductSubtypeName: string;
  seasonName: string;
  newProductBasePrice: string;
  newProductType: ProductType;
  newProductSize: string;
  newProductColor: string;
};

type InventoryFlowBuilderProps = {
  categories: CategoryOption[];
  createInventoryEntryAction: (formData: FormData) => void | Promise<void>;
  createPurchaseOrderAction: (formData: FormData) => void | Promise<void>;
  initialSuccess?: {
    type: "entry" | "order";
    id: string;
    number: string;
  } | null;
  productSubtypes: NameOption[];
  products: ProductOption[];
  seasons: NameOption[];
  suppliers: SupplierOption[];
};

const emptyLine = (id: number): DraftLine => ({
  id,
  mode: "new",
  existingProductId: "",
  searchQuery: "",
  quantity: "1",
  unitCost: "",
  newProductName: "",
  newProductDescription: "",
  newProductCategoryId: "",
  newProductSubtypeName: "",
  seasonName: "",
  newProductBasePrice: "",
  newProductType: ProductType.OWNED,
  newProductSize: "",
  newProductColor: "",
});

function normalizeNumber(value: string) {
  const parsed = Number(value.replace(",", "."));

  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function getEffectiveUnitCostForUi({
  applyVatToCost,
  productType,
  unitCost,
}: {
  applyVatToCost: boolean;
  productType: ProductType;
  unitCost: number;
}) {
  if (!applyVatToCost || productType !== ProductType.OWNED) {
    return unitCost;
  }

  return Number((unitCost * 1.21).toFixed(2));
}

function isLineCompleted(line: DraftLine) {
  return (
    (line.mode === "existing" && Boolean(line.existingProductId)) ||
    (line.mode === "new" &&
      Boolean(line.newProductName) &&
      Boolean(line.newProductDescription) &&
      Boolean(line.newProductCategoryId))
  );
}

function isLineActive(line: DraftLine) {
  return (
    Boolean(line.existingProductId) ||
    Boolean(line.searchQuery.trim()) ||
    Boolean(line.newProductName.trim()) ||
    Boolean(line.newProductDescription.trim()) ||
    Boolean(line.newProductCategoryId) ||
    Boolean(line.newProductSubtypeName.trim()) ||
    Boolean(line.seasonName.trim()) ||
    Boolean(line.newProductBasePrice.trim()) ||
    Boolean(line.newProductSize.trim()) ||
    Boolean(line.newProductColor.trim())
  );
}

export function InventoryFlowBuilder({
  categories,
  createInventoryEntryAction,
  createPurchaseOrderAction,
  initialSuccess,
  productSubtypes,
  products,
  seasons,
  suppliers,
}: InventoryFlowBuilderProps) {
  const [mode, setMode] = useState<InventoryMode>("entry");
  const [supplierId, setSupplierId] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [nextLineId, setNextLineId] = useState(1);
  const [openLineId, setOpenLineId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(Boolean(initialSuccess));
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmedSubmit, setConfirmedSubmit] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setShowSuccess(Boolean(initialSuccess));
  }, [initialSuccess]);

  useEffect(() => {
    if (!supplierId) {
      setLines([]);
      setNextLineId(1);
      setOpenLineId(null);
      return;
    }

    setLines((currentLines) => (currentLines.length === 0 ? [emptyLine(1)] : currentLines));
    setNextLineId((currentId) => (currentId === 1 ? 2 : currentId));
    setOpenLineId((currentOpenId) => currentOpenId ?? 1);
  }, [mode, supplierId]);

  useEffect(() => {
    const lastLine = lines[lines.length - 1];

    if (!lastLine || !isLineCompleted(lastLine)) {
      return;
    }

    setLines((currentLines) => {
      const currentLastLine = currentLines[currentLines.length - 1];

      return currentLastLine && isLineCompleted(currentLastLine)
        ? [...currentLines, emptyLine(nextLineId)]
        : currentLines;
    });
    setNextLineId((currentId) => currentId + 1);
  }, [lines, nextLineId]);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === supplierId) ?? null,
    [supplierId, suppliers],
  );
  const filteredSuppliers = useMemo(() => {
    if (supplierQuery.trim().length === 0) {
      return [];
    }

    return suppliers
      .map((supplier) => ({
        score: getSmartSearchScore(supplierQuery, [
          { value: supplier.name, weight: 5 },
          { value: supplier.supplierCode, weight: 4 },
        ]),
        supplier,
      }))
      .filter((entry) => entry.score !== null)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .map((entry) => entry.supplier)
      .slice(0, 12);
  }, [supplierQuery, suppliers]);

  const supplierProducts = useMemo(
    () => products.filter((product) => product.supplierId === supplierId),
    [products, supplierId],
  );

  const activeLines = useMemo(() => lines.filter((line) => isLineActive(line)), [lines]);

  const summary = useMemo(() => {
    const resolved = activeLines.map((line) => {
      if (line.mode === "existing") {
        const product = supplierProducts.find((entry) => entry.id === line.existingProductId);
        const quantity = Math.max(1, Math.trunc(normalizeNumber(line.quantity) || 1));
        const baseUnitCost = normalizeNumber(line.unitCost || product?.cost || "0");
        const unitCost = getEffectiveUnitCostForUi({
          applyVatToCost: selectedSupplier?.applyVatToCost ?? false,
          productType: product?.productType ?? ProductType.OWNED,
          unitCost: baseUnitCost,
        });
        const hasVatApplied =
          (selectedSupplier?.applyVatToCost ?? false) &&
          (product?.productType ?? ProductType.OWNED) === ProductType.OWNED;

        return {
          hasVatApplied,
          id: line.id,
          title: product ? `${product.code} · ${product.name}` : "Producto existente",
          subtitle: product
            ? `${product.categoryName}${product.productSubtypeName ? ` · ${product.productSubtypeName}` : ""}${product.seasonName ? ` · ${product.seasonName}` : ""} · ${product.supplierName}`
            : "Pendiente de seleccionar",
          quantity,
          unitCost,
          total: quantity * unitCost,
        };
      }

      const quantity = Math.max(1, Math.trunc(normalizeNumber(line.quantity) || 1));
      const baseUnitCost = normalizeNumber(line.unitCost || "0");
      const unitCost = getEffectiveUnitCostForUi({
        applyVatToCost: selectedSupplier?.applyVatToCost ?? false,
        productType: line.newProductType,
        unitCost: baseUnitCost,
      });
      const hasVatApplied =
        (selectedSupplier?.applyVatToCost ?? false) && line.newProductType === ProductType.OWNED;
      const category = categories.find((entry) => entry.id === line.newProductCategoryId);

      return {
        hasVatApplied,
        id: line.id,
        title: line.newProductName || "Nuevo producto",
        subtitle: `${category?.name ?? "Sin categoría"}${line.newProductSubtypeName ? ` · ${line.newProductSubtypeName}` : ""}${line.seasonName ? ` · ${line.seasonName}` : ""} · Alta directa`,
        quantity,
        unitCost,
        total: quantity * unitCost,
      };
    });

    return {
      hasVatApplied: resolved.some((line) => line.hasVatApplied),
      lines: resolved,
      totalUnits: resolved.reduce((acc, line) => acc + line.quantity, 0),
      totalCost: resolved.reduce((acc, line) => acc + line.total, 0),
    };
  }, [activeLines, categories, selectedSupplier?.applyVatToCost, supplierProducts]);

  function updateLine(lineId: number, patch: Partial<DraftLine>) {
    setLines((currentLines) =>
      currentLines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(lineId: number) {
    setLines((currentLines) => {
      const nextLines = currentLines.filter((line) => line.id !== lineId);

      if (nextLines.length === 0 && supplierId) {
        setOpenLineId(1);
        setNextLineId(2);
        return [emptyLine(1)];
      }

      if (openLineId === lineId) {
        setOpenLineId(nextLines[nextLines.length - 1]?.id ?? null);
      }

      return nextLines;
    });
  }

  function setLineMode(lineId: number, nextMode: LineMode) {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId
          ? {
              ...emptyLine(line.id),
              mode: nextMode,
            }
          : line,
      ),
    );
    setOpenLineId(lineId);
  }

  function addManualLine() {
    setLines((currentLines) => [...currentLines, emptyLine(nextLineId)]);
    setOpenLineId(nextLineId);
    setNextLineId((currentId) => currentId + 1);
  }

  function selectExistingProduct(lineId: number, productId: string) {
    const product = supplierProducts.find((entry) => entry.id === productId);

    updateLine(lineId, {
      existingProductId: productId,
      searchQuery: "",
      unitCost: product?.cost ?? "",
      quantity: "1",
    });
    setOpenLineId(lineId);
  }

  function getLineHeading(line: DraftLine) {
    if (line.mode === "existing") {
      const product = supplierProducts.find((entry) => entry.id === line.existingProductId);

      if (product) {
        return {
          title: `${product.code} · ${product.name}`,
          subtitle: `${product.categoryName}${product.productSubtypeName ? ` · ${product.productSubtypeName}` : ""}${product.seasonName ? ` · ${product.seasonName}` : ""} · stock ${product.stockCurrent}`,
        };
      }

      return {
        title: line.searchQuery.trim() ? `Buscar: ${line.searchQuery.trim()}` : "Producto existente",
        subtitle: "Selecciona un producto ya creado del proveedor",
      };
    }

    return {
      title: line.newProductName.trim() || "Nuevo producto",
      subtitle: line.newProductCategoryId
        ? `${categories.find((entry) => entry.id === line.newProductCategoryId)?.name ?? "Sin categoría"}${line.newProductSubtypeName ? ` · ${line.newProductSubtypeName}` : ""}${line.seasonName ? ` · ${line.seasonName}` : ""} · Alta directa`
        : "Completa nombre, categoría y descripción",
    };
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const target = event.target as HTMLElement;

    if (event.key !== "Enter") {
      return;
    }

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement) {
      return;
    }

    event.preventDefault();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmedSubmit) {
      setConfirmedSubmit(false);
      return;
    }

    event.preventDefault();
    setShowConfirm(true);
  }

  const action =
    mode === "order"
      ? createPurchaseOrderAction
      : createInventoryEntryAction;

  return (
    <div className="inventory-builder">
      {showSuccess && initialSuccess ? (
        <div className="inventory-success-modal" role="dialog" aria-modal="true">
          <div className="inventory-success-card">
            <p className="card-label">Operación guardada</p>
            <h2>
              {initialSuccess.type === "entry" ? "Entrada registrada" : "Pedido registrado"}
            </h2>
            <p>
              {initialSuccess.number} se ha guardado correctamente. Puedes registrar otra operación
              o revisar el detalle ahora mismo.
            </p>
            <div className="inventory-success-actions">
              <Link className="button button-primary" href="/inventory-entries">
                Nueva {initialSuccess.type === "entry" ? "entrada" : "operación"}
              </Link>
              <Link
                className="button button-secondary"
                href={
                  initialSuccess.type === "entry"
                    ? `/inventory-entries/${initialSuccess.id}`
                    : `/inventory-entries/orders/${initialSuccess.id}`
                }
              >
                Ver detalle
              </Link>
              {initialSuccess.type === "entry" ? (
                <Link
                  className="button button-secondary"
                  href={`/inventory-entries/${initialSuccess.id}/delivery-note`}
                >
                  Ver albarán
                </Link>
              ) : null}
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setShowSuccess(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="inventory-mode-switch">
        <button
          className={`button ${mode === "entry" ? "button-primary" : "button-secondary"}`}
          type="button"
          onClick={() => setMode("entry")}
        >
          Entrada inmediata
        </button>
        <button
          className={`button ${mode === "order" ? "button-primary" : "button-secondary"}`}
          type="button"
          onClick={() => setMode("order")}
        >
          Pedido futuro
        </button>
        <Link className="button button-secondary" href="/inventory-entries/history">
          Ver histórico
        </Link>
      </div>

      {showConfirm ? (
        <div className="inventory-success-modal" role="dialog" aria-modal="true">
          <div className="inventory-success-card user-create-card">
            <p className="card-label">Confirmar operación</p>
            <h2>{mode === "entry" ? "Registrar entrada" : "Registrar pedido"}</h2>
            <p>
              Vas a guardar {summary.lines.length} líneas, {summary.totalUnits} unidades y un
              coste total estimado de {formatMoney(summary.totalCost)} €.
            </p>
            <div className="inventory-success-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmedSubmit(true);
                  formRef.current?.requestSubmit();
                }}
              >
                Confirmar
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setShowConfirm(false)}
              >
                Revisar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <form ref={formRef} action={action} className="inventory-builder-layout" onKeyDown={handleKeyDown} onSubmit={handleSubmit}>
        <article className="panel sales-top-panel">
          <p className="card-label">
            {mode === "entry" ? "Registrar entrada inmediata" : "Registrar pedido futuro"}
          </p>
          <div className="sales-top-grid">
            <label>
              <span>Buscador de proveedor</span>
              <input
                value={supplierQuery}
                onChange={(event) => setSupplierQuery(event.target.value)}
                placeholder="Busca por nombre..."
                required={!supplierId}
              />
            </label>
            <input type="hidden" name="supplierId" value={supplierId} />

            {supplierQuery.trim().length > 0 && !selectedSupplier ? (
              <div className="full-span sales-search-results">
                {filteredSuppliers.length === 0 ? (
                  <p className="sales-line-caption">No hay proveedores con esa búsqueda.</p>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <button
                      key={supplier.id}
                      className="sales-search-option"
                      type="button"
                      onClick={() => {
                        setSupplierId(supplier.id);
                        setSupplierQuery(supplier.name);
                        setLines([emptyLine(1)]);
                        setNextLineId(2);
                        setOpenLineId(1);
                      }}
                    >
                      <strong>{supplier.name}</strong>
                      <span>Seleccionar proveedor</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {selectedSupplier ? (
              <div className="full-span sales-selected-customer">
                <strong>{selectedSupplier.name}</strong>
                {selectedSupplier.applyVatToCost ? (
                  <span className="sales-line-caption">
                    Este proveedor aplica IVA al coste en producto propio. El beneficio y el gasto
                    usarán coste base x 1,21.
                  </span>
                ) : null}
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setSupplierId("");
                    setSupplierQuery("");
                  }}
                >
                  Cambiar proveedor
                </button>
              </div>
            ) : null}

            <label>
              <span>{mode === "entry" ? "Fecha de entrada" : "Fecha de pedido"}</span>
              <input name="date" type="date" defaultValue={today} required />
            </label>

            {mode === "order" ? (
              <label>
                <span>Fecha estimada llegada</span>
                <input name="expectedDate" type="date" />
              </label>
            ) : null}

            <label className={mode === "order" ? "" : "full-span sales-notes-compact"}>
              <span>Notas</span>
              <textarea name="notes" rows={2} />
            </label>

            <label className="full-span sales-notes-compact">
              <span>Adjuntos</span>
              <input name="attachments" type="file" accept="application/pdf,image/*" multiple />
            </label>

            <div className="inventory-form-actions inventory-form-actions-top">
              <button className="button button-primary" type="submit" disabled={!supplierId}>
                {mode === "entry" ? "Guardar entrada" : "Guardar pedido"}
              </button>
            </div>
          </div>
        </article>

        <div className="module-grid">
          <article className="panel">
            <div className="module-list-header">
              <div>
                <p className="card-label">Producto</p>
                <p>Da de alta nuevo producto o selecciona uno existente del proveedor.</p>
              </div>
            </div>

            {supplierId ? (
              <div className="inventory-lines">
                  {lines.map((line, index) => {
                    const filteredProducts =
                      line.searchQuery.trim().length === 0
                        ? []
                        : supplierProducts
                            .map((product) => ({
                              product,
                              score: getSmartSearchScore(line.searchQuery, [
                                { value: product.code, weight: 5 },
                                { value: product.name, weight: 5 },
                                { value: product.categoryName, weight: 3 },
                                { value: product.productSubtypeName, weight: 3 },
                                { value: product.seasonName, weight: 2 },
                                { value: product.supplierName, weight: 4 },
                                { value: product.searchText, weight: 1 },
                              ]),
                            }))
                            .filter((entry) => entry.score !== null)
                            .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
                            .map((entry) => entry.product)
                            .slice(0, 20);
                    const heading = getLineHeading(line);
                    const quantity = Math.max(1, Math.trunc(normalizeNumber(line.quantity) || 1));
                    const unitCost = normalizeNumber(line.unitCost || "0");
                    const lineTotal = quantity * unitCost;
                    const isOpen =
                      openLineId === line.id ||
                      (openLineId === null && !isLineActive(line) && index === lines.length - 1);
                    const lineSubtypeOptions = productSubtypes.filter(
                      (subtype) => subtype.categoryId === line.newProductCategoryId,
                    );
                    const lineSeasonOptions = seasons.filter(
                      (season) => season.categoryId === line.newProductCategoryId,
                    );

                    return (
                      <div key={line.id} className="inventory-line-accordion">
                        <button
                          className="inventory-line-summary"
                          type="button"
                          onClick={() => setOpenLineId(isOpen ? null : line.id)}
                        >
                          <div>
                            <span className="entry-line-header">Línea {index + 1}</span>
                            <strong>{heading.title}</strong>
                            <p className="sales-line-caption">{heading.subtitle}</p>
                          </div>
                          <div className="inventory-line-summary-meta">
                            <span>{quantity} uds</span>
                            <strong>{formatMoney(lineTotal)} €</strong>
                          </div>
                        </button>

                        <div
                          className={`inventory-line-card ${isOpen ? "" : "inventory-line-card-collapsed"}`}
                          aria-hidden={!isOpen}
                        >
                            <div className="sales-ticket-line-head">
                              <div>
                                <span className="entry-line-header">Producto</span>
                                <p className="sales-line-caption">
                                  Selecciona uno ya creado del proveedor o da de alta uno nuevo.
                                </p>
                              </div>
                              <button
                                className="button button-secondary"
                                type="button"
                                onClick={() => removeLine(line.id)}
                              >
                                Quitar
                              </button>
                            </div>

                            <div className="inventory-line-mode">
                              <button
                                className={`button ${line.mode === "new" ? "button-primary" : "button-secondary"}`}
                                type="button"
                                onClick={() => setLineMode(line.id, "new")}
                              >
                                Nuevo producto
                              </button>
                              <button
                                className={`button ${line.mode === "existing" ? "button-primary" : "button-secondary"}`}
                                type="button"
                                onClick={() => setLineMode(line.id, "existing")}
                              >
                                Producto existente
                              </button>
                            </div>

                            {line.mode === "existing" ? (
                              <div className="inventory-line-grid">
                                <label className="full-span">
                                  <span>Buscador de producto</span>
                                  <input
                                    value={line.searchQuery}
                                    onChange={(event) =>
                                      updateLine(line.id, { searchQuery: event.target.value })
                                    }
                                    placeholder="Código, nombre, categoría..."
                                  />
                                </label>

                                <input
                                  type="hidden"
                                  name="lineExistingProductId"
                                  value={line.existingProductId}
                                />
                                <input type="hidden" name="lineNewProductName" value="" />
                                <input type="hidden" name="lineNewProductDescription" value="" />
                                <input type="hidden" name="lineNewProductCategoryId" value="" />
                                <input type="hidden" name="lineNewProductSubtypeName" value="" />
                                <input type="hidden" name="lineSeasonName" value="" />
                                <input type="hidden" name="lineNewProductBasePrice" value="" />
                                <input
                                  type="hidden"
                                  name="lineNewProductType"
                                  value={ProductType.OWNED}
                                />
                                <input type="hidden" name="lineNewProductSize" value="" />
                                <input type="hidden" name="lineNewProductColor" value="" />

                                {line.searchQuery.trim().length > 0 ? (
                                  <div className="full-span sales-search-results">
                                    {filteredProducts.length === 0 ? (
                                      <p className="sales-line-caption">
                                        No hay productos de ese proveedor con esa búsqueda.
                                      </p>
                                    ) : (
                                      filteredProducts.map((product) => (
                                        <button
                                          key={product.id}
                                          className="sales-search-option"
                                          type="button"
                                          onClick={() => selectExistingProduct(line.id, product.id)}
                                        >
                                          <strong>
                                            {product.code} · {product.name}
                                          </strong>
                                          <span>
                                            {product.categoryName}
                                            {product.productSubtypeName
                                              ? ` · ${product.productSubtypeName}`
                                              : ""}
                                            {product.seasonName ? ` · ${product.seasonName}` : ""}
                                            {" · "}stock {product.stockCurrent} · coste base {product.cost} €
                                          </span>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                ) : null}

                                <div className="full-span sales-search-empty">
                                  <span>
                                    {line.existingProductId
                                      ? supplierProducts.find(
                                          (product) => product.id === line.existingProductId,
                                        )?.name ?? "Producto seleccionado"
                                      : "Empieza a escribir para buscar entre productos ya creados del proveedor."}
                                  </span>
                                </div>

                                <label>
                                  <span>Cantidad</span>
                                  <input
                                    name="lineQuantity"
                                    type="number"
                                    min="1"
                                    value={line.quantity}
                                    onChange={(event) =>
                                      updateLine(line.id, {
                                        quantity: sanitizeIntegerInput(event.target.value),
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>
                                    {mode === "entry"
                                      ? "Coste base unitario"
                                      : "Coste base unitario previsto"}
                                  </span>
                                  <input
                                    name="lineUnitCost"
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.01"
                                    value={line.unitCost}
                                    onChange={(event) =>
                                      updateLine(line.id, {
                                        unitCost: sanitizeNumericInput(event.target.value, {
                                          maxDecimals: 2,
                                        }),
                                      })
                                    }
                                  />
                                </label>
                              </div>
                            ) : (
                              <div className="inventory-line-grid">
                                <input type="hidden" name="lineExistingProductId" value="" />
                                <label>
                                  <span>Nombre producto</span>
                                  <input
                                    name="lineNewProductName"
                                    value={line.newProductName}
                                    onChange={(event) =>
                                      updateLine(line.id, { newProductName: event.target.value })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Categoría</span>
                                  <select
                                    name="lineNewProductCategoryId"
                                    value={line.newProductCategoryId}
                                    onChange={(event) =>
                                      updateLine(line.id, {
                                        newProductCategoryId: event.target.value,
                                      })
                                    }
                                  >
                                    <option value="">Selecciona categoría</option>
                                    {categories.map((category) => (
                                      <option key={category.id} value={category.id}>
                                        {category.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="full-span">
                                  <span>Descripción</span>
                                  <input
                                    name="lineNewProductDescription"
                                    value={line.newProductDescription}
                                    onChange={(event) =>
                                      updateLine(line.id, {
                                        newProductDescription: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                                {lineSubtypeOptions.length > 0 ? (
                                  <label>
                                    <span>Subtipo de prenda</span>
                                    <select
                                      name="lineNewProductSubtypeName"
                                      value={line.newProductSubtypeName}
                                      onChange={(event) =>
                                        updateLine(line.id, {
                                          newProductSubtypeName: event.target.value,
                                        })
                                      }
                                    >
                                      <option value="">Selecciona subtipo</option>
                                      {lineSubtypeOptions.map((subtype) => (
                                        <option key={subtype.id} value={subtype.name}>
                                          {subtype.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : null}
                                {lineSeasonOptions.length > 0 ? (
                                  <label>
                                    <span>Temporada</span>
                                    <select
                                      name="lineSeasonName"
                                      value={line.seasonName}
                                      onChange={(event) =>
                                        updateLine(line.id, { seasonName: event.target.value })
                                      }
                                    >
                                      <option value="">Selecciona temporada</option>
                                      {lineSeasonOptions.map((season) => (
                                        <option key={season.id} value={season.name}>
                                          {season.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : null}
                                <label>
                                  <span>PVP</span>
                                  <input
                                    name="lineNewProductBasePrice"
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.01"
                                    value={line.newProductBasePrice}
                                    onChange={(event) =>
                                      updateLine(line.id, {
                                        newProductBasePrice: sanitizeNumericInput(
                                          event.target.value,
                                          { maxDecimals: 2 },
                                        ),
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Tipo</span>
                                  <select
                                    name="lineNewProductType"
                                    value={line.newProductType}
                                    onChange={(event) =>
                                      updateLine(line.id, {
                                        newProductType:
                                          event.target.value === ProductType.CONSIGNMENT
                                            ? ProductType.CONSIGNMENT
                                            : ProductType.OWNED,
                                      })
                                    }
                                  >
                                    <option value={ProductType.OWNED}>{getProductTypeLabel(ProductType.OWNED)}</option>
                                    <option value={ProductType.CONSIGNMENT}>{getProductTypeLabel(ProductType.CONSIGNMENT)}</option>
                                  </select>
                                </label>
                                {line.newProductType === ProductType.OWNED ? (
                                  <label className="field-lock">
                                    <span>% comisión tienda</span>
                                    <strong>100% fijo para producto propio</strong>
                                  </label>
                                ) : null}
                                <label>
                                  <span>Talla</span>
                                  <input
                                    name="lineNewProductSize"
                                    value={line.newProductSize}
                                    onChange={(event) =>
                                      updateLine(line.id, { newProductSize: event.target.value })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Color</span>
                                  <input
                                    name="lineNewProductColor"
                                    value={line.newProductColor}
                                    onChange={(event) =>
                                      updateLine(line.id, { newProductColor: event.target.value })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Cantidad</span>
                                  <input
                                    name="lineQuantity"
                                    type="number"
                                    min="1"
                                    value={line.quantity}
                                    onChange={(event) =>
                                      updateLine(line.id, {
                                        quantity: sanitizeIntegerInput(event.target.value),
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>
                                    {mode === "entry"
                                      ? "Coste base unitario"
                                      : "Coste base unitario previsto"}
                                  </span>
                                  <input
                                    name="lineUnitCost"
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.01"
                                    value={line.unitCost}
                                    onChange={(event) =>
                                      updateLine(line.id, {
                                        unitCost: sanitizeNumericInput(event.target.value, {
                                          maxDecimals: 2,
                                        }),
                                      })
                                    }
                                  />
                                </label>
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="inventory-form-actions">
                    <button className="button button-secondary" type="button" onClick={addManualLine}>
                      Añadir otra línea
                    </button>
                  </div>
                </div>
              ) : (
                <div className="sales-search-empty">
                  <span>Selecciona primero el proveedor para empezar a cargar mercancía.</span>
                </div>
              )}
          </article>

          <article className="panel">
            <div className="module-list-header">
              <div>
                <p className="card-label">Resumen</p>
                <p>Vista rápida del proveedor, las líneas cargadas y el coste total estimado.</p>
              </div>
            </div>

            <div className="entity-list">
              <article className="entity-card">
                <dl className="entity-meta">
                  <div>
                    <dt>Operación</dt>
                    <dd>{mode === "entry" ? "Entrada inmediata" : "Pedido futuro"}</dd>
                  </div>
                  <div>
                    <dt>Proveedor</dt>
                    <dd>{selectedSupplier?.name ?? "Sin seleccionar"}</dd>
                  </div>
                  <div>
                    <dt>Líneas</dt>
                    <dd>{summary.lines.length}</dd>
                  </div>
                  <div>
                    <dt>Unidades</dt>
                    <dd>{summary.totalUnits}</dd>
                  </div>
                </dl>
                <div className="sales-summary-card">
                  <span>
                    {selectedSupplier?.applyVatToCost
                      ? summary.hasVatApplied
                        ? "Coste total estimado con IVA aplicado"
                        : "Coste total estimado"
                      : "Coste total estimado"}
                  </span>
                  <strong>{formatMoney(summary.totalCost)} €</strong>
                </div>
              </article>

              {summary.lines.map((line) => (
                <article key={line.id} className="entity-card">
                  <div className="entity-card-header">
                    <div>
                      <h3>{line.title}</h3>
                      <p>{line.subtitle}</p>
                    </div>
                    <span className="status-pill status-active">{formatMoney(line.total)} €</span>
                  </div>
                  <dl className="entity-meta">
                    <div>
                      <dt>Cantidad</dt>
                      <dd>{line.quantity}</dd>
                    </div>
                    <div>
                      <dt>Coste unitario</dt>
                      <dd>
                        {formatMoney(line.unitCost)} €{line.hasVatApplied ? " efectivo" : ""}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </article>
        </div>

        <div className="inventory-form-actions">
          <button className="button button-primary" type="submit" disabled={!supplierId}>
            {mode === "entry" ? "Guardar entrada" : "Guardar pedido"}
          </button>
        </div>
      </form>
    </div>
  );
}
