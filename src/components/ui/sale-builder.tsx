"use client";

import { PaymentMethod } from "@prisma/client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { getPaymentMethodLabel } from "@/lib/ui/labels";
import { sanitizeIntegerInput, sanitizeNumericInput } from "@/lib/utils/numeric-input";
import { getSmartSearchScore } from "@/lib/utils/search";

type ProductOption = {
  id: string;
  name: string;
  code: string;
  description: string;
  basePrice: string;
  stockCurrent: number;
  supplierName: string;
  categoryName: string;
  productSubtypeName: string | null;
  seasonName: string | null;
  productType: string;
  size: string | null;
  color: string | null;
  searchText: string;
};

type CustomerOption = {
  id: string;
  name: string;
};

type SaleLineDraft = {
  id: number;
  productId: string;
  quantity: string;
  soldUnitPrice: string;
  lineDiscountPct: string;
};

type ReturnLineDraft = {
  id: number;
  originalSaleLineId: string;
  productId: string;
  quantity: string;
  refundedUnitPrice: string;
};

type OriginalSaleOption = {
  id: string;
  saleNumber: string;
  date: string;
  customerName: string | null;
  lines: Array<{
    saleLineId: string;
    productId: string;
    productName: string;
    productCode: string;
    quantity: number;
    soldUnitPrice: string;
    returnedQuantity: number;
  }>;
};

type SaleBuilderProps = {
  customers: CustomerOption[];
  errorMessage: string | null;
  formAction: (formData: FormData) => void | Promise<void>;
  originalSales: OriginalSaleOption[];
  products: ProductOption[];
};

function normalizeNumber(value: string) {
  const parsed = Number(value.replace(",", "."));

  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function emptyLineFromProduct(id: number, product: ProductOption): SaleLineDraft {
  return {
    id,
    productId: product.id,
    quantity: "1",
    soldUnitPrice: product.basePrice,
    lineDiscountPct: "0",
  };
}

function emptyReturnLineFromOriginalLine(id: number, line: OriginalSaleOption["lines"][number]): ReturnLineDraft {
  const availableQuantity = Math.max(line.quantity - line.returnedQuantity, 0);

  return {
    id,
    originalSaleLineId: line.saleLineId,
    productId: line.productId,
    quantity: availableQuantity > 0 ? "1" : "0",
    refundedUnitPrice: line.soldUnitPrice,
  };
}

export function SaleBuilder({
  customers,
  errorMessage,
  formAction,
  originalSales,
  products,
}: SaleBuilderProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [saleMode, setSaleMode] = useState<"NORMAL" | "RETURN_EXCHANGE">("NORMAL");
  const [lines, setLines] = useState<SaleLineDraft[]>([]);
  const [nextLineId, setNextLineId] = useState(1);
  const [returnLines, setReturnLines] = useState<ReturnLineDraft[]>([]);
  const [nextReturnLineId, setNextReturnLineId] = useState(1);
  const [saleDiscountPct, setSaleDiscountPct] = useState("0");
  const [targetTotalInput, setTargetTotalInput] = useState("");
  const [pricingMode, setPricingMode] = useState<"discount" | "target">("discount");
  const [searchQuery, setSearchQuery] = useState("");
  const [originalSaleQuery, setOriginalSaleQuery] = useState("");
  const [originalSaleLineQuery, setOriginalSaleLineQuery] = useState("");
  const [selectedOriginalSaleId, setSelectedOriginalSaleId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [createCustomerInline, setCreateCustomerInline] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const customerMap = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const originalSaleMap = useMemo(
    () => new Map(originalSales.map((sale) => [sale.id, sale])),
    [originalSales],
  );

  const reservedQuantities = useMemo(() => {
    const reserved = new Map<string, number>();

    for (const line of lines) {
      const quantity = Math.max(1, Math.trunc(normalizeNumber(line.quantity) || 1));
      reserved.set(line.productId, (reserved.get(line.productId) ?? 0) + quantity);
    }

    return reserved;
  }, [lines]);

  const summary = useMemo(() => {
    const globalDiscountPct = normalizeNumber(saleDiscountPct);

    const computedLines = lines
      .map((line) => {
        const product = productMap.get(line.productId);

        if (!product) {
          return null;
        }

        const quantity = Math.max(1, Math.trunc(normalizeNumber(line.quantity) || 1));
        const soldUnitPrice =
          line.soldUnitPrice.trim().length === 0 ? 0 : normalizeNumber(line.soldUnitPrice);
        const lineDiscountPct = Math.min(100, Math.max(0, normalizeNumber(line.lineDiscountPct)));
        const grossSubtotal = soldUnitPrice * quantity;
        const lineDiscountAmount = grossSubtotal * (lineDiscountPct / 100);
        const subtotalAfterLineDiscount = grossSubtotal - lineDiscountAmount;
        const globalDiscountAmount = subtotalAfterLineDiscount * (globalDiscountPct / 100);
        const finalSubtotal = subtotalAfterLineDiscount - globalDiscountAmount;

        return {
          id: line.id,
          product,
          quantity,
          soldUnitPrice,
          lineDiscountAmount,
          lineDiscountPct,
          finalSubtotal,
          globalDiscountAmount,
          grossSubtotal,
          subtotalAfterLineDiscount,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    const grossTotal = computedLines.reduce((acc, line) => acc + line.grossSubtotal, 0);
    const lineDiscountTotal = computedLines.reduce((acc, line) => acc + line.lineDiscountAmount, 0);
    const subtotalAfterLineDiscountTotal = computedLines.reduce(
      (acc, line) => acc + line.subtotalAfterLineDiscount,
      0,
    );
    const globalDiscountTotal = computedLines.reduce(
      (acc, line) => acc + line.globalDiscountAmount,
      0,
    );
    const total = computedLines.reduce((acc, line) => acc + line.finalSubtotal, 0);

    return {
      globalDiscountPct,
      globalDiscountTotal,
      grossTotal,
      lineDiscountTotal,
      lines: computedLines,
      subtotalAfterLineDiscountTotal,
      total,
      totalUnits: computedLines.reduce((acc, line) => acc + line.quantity, 0),
    };
  }, [lines, productMap, saleDiscountPct]);

  useEffect(() => {
    if (pricingMode !== "target" || targetTotalInput.trim().length === 0) {
      return;
    }

    const desiredTotal = normalizeNumber(targetTotalInput);
    const baseTotal = summary.subtotalAfterLineDiscountTotal;

    if (baseTotal <= 0) {
      setSaleDiscountPct("0");
      return;
    }

    const nextDiscountPct = Math.min(
      100,
      Math.max(0, Number((((baseTotal - desiredTotal) / baseTotal) * 100).toFixed(2))),
    );
    setSaleDiscountPct(String(nextDiscountPct));
  }, [pricingMode, summary.subtotalAfterLineDiscountTotal, targetTotalInput]);

  function updateGlobalDiscountFromTarget(nextValue: string) {
    setPricingMode("target");
    setTargetTotalInput(nextValue);

    if (nextValue.trim().length === 0) {
      return;
    }

    const desiredTotal = normalizeNumber(nextValue);
    const baseTotal = summary.subtotalAfterLineDiscountTotal;

    if (baseTotal <= 0) {
      setSaleDiscountPct("0");
      return;
    }

    const nextDiscountPct = Math.min(
      100,
      Math.max(0, Number((((baseTotal - desiredTotal) / baseTotal) * 100).toFixed(2))),
    );
    setSaleDiscountPct(String(nextDiscountPct));
  }

  function updateDiscountPct(nextValue: string) {
    setPricingMode("discount");
    setTargetTotalInput("");
    setSaleDiscountPct(nextValue);
  }

  const displayedTargetTotal =
    pricingMode === "target" ? targetTotalInput : (summary.lines.length > 0 ? formatMoney(summary.total) : "");

  const filteredProducts = useMemo(() => {
    if (searchQuery.trim().length === 0) {
      return [];
    }

    return products
      .map((product) => ({
        product,
        score: getSmartSearchScore(searchQuery, [
          { value: product.code, weight: 5 },
          { value: product.name, weight: 5 },
          { value: product.supplierName, weight: 4 },
          { value: product.categoryName, weight: 3 },
          { value: product.productSubtypeName, weight: 3 },
          { value: product.seasonName, weight: 2 },
          { value: product.productType, weight: 2 },
          { value: product.size, weight: 2 },
          { value: product.color, weight: 2 },
          { value: product.description, weight: 1 },
          { value: product.searchText, weight: 1 },
        ]),
      }))
      .filter((entry) => entry.score !== null)
      .filter((product) => {
        const reserved = reservedQuantities.get(product.product.id) ?? 0;

        return product.product.stockCurrent - reserved > 0;
      })
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .map((entry) => entry.product)
      .slice(0, 20);
  }, [products, reservedQuantities, searchQuery]);

  const filteredCustomers = useMemo(() => {
    if (customerQuery.trim().length === 0) {
      return [];
    }

    return customers
      .map((customer) => ({
        customer,
        score: getSmartSearchScore(customerQuery, [{ value: customer.name, weight: 5 }]),
      }))
      .filter((entry) => entry.score !== null)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .map((entry) => entry.customer)
      .slice(0, 12);
  }, [customerQuery, customers]);

  const selectedOriginalSale = useMemo(
    () => originalSaleMap.get(selectedOriginalSaleId) ?? null,
    [originalSaleMap, selectedOriginalSaleId],
  );

  const filteredOriginalSales = useMemo(() => {
    if (originalSaleQuery.trim().length === 0) {
      return [];
    }

    return originalSales
      .map((sale) => ({
        sale,
        score: getSmartSearchScore(originalSaleQuery, [
          { value: sale.saleNumber, weight: 5 },
          { value: sale.customerName, weight: 4 },
        ]),
      }))
      .filter((entry) => entry.score !== null)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .map((entry) => entry.sale)
      .slice(0, 12);
  }, [originalSaleQuery, originalSales]);

  const filteredOriginalSaleLines = useMemo(() => {
    if (!selectedOriginalSale) {
      return [];
    }

    const reservedByOriginalLine = new Map(
      returnLines.map((line) => [line.originalSaleLineId, Math.max(0, Math.trunc(normalizeNumber(line.quantity)))]),
    );
    const normalizedQuery = originalSaleLineQuery.trim().toLowerCase();

    return selectedOriginalSale.lines
      .filter((line) => {
        const availableQuantity = line.quantity - line.returnedQuantity - (reservedByOriginalLine.get(line.saleLineId) ?? 0);

        return availableQuantity > 0;
      })
      .filter((line) => {
        if (!normalizedQuery) {
          return true;
        }

        return [line.productCode, line.productName].join(" ").toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 20);
  }, [originalSaleLineQuery, returnLines, selectedOriginalSale]);

  const returnSummary = useMemo(() => {
    const selectedSale = selectedOriginalSale;

    if (!selectedSale) {
      return {
        lines: [] as Array<{
          id: number;
          quantity: number;
          subtotal: number;
          refundedUnitPrice: number;
          title: string;
        }>,
        total: 0,
      };
    }

    const lineMap = new Map(selectedSale.lines.map((line) => [line.saleLineId, line]));
    const computed = returnLines
      .map((line) => {
        const originalLine = lineMap.get(line.originalSaleLineId);

        if (!originalLine) {
          return null;
        }

        const quantity = Math.max(1, Math.trunc(normalizeNumber(line.quantity) || 1));
        const refundedUnitPrice =
          line.refundedUnitPrice.trim().length === 0 ? Number(originalLine.soldUnitPrice) : normalizeNumber(line.refundedUnitPrice);
        const subtotal = quantity * refundedUnitPrice;

        return {
          id: line.id,
          title: `${originalLine.productCode} · ${originalLine.productName}`,
          quantity,
          refundedUnitPrice,
          subtotal,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    return {
      lines: computed,
      total: computed.reduce((acc, line) => acc + line.subtotal, 0),
    };
  }, [returnLines, selectedOriginalSale]);

  const netTotal = summary.total - returnSummary.total;

  function updateLine(lineId: number, patch: Partial<SaleLineDraft>) {
    setLines((currentLines) =>
      currentLines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    );
  }

  useEffect(() => {
    if (saleMode === "NORMAL") {
      setReturnLines([]);
      setNextReturnLineId(1);
      setOriginalSaleQuery("");
      setOriginalSaleLineQuery("");
      setSelectedOriginalSaleId("");
    }
  }, [saleMode]);

  function addProductToSale(product: ProductOption) {
    const existingLine = lines.find((line) => line.productId === product.id);
    const reserved = reservedQuantities.get(product.id) ?? 0;

    if (reserved >= product.stockCurrent) {
      return;
    }

    if (existingLine) {
      const currentQuantity = Math.max(1, Math.trunc(normalizeNumber(existingLine.quantity) || 1));

      updateLine(existingLine.id, { quantity: String(currentQuantity + 1) });
    } else {
      setLines((currentLines) => [...currentLines, emptyLineFromProduct(nextLineId, product)]);
      setNextLineId((currentId) => currentId + 1);
    }

    setSearchQuery("");
  }

  function removeLine(lineId: number) {
    setLines((currentLines) => currentLines.filter((line) => line.id !== lineId));
  }

  function addReturnLineFromOriginalLine(line: OriginalSaleOption["lines"][number]) {
    const existing = returnLines.find((item) => item.originalSaleLineId === line.saleLineId);

    if (existing) {
      const currentQuantity = Math.max(1, Math.trunc(normalizeNumber(existing.quantity) || 1));
      const maxAllowed = Math.max(line.quantity - line.returnedQuantity, 1);
      const nextQuantity = Math.min(maxAllowed, currentQuantity + 1);
      setReturnLines((current) =>
        current.map((entry) =>
          entry.id === existing.id
            ? {
                ...entry,
                quantity: String(nextQuantity),
              }
            : entry,
        ),
      );
      return;
    }

    setReturnLines((current) => [...current, emptyReturnLineFromOriginalLine(nextReturnLineId, line)]);
    setNextReturnLineId((currentId) => currentId + 1);
  }

  function updateReturnLine(lineId: number, patch: Partial<ReturnLineDraft>) {
    setReturnLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    );
  }

  function removeReturnLine(lineId: number) {
    setReturnLines((current) => current.filter((line) => line.id !== lineId));
  }

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const target = event.target as HTMLElement;

    if (event.key !== "Enter") {
      return;
    }

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement) {
      return;
    }

    event.preventDefault();
  }

  function dispatchFloatingNotice(message: string, status: "error" | "success") {
    window.dispatchEvent(
      new CustomEvent("app-floating-notice", {
        detail: { message, status },
      }),
    );
  }

  function openConfirmModal() {
    if (summary.lines.length === 0 && returnSummary.lines.length === 0) {
      dispatchFloatingNotice("Añade al menos una línea de venta o devolución antes de confirmar.", "error");
      return;
    }

    if (saleMode === "RETURN_EXCHANGE" && !selectedOriginalSaleId) {
      dispatchFloatingNotice("Selecciona el ticket original para procesar la devolución.", "error");
      return;
    }

    setShowConfirmModal(true);
  }

  function confirmSaleSubmission() {
    setShowConfirmModal(false);
    formRef.current?.requestSubmit(submitButtonRef.current ?? undefined);
  }

  const selectedCustomer = selectedCustomerId ? customerMap.get(selectedCustomerId) ?? null : null;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="sales-builder-layout"
      onKeyDown={handleFormKeyDown}
    >
      <input type="hidden" name="saleMode" value={saleMode} />
      <input type="hidden" name="originalSaleId" value={selectedOriginalSaleId} />
      {returnLines.map((line) => (
        <div key={`return-hidden-${line.id}`}>
          <input type="hidden" name="returnLineSaleLineId" value={line.originalSaleLineId} />
          <input type="hidden" name="returnLineProductId" value={line.productId} />
          <input type="hidden" name="returnLineQuantity" value={line.quantity} />
          <input type="hidden" name="returnLineUnitPrice" value={line.refundedUnitPrice} />
        </div>
      ))}
      {showConfirmModal ? (
        <div className="inventory-success-modal" role="dialog" aria-modal="true">
          <div className="inventory-success-card sale-confirm-card">
            <p className="card-label">Confirmar venta</p>
            <h2>
              {saleMode === "RETURN_EXCHANGE" ? "Revisa el cambio/devolución" : "Revisa el ticket antes de cerrar"}
            </h2>
            <div className="sale-confirm-summary">
              {summary.lines.map((line) => (
                <div key={line.id} className="sale-confirm-row">
                  <div>
                    <strong>{line.product.name}</strong>
                    <span>
                      {line.quantity} uds · {formatMoney(line.soldUnitPrice)} € · desc. línea{" "}
                      {line.lineDiscountPct}%
                    </span>
                  </div>
                  <strong>{formatMoney(line.finalSubtotal)} €</strong>
                </div>
              ))}
              {returnSummary.lines.map((line) => (
                <div key={`return-${line.id}`} className="sale-confirm-row">
                  <div>
                    <strong>{line.title}</strong>
                    <span>
                      {line.quantity} uds devueltas · {formatMoney(line.refundedUnitPrice)} €
                    </span>
                  </div>
                  <strong>-{formatMoney(line.subtotal)} €</strong>
                </div>
              ))}
            </div>
            <dl className="entity-meta sale-confirm-totals">
              <div>
                <dt>Productos</dt>
                <dd>{summary.lines.length}</dd>
              </div>
              <div>
                <dt>Unidades</dt>
                <dd>{summary.totalUnits}</dd>
              </div>
              <div>
                <dt>Desc. líneas</dt>
                <dd>{formatMoney(summary.lineDiscountTotal)} €</dd>
              </div>
              <div>
                <dt>Desc. global</dt>
                <dd>{formatMoney(summary.globalDiscountTotal)} €</dd>
              </div>
              <div>
                <dt>Total final</dt>
                <dd>{formatMoney(netTotal)} €</dd>
              </div>
              <div>
                <dt>Total devolución</dt>
                <dd>{formatMoney(returnSummary.total)} €</dd>
              </div>
            </dl>
            <div className="inventory-success-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setShowConfirmModal(false)}
              >
                Volver al ticket
              </button>
              <button className="button button-primary" type="button" onClick={confirmSaleSubmission}>
                Confirmar compra
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <article className="panel sales-top-panel">
        <p className="card-label">Registrar venta</p>
        <div className="sales-top-grid">
          <section className="sales-form-section">
            <div className="sales-form-section-head">
              <div>
                <p className="card-label">Clienta</p>
                <p className="sales-line-caption">
                  Busca una clienta existente o crea una nueva sin salir de la venta.
                </p>
              </div>
            </div>

            <div className="module-chip-row full-span">
              <button
                className={`button ${saleMode === "NORMAL" ? "button-primary" : "button-secondary"}`}
                type="button"
                onClick={() => setSaleMode("NORMAL")}
              >
                Venta normal
              </button>
              <button
                className={`button ${saleMode === "RETURN_EXCHANGE" ? "button-primary" : "button-secondary"}`}
                type="button"
                onClick={() => setSaleMode("RETURN_EXCHANGE")}
              >
                Devolución / cambio
              </button>
            </div>

            <input type="hidden" name="customerId" value={selectedCustomerId} />

            <label className="full-span">
              <span>Buscador de clienta</span>
              <input
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                placeholder="Busca por nombre..."
              />
            </label>

            {customerQuery.trim().length > 0 ? (
              <div className="full-span sales-search-results">
                {filteredCustomers.length === 0 ? (
                  <p className="sales-line-caption">No hay clientas con esa búsqueda.</p>
                ) : (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      className="sales-search-option"
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        setCustomerQuery(customer.name);
                        setCreateCustomerInline(false);
                      }}
                    >
                      <strong>{customer.name}</strong>
                      <span>Seleccionar clienta existente</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {selectedCustomer ? (
              <div className="full-span sales-selected-customer">
                <strong>{selectedCustomer.name}</strong>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId("");
                    setCustomerQuery("");
                  }}
                >
                  Quitar clienta
                </button>
              </div>
            ) : null}

            {saleMode === "RETURN_EXCHANGE" ? (
              <div className="full-span entity-card">
                <p className="card-label">Ticket original</p>
                <label className="full-span">
                  <span>Buscar ticket</span>
                  <input
                    value={originalSaleQuery}
                    onChange={(event) => setOriginalSaleQuery(event.target.value)}
                    placeholder="Número ticket o clienta..."
                  />
                </label>
                {originalSaleQuery.trim().length > 0 && !selectedOriginalSale ? (
                  <div className="sales-search-results">
                    {filteredOriginalSales.length === 0 ? (
                      <p className="sales-line-caption">No hay tickets con esa búsqueda.</p>
                    ) : (
                      filteredOriginalSales.map((sale) => (
                        <button
                          key={sale.id}
                          className="sales-search-option"
                          type="button"
                          onClick={() => {
                            setSelectedOriginalSaleId(sale.id);
                            setOriginalSaleQuery(`${sale.saleNumber}${sale.customerName ? ` · ${sale.customerName}` : ""}`);
                            setReturnLines([]);
                            setNextReturnLineId(1);
                            setOriginalSaleLineQuery("");
                          }}
                        >
                          <strong>{sale.saleNumber}</strong>
                          <span>
                            {new Date(sale.date).toLocaleDateString("es-ES")} ·{" "}
                            {sale.customerName ?? "Sin cliente"} · {sale.lines.length} líneas
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
                {selectedOriginalSale ? (
                  <div className="sales-selected-customer">
                    <strong>
                      {selectedOriginalSale.saleNumber} ·{" "}
                      {new Date(selectedOriginalSale.date).toLocaleDateString("es-ES")}
                    </strong>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => {
                        setSelectedOriginalSaleId("");
                        setOriginalSaleQuery("");
                        setReturnLines([]);
                        setNextReturnLineId(1);
                        setOriginalSaleLineQuery("");
                      }}
                    >
                      Cambiar ticket
                    </button>
                  </div>
                ) : null}
                {selectedOriginalSale ? (
                  <>
                    <label className="full-span">
                      <span>Buscar producto en ticket</span>
                      <input
                        value={originalSaleLineQuery}
                        onChange={(event) => setOriginalSaleLineQuery(event.target.value)}
                        placeholder="Código o nombre..."
                      />
                    </label>
                    <div className="sales-search-results">
                      {filteredOriginalSaleLines.length === 0 ? (
                        <p className="sales-line-caption">
                          No hay más líneas devolvibles en este ticket.
                        </p>
                      ) : (
                        filteredOriginalSaleLines.map((line) => {
                          const available = line.quantity - line.returnedQuantity;

                          return (
                            <button
                              key={line.saleLineId}
                              className="sales-search-option"
                              type="button"
                              onClick={() => addReturnLineFromOriginalLine(line)}
                            >
                              <strong>
                                {line.productCode} · {line.productName}
                              </strong>
                              <span>
                                Vendidas: {line.quantity} · Ya devueltas: {line.returnedQuantity} · Disponibles: {available}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                    {returnSummary.lines.length > 0 ? (
                      <div className="sales-ticket-lines">
                        {returnSummary.lines.map((line) => {
                          const draft = returnLines.find((item) => item.id === line.id);
                          const sourceLine = selectedOriginalSale.lines.find(
                            (item) => item.saleLineId === draft?.originalSaleLineId,
                          );
                          const maxQuantity = sourceLine
                            ? Math.max(sourceLine.quantity - sourceLine.returnedQuantity, 1)
                            : 1;

                          return (
                            <div key={`return-line-${line.id}`} className="sales-ticket-line">
                              <div className="sales-ticket-line-head">
                                <div>
                                  <strong>{line.title}</strong>
                                  <span>Subtotal devolución: -{formatMoney(line.subtotal)} €</span>
                                </div>
                                <button
                                  className="button button-secondary"
                                  type="button"
                                  onClick={() => removeReturnLine(line.id)}
                                >
                                  Quitar
                                </button>
                              </div>
                              <div className="sales-ticket-line-grid">
                                <label>
                                  <span>Cantidad devuelta</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max={maxQuantity}
                                    value={draft?.quantity ?? "1"}
                                    onChange={(event) =>
                                      updateReturnLine(line.id, {
                                        quantity: sanitizeIntegerInput(event.target.value),
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Precio devolución</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={draft?.refundedUnitPrice ?? "0"}
                                    onChange={(event) =>
                                      updateReturnLine(line.id, {
                                        refundedUnitPrice: sanitizeNumericInput(event.target.value, {
                                          maxDecimals: 2,
                                        }),
                                      })
                                    }
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="full-span sales-customer-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setCreateCustomerInline((current) => !current)}
              >
                {createCustomerInline ? "Cancelar nueva clienta" : "Crear nueva clienta"}
              </button>
            </div>

            {createCustomerInline ? (
              <>
                <label>
                  <span>Nombre clienta</span>
                  <input name="newCustomerName" />
                </label>
                <label>
                  <span>Teléfono</span>
                  <input name="newCustomerPhone" />
                </label>
                <label>
                  <span>Email</span>
                  <input name="newCustomerEmail" type="email" />
                </label>
                <label className="full-span">
                  <span>Notas clienta</span>
                  <textarea name="newCustomerNotes" rows={2} />
                </label>
              </>
            ) : (
              <>
                <input type="hidden" name="newCustomerName" value="" />
                <input type="hidden" name="newCustomerPhone" value="" />
                <input type="hidden" name="newCustomerEmail" value="" />
                <input type="hidden" name="newCustomerNotes" value="" />
              </>
            )}
          </section>

          <section className="sales-form-section">
            <div className="sales-form-section-head">
              <div>
                <p className="card-label">Venta</p>
                <p className="sales-line-caption">
                  Configura descuentos, pago y notas antes de confirmar.
                </p>
              </div>
            </div>

            <div className="sales-sale-grid">
              <div className="sales-sale-stack">
                <label>
                  <span>Forma de pago</span>
                  <select name="paymentMethod" defaultValue={PaymentMethod.CARD}>
                    <option value={PaymentMethod.CASH}>{getPaymentMethodLabel(PaymentMethod.CASH)}</option>
                    <option value={PaymentMethod.CARD}>{getPaymentMethodLabel(PaymentMethod.CARD)}</option>
                    <option value={PaymentMethod.BIZUM}>{getPaymentMethodLabel(PaymentMethod.BIZUM)}</option>
                  </select>
                </label>

                <label>
                  <span>% descuento global</span>
                  <input
                    name="saleDiscountPct"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    value={saleDiscountPct}
                    onChange={(event) =>
                      updateDiscountPct(
                        sanitizeNumericInput(event.target.value, { maxDecimals: 2 }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Precio final deseado</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={displayedTargetTotal}
                    onChange={(event) =>
                      updateGlobalDiscountFromTarget(
                        sanitizeNumericInput(event.target.value, { maxDecimals: 2 }),
                      )
                    }
                  />
                </label>
              </div>

              <div className="sales-sale-stack">
                <label className="sales-notes-compact">
                  <span>Notas</span>
                  <textarea name="notes" rows={2} />
                </label>

                <div className="sales-summary-card">
                  <span>{saleMode === "RETURN_EXCHANGE" ? "Saldo neto estimado" : "Total estimado"}</span>
                  <strong>{formatMoney(netTotal)} €</strong>
                </div>
              </div>
            </div>
          </section>

          {errorMessage ? <p className="form-error full-span">{errorMessage}</p> : null}

          <div className="sales-submit-slot sales-submit-slot-left">
            <button className="button button-primary" type="button" onClick={openConfirmModal}>
              Revisar y confirmar
            </button>
          </div>
          <button ref={submitButtonRef} type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </div>
      </article>

      <div className="module-grid">
        <article className="panel">
          <div className="module-list-header">
            <div>
              <p className="card-label">Productos seleccionados</p>
              <p>Busca arriba, añade al ticket y ajusta aquí cantidades, PVP y descuentos.</p>
            </div>
            <span className="module-meta">{summary.lines.length} líneas</span>
          </div>

          <label className="full-span">
            <span>Buscador de productos</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Código, nombre, descripción, proveedor o categoría..."
            />
          </label>

          {searchQuery.trim().length > 0 ? (
            <div className="full-span sales-search-results">
              {filteredProducts.length === 0 ? (
                <p className="sales-line-caption">No hay coincidencias disponibles con esa búsqueda.</p>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    className="sales-search-option"
                    type="button"
                    onClick={() => addProductToSale(product)}
                  >
                    <strong>
                      {product.code} · {product.name}
                    </strong>
                    <span>
                      {product.categoryName}
                      {product.productSubtypeName ? ` · ${product.productSubtypeName}` : ""}
                      {product.seasonName ? ` · ${product.seasonName}` : ""}
                      {" · "}
                      {product.supplierName} · stock {product.stockCurrent}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}

          <div className="sales-ticket">
            {summary.lines.length === 0 ? (
              <div className="sales-search-empty">
                <span>Empieza a escribir en el buscador superior para añadir productos al ticket.</span>
              </div>
            ) : (
              <div className="sales-ticket-lines">
                {summary.lines.map((line) => (
                  <div key={line.id} className="sales-ticket-line">
                    <input type="hidden" name="lineProductId" value={line.product.id} />
                    <div className="sales-ticket-line-head">
                      <div>
                        <strong>
                          {line.product.code} · {line.product.name}
                        </strong>
                        <span>
                          {line.product.categoryName}
                          {line.product.productSubtypeName
                            ? ` · ${line.product.productSubtypeName}`
                            : ""}
                          {line.product.seasonName ? ` · ${line.product.seasonName}` : ""}
                          {" · "}
                          {line.product.supplierName} · stock {line.product.stockCurrent}
                        </span>
                      </div>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => removeLine(line.id)}
                      >
                        Quitar
                      </button>
                    </div>

                    <div className="sales-ticket-line-grid">
                      <label>
                        <span>Cantidad</span>
                        <input
                          name="lineQuantity"
                          type="number"
                          min="1"
                          max={line.product.stockCurrent}
                          value={lines.find((draft) => draft.id === line.id)?.quantity ?? String(line.quantity)}
                          onChange={(event) =>
                            updateLine(line.id, {
                              quantity: sanitizeIntegerInput(event.target.value),
                            })
                          }
                        />
                      </label>

                      <label>
                        <span>PVP aplicado</span>
                        <input
                          name="lineSoldUnitPrice"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={
                            lines.find((draft) => draft.id === line.id)?.soldUnitPrice ??
                            String(line.soldUnitPrice)
                          }
                          onChange={(event) =>
                            updateLine(line.id, {
                              soldUnitPrice: sanitizeNumericInput(event.target.value, {
                                maxDecimals: 2,
                              }),
                            })
                          }
                        />
                      </label>

                      <label>
                        <span>% descuento línea</span>
                        <input
                          name="lineDiscountPct"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="100"
                          step="0.01"
                          value={
                            lines.find((draft) => draft.id === line.id)?.lineDiscountPct ??
                            String(line.lineDiscountPct)
                          }
                          onChange={(event) =>
                            updateLine(line.id, {
                              lineDiscountPct: sanitizeNumericInput(event.target.value, {
                                maxDecimals: 2,
                              }),
                            })
                          }
                        />
                      </label>

                      <div className="sales-line-preview">
                        <span>Subtotal línea</span>
                        <strong>{formatMoney(line.finalSubtotal)} €</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="module-list-header">
          <div>
            <p className="card-label">Resumen de ticket</p>
            <p>
              Aquí ves importes, unidades y el impacto real de descuentos por línea y globales.
            </p>
          </div>
          </div>

          <div className="entity-list">
          <article className="entity-card">
            <dl className="entity-meta">
              <div>
                <dt>Productos</dt>
                <dd>{summary.lines.length}</dd>
              </div>
              <div>
                <dt>Unidades</dt>
                <dd>{summary.totalUnits}</dd>
              </div>
              <div>
                <dt>Subtotal bruto</dt>
                <dd>{formatMoney(summary.grossTotal)} €</dd>
              </div>
              <div>
                <dt>Desc. líneas</dt>
                <dd>{formatMoney(summary.lineDiscountTotal)} €</dd>
              </div>
              <div>
                <dt>Desc. global</dt>
                <dd>
                  {formatMoney(summary.globalDiscountTotal)} €{" "}
                  {summary.globalDiscountPct > 0 ? `(${summary.globalDiscountPct}%)` : ""}
                </dd>
              </div>
              <div>
                <dt>Total devolución</dt>
                <dd>{formatMoney(returnSummary.total)} €</dd>
              </div>
              <div>
                <dt>Total final</dt>
                <dd>{formatMoney(netTotal)} €</dd>
              </div>
            </dl>
          </article>

          {summary.lines.length === 0 ? (
            <article className="entity-card">
              <p className="entity-notes">
                Aquí verás el resumen limpio de la venta conforme vayas añadiendo productos.
              </p>
            </article>
          ) : (
            summary.lines.map((line) => (
              <article key={line.id} className="entity-card">
                <div className="entity-card-header">
                  <div>
                    <h3>{line.product.name}</h3>
                    <p>
                      {line.product.code} · {line.product.categoryName}
                      {line.product.productSubtypeName
                        ? ` · ${line.product.productSubtypeName}`
                        : ""}
                      {line.product.seasonName ? ` · ${line.product.seasonName}` : ""}
                      {" · "}
                      {line.product.supplierName}
                    </p>
                  </div>
                  <span className="status-pill status-active">
                    {formatMoney(line.finalSubtotal)} €
                  </span>
                </div>
                <dl className="entity-meta">
                  <div>
                    <dt>Cantidad</dt>
                    <dd>{line.quantity}</dd>
                  </div>
                  <div>
                    <dt>PVP</dt>
                    <dd>{formatMoney(line.soldUnitPrice)} €</dd>
                  </div>
                  <div>
                    <dt>Desc. línea</dt>
                    <dd>{formatMoney(line.lineDiscountAmount)} €</dd>
                  </div>
                  <div>
                    <dt>Desc. global</dt>
                    <dd>{formatMoney(line.globalDiscountAmount)} €</dd>
                  </div>
                </dl>
              </article>
            ))
          )}
          </div>
        </article>
      </div>
    </form>
  );
}
