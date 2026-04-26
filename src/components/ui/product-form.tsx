"use client";

import { ProductType } from "@prisma/client";
import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { getProductTypeLabel } from "@/lib/ui/labels";

type SupplierOption = {
  id: string;
  name: string;
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

type ProductFormProps = {
  categories: CategoryOption[];
  formAction: (
    state: { message: string; status: "error" | "idle" | "success" },
    formData: FormData,
  ) => { message: string; status: "error" | "idle" | "success" } | Promise<{
    message: string;
    status: "error" | "idle" | "success";
  }>;
  initialValues?: {
    basePrice?: string;
    categoryId?: string;
    color?: string | null;
    cost?: string;
    description?: string;
    id?: string;
    name?: string;
    notes?: string | null;
    productSubtypeName?: string | null;
    productType?: ProductType;
    seasonName?: string | null;
    size?: string | null;
    stockInitial?: number;
    stockCurrent?: number;
    storeCommissionPct?: string | null;
    supplierId?: string;
  };
  productSubtypes: NameOption[];
  seasons: NameOption[];
  showStockInitial?: boolean;
  showStockCurrent?: boolean;
  submitLabel?: string;
  suppliers: SupplierOption[];
};

const initialFormState = {
  message: "",
  status: "idle" as const,
};

export function ProductForm({
  categories,
  formAction,
  initialValues,
  productSubtypes,
  seasons,
  showStockInitial = true,
  showStockCurrent = false,
  submitLabel = "Guardar producto",
  suppliers,
}: ProductFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [productType, setProductType] = useState<ProductType>(
    initialValues?.productType ?? ProductType.OWNED,
  );
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? "");
  const [state, submitAction, isPending] = useActionState(formAction, initialFormState);
  const visibleSubtypes = productSubtypes.filter((subtype) => subtype.categoryId === categoryId);
  const visibleSeasons = seasons.filter((season) => season.categoryId === categoryId);

  useEffect(() => {
    if (state.status === "idle") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("app-floating-notice", {
        detail: {
          message: state.message,
          status: state.status,
        },
      }),
    );

    if (state.status !== "success") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.refresh();

      const editBlock = formRef.current?.closest("details.entity-edit-block") as HTMLDetailsElement | null;
      if (editBlock) {
        editBlock.open = false;
      }
    }, 1100);

    return () => window.clearTimeout(timeoutId);
  }, [router, state.message, state.status]);

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const target = event.target as HTMLElement;

    if (
      event.key === "Enter" &&
      !(target instanceof HTMLTextAreaElement) &&
      !(target instanceof HTMLButtonElement)
    ) {
      event.preventDefault();
    }
  }

  return (
    <>
      <form ref={formRef} action={submitAction} className="entity-form" onKeyDown={handleKeyDown}>
      {initialValues?.id ? <input type="hidden" name="productId" value={initialValues.id} /> : null}
      <label>
        <span>Nombre</span>
        <input name="name" required defaultValue={initialValues?.name ?? ""} />
      </label>
      <label>
        <span>Descripción</span>
        <input name="description" required defaultValue={initialValues?.description ?? ""} />
      </label>
      <label>
        <span>Categoría</span>
        <select
          name="categoryId"
          required
          defaultValue={initialValues?.categoryId ?? ""}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="" disabled>
            Selecciona una categoría
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      {visibleSubtypes.length > 0 ? (
        <label>
          <span>Subtipo de prenda</span>
          <select
            name="productSubtypeName"
            defaultValue={initialValues?.productSubtypeName ?? ""}
          >
            <option value="">Sin subtipo</option>
            {visibleSubtypes.map((subtype) => (
              <option key={subtype.id} value={subtype.name}>
                {subtype.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="productSubtypeName" value="" />
      )}
      <label>
        <span>Proveedor</span>
        <select name="supplierId" required defaultValue={initialValues?.supplierId ?? ""}>
          <option value="" disabled>
            Selecciona un proveedor
          </option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </label>
      {visibleSeasons.length > 0 ? (
        <label>
          <span>Temporada</span>
          <select name="seasonName" defaultValue={initialValues?.seasonName ?? ""}>
            <option value="">Sin temporada</option>
            {visibleSeasons.map((season) => (
              <option key={season.id} value={season.name}>
                {season.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="seasonName" value="" />
      )}
      <label>
        <span>Tipo</span>
        <select
          name="productType"
          defaultValue={initialValues?.productType ?? ProductType.OWNED}
          onChange={(event) => setProductType(event.target.value as ProductType)}
        >
          <option value={ProductType.OWNED}>{getProductTypeLabel(ProductType.OWNED)}</option>
          <option value={ProductType.CONSIGNMENT}>{getProductTypeLabel(ProductType.CONSIGNMENT)}</option>
        </select>
      </label>
      {showStockInitial ? (
        <label>
          <span>Stock inicial</span>
          <input
            name="stockInitial"
            type="number"
            min="0"
            defaultValue={String(initialValues?.stockInitial ?? 0)}
            required
          />
        </label>
      ) : null}
      {showStockCurrent ? (
        <label>
          <span>Stock actual</span>
          <input
            name="stockCurrent"
            type="number"
            min="0"
            defaultValue={String(initialValues?.stockCurrent ?? 0)}
            required
          />
        </label>
      ) : null}
      <label>
        <span>PVP</span>
        <input
          name="basePrice"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          required
          defaultValue={initialValues?.basePrice ?? ""}
        />
      </label>
      <label>
        <span>Coste</span>
        <input
          name="cost"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          required
          defaultValue={initialValues?.cost ?? ""}
        />
      </label>
      <label>
        <span>Talla</span>
        <input name="size" defaultValue={initialValues?.size ?? ""} />
      </label>
      <label>
        <span>Color</span>
        <input name="color" defaultValue={initialValues?.color ?? ""} />
      </label>
      {productType === ProductType.OWNED ? (
        <label className="field-lock">
          <span>% comisión tienda</span>
          <strong>100% fijo para producto propio</strong>
          <input type="hidden" name="storeCommissionPct" value="100" />
        </label>
      ) : (
        <label>
          <span>% comisión tienda</span>
          <input
            name="storeCommissionPct"
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.01"
            defaultValue={initialValues?.storeCommissionPct ?? "0"}
          />
        </label>
      )}
      <label className="full-span">
        <span>Notas</span>
        <textarea name="notes" rows={4} defaultValue={initialValues?.notes ?? ""} />
      </label>
      <button className="button button-primary" type="submit" disabled={isPending}>
        {submitLabel}
      </button>
      </form>
    </>
  );
}
