"use client";

import { useState } from "react";

type SaleSuccessOverlayProps = {
  saleId: string;
  saleNumber: string;
};

export function SaleSuccessOverlay({ saleId, saleNumber }: SaleSuccessOverlayProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="inventory-success-modal" role="dialog" aria-modal="true">
      <div className="inventory-success-card">
        <p className="card-label">Venta registrada</p>
        <h2>Venta confirmada</h2>
        <p>
          {saleNumber} se ha guardado correctamente. Confirma desde aquí qué quieres hacer a
          continuación.
        </p>
        <div className="inventory-success-actions">
          <a className="button button-primary" href="/sales/new">
            Nueva venta
          </a>
          <a className="button button-secondary" href={`/sales/history/${saleId}?created=1`}>
            Ver detalle
          </a>
          <button className="button button-secondary" type="button" onClick={() => setIsOpen(false)}>
            Seguir aquí
          </button>
        </div>
      </div>
    </div>
  );
}
