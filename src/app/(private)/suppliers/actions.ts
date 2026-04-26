"use server";

import path from "node:path";

import { ConsignmentSettlementMode, StorageFolderType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { ensureUniqueSupplierCode } from "@/lib/catalogs/supplier-code";
import { prisma } from "@/lib/db/prisma";
import { uploadFileToGoogleDriveFolderType } from "@/lib/storage/google-drive-files";
import {
  getOptionalBoolean,
  getOptionalDecimal,
  getOptionalString,
  getRequiredString,
} from "@/lib/utils/form";

async function storeContractFile(file: File | null) {
  if (!file || file.size === 0) {
    return null;
  }

  const extension = path.extname(file.name || "").toLowerCase();

  if (extension !== ".pdf" && file.type !== "application/pdf") {
    throw new Error("Supplier contract must be a PDF");
  }

  const safeBaseName = path
    .basename(file.name, extension)
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  const fileName = `${safeBaseName || "contract"}-${Date.now()}.pdf`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploadedUrl = await uploadFileToGoogleDriveFolderType({
    folderType: StorageFolderType.SUPPLIER_ATTACHMENTS,
    fileName,
    fileBytes: bytes,
    contentType: "application/pdf",
  });

  if (!uploadedUrl) {
    throw new Error("No se pudo obtener URL del contrato en Google Drive");
  }

  return uploadedUrl;
}

function getConsignmentSettlementMode(formData: FormData) {
  return String(formData.get("consignmentSettlementMode")) === ConsignmentSettlementMode.FIXED_COST
    ? ConsignmentSettlementMode.FIXED_COST
    : ConsignmentSettlementMode.PERCENT_COMMISSION;
}

export async function createSupplierAction(formData: FormData) {
  const name = getRequiredString(formData, "name");

  if (!name) {
    throw new Error("Supplier name is required");
  }

  const contractPdfUrl =
    (await storeContractFile(formData.get("contractFile") as File | null)) ??
    getOptionalString(formData, "contractPdfUrl");

  const supplierCode = await ensureUniqueSupplierCode(prisma, {
    supplierName: name,
  });

  await prisma.supplier.create({
    data: {
      name,
      supplierCode,
      applyVatToCost: getOptionalBoolean(formData, "applyVatToCost"),
      consignmentSettlementMode: getConsignmentSettlementMode(formData),
      contactName: getOptionalString(formData, "contactName"),
      phone: getOptionalString(formData, "phone"),
      email: getOptionalString(formData, "email")?.toLowerCase() ?? null,
      defaultStoreCommissionPct: getOptionalDecimal(formData, "defaultStoreCommissionPct"),
      contractPdfUrl,
      notes: getOptionalString(formData, "notes"),
    },
  });

  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
}

export async function updateSupplierAction(formData: FormData) {
  const supplierId = getRequiredString(formData, "supplierId");
  const name = getRequiredString(formData, "name");
  const existingContractPdfUrl = getOptionalString(formData, "existingContractPdfUrl");
  const manualCode = getOptionalString(formData, "supplierCode");

  const uploadedContractPdfUrl = await storeContractFile(formData.get("contractFile") as File | null);
  const supplierCode = await ensureUniqueSupplierCode(prisma, {
    excludeSupplierId: supplierId,
    manualCode,
    supplierName: name,
  });

  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      name,
      supplierCode,
      applyVatToCost: getOptionalBoolean(formData, "applyVatToCost"),
      consignmentSettlementMode: getConsignmentSettlementMode(formData),
      contactName: getOptionalString(formData, "contactName"),
      phone: getOptionalString(formData, "phone"),
      email: getOptionalString(formData, "email")?.toLowerCase() ?? null,
      defaultStoreCommissionPct: getOptionalDecimal(formData, "defaultStoreCommissionPct"),
      contractPdfUrl: uploadedContractPdfUrl ?? existingContractPdfUrl,
      notes: getOptionalString(formData, "notes"),
    },
  });

  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
  revalidatePath("/products");
  revalidatePath("/inventory-entries");
}

export async function toggleSupplierAction(formData: FormData) {
  const supplierId = getRequiredString(formData, "supplierId");
  const nextState = String(formData.get("nextState")) === "true";

  await prisma.supplier.update({
    where: { id: supplierId },
    data: { isActive: nextState },
  });

  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
}
