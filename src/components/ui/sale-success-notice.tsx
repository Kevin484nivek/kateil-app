"use client";

import { useEffect } from "react";

type SaleSuccessNoticeProps = {
  saleNumber: string;
};

export function SaleSuccessNotice({ saleNumber }: SaleSuccessNoticeProps) {
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("app-floating-notice", {
        detail: {
          message: `${saleNumber} se ha registrado correctamente.`,
          status: "success",
        },
      }),
    );

    window.history.replaceState({}, "", "/sales/new");
  }, [saleNumber]);

  return null;
}
