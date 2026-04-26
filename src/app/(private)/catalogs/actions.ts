"use server";

import { revalidatePath } from "next/cache";

import { requireUserSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertModuleAccess } from "@/lib/platform/modules";
import { getRequiredString } from "@/lib/utils/form";

async function createCatalogEntry(kind: "category" | "productSubtype" | "season", name: string) {
  if (!name.trim()) {
    throw new Error("El nombre es obligatorio");
  }

  const cleanName = name.trim();

  if (kind === "category") {
    await prisma.category.upsert({
      where: { name: cleanName },
      update: { isActive: true },
      create: { name: cleanName },
    });
    return;
  }

  throw new Error("Solo las categorías pueden crearse sin categoría padre");
}

async function createCategoryChild(kind: "productSubtype" | "season", categoryId: string, name: string) {
  if (!name.trim()) {
    throw new Error("El nombre es obligatorio");
  }

  const cleanName = name.trim();

  if (kind === "productSubtype") {
    await prisma.productSubtype.upsert({
      where: {
        categoryId_name: {
          categoryId,
          name: cleanName,
        },
      },
      update: { isActive: true },
      create: {
        categoryId,
        name: cleanName,
      },
    });
    return;
  }

  await prisma.season.upsert({
    where: {
      categoryId_name: {
        categoryId,
        name: cleanName,
      },
    },
    update: { isActive: true },
    create: {
      categoryId,
      name: cleanName,
    },
  });
}

async function updateCatalogEntry(
  kind: "category" | "productSubtype" | "season",
  id: string,
  name: string,
) {
  if (!name.trim()) {
    throw new Error("El nombre es obligatorio");
  }

  const cleanName = name.trim();

  if (kind === "category") {
    await prisma.category.update({
      where: { id },
      data: { name: cleanName },
    });
    return;
  }

  if (kind === "productSubtype") {
    await prisma.productSubtype.update({
      where: { id },
      data: { name: cleanName },
    });
    return;
  }

  await prisma.season.update({
    where: { id },
    data: { name: cleanName },
  });
}

async function updateCategoryChild(
  kind: "productSubtype" | "season",
  id: string,
  categoryId: string,
  name: string,
) {
  if (!name.trim()) {
    throw new Error("El nombre es obligatorio");
  }

  const cleanName = name.trim();

  if (kind === "productSubtype") {
    await prisma.productSubtype.update({
      where: { id },
      data: {
        categoryId,
        name: cleanName,
      },
    });
    return;
  }

  await prisma.season.update({
    where: { id },
    data: {
      categoryId,
      name: cleanName,
    },
  });
}

async function toggleCatalogEntry(
  kind: "category" | "productSubtype" | "season",
  id: string,
  nextState: boolean,
) {
  if (kind === "category") {
    await prisma.category.update({
      where: { id },
      data: { isActive: nextState },
    });
    return;
  }

  if (kind === "productSubtype") {
    await prisma.productSubtype.update({
      where: { id },
      data: { isActive: nextState },
    });
    return;
  }

  await prisma.season.update({
    where: { id },
    data: { isActive: nextState },
  });
}

function revalidateCatalogs() {
  revalidatePath("/catalogs");
  revalidatePath("/products");
  revalidatePath("/inventory-entries");
  revalidatePath("/sales/new");
}

export async function createCategoryAction(formData: FormData) {
  const session = await requireUserSession();
  await assertModuleAccess(session, "CATALOG_CORE");

  await createCatalogEntry("category", getRequiredString(formData, "name"));
  revalidateCatalogs();
}

export async function updateCategoryAction(formData: FormData) {
  const session = await requireUserSession();
  await assertModuleAccess(session, "CATALOG_CORE");

  await updateCatalogEntry(
    "category",
    getRequiredString(formData, "id"),
    getRequiredString(formData, "name"),
  );
  revalidateCatalogs();
}

export async function toggleCategoryAction(formData: FormData) {
  const session = await requireUserSession();
  await assertModuleAccess(session, "CATALOG_CORE");

  await toggleCatalogEntry(
    "category",
    getRequiredString(formData, "id"),
    String(formData.get("nextState")) === "true",
  );
  revalidateCatalogs();
}

export async function createProductSubtypeAction(formData: FormData) {
  const session = await requireUserSession();
  await assertModuleAccess(session, "CATALOG_CORE");

  await createCategoryChild(
    "productSubtype",
    getRequiredString(formData, "categoryId"),
    getRequiredString(formData, "name"),
  );
  revalidateCatalogs();
}

export async function updateProductSubtypeAction(formData: FormData) {
  const session = await requireUserSession();
  await assertModuleAccess(session, "CATALOG_CORE");

  await updateCategoryChild(
    "productSubtype",
    getRequiredString(formData, "id"),
    getRequiredString(formData, "categoryId"),
    getRequiredString(formData, "name"),
  );
  revalidateCatalogs();
}

export async function toggleProductSubtypeAction(formData: FormData) {
  const session = await requireUserSession();
  await assertModuleAccess(session, "CATALOG_CORE");

  await toggleCatalogEntry(
    "productSubtype",
    getRequiredString(formData, "id"),
    String(formData.get("nextState")) === "true",
  );
  revalidateCatalogs();
}

export async function createSeasonAction(formData: FormData) {
  const session = await requireUserSession();
  await assertModuleAccess(session, "CATALOG_CORE");

  await createCategoryChild(
    "season",
    getRequiredString(formData, "categoryId"),
    getRequiredString(formData, "name"),
  );
  revalidateCatalogs();
}

export async function updateSeasonAction(formData: FormData) {
  const session = await requireUserSession();
  await assertModuleAccess(session, "CATALOG_CORE");

  await updateCategoryChild(
    "season",
    getRequiredString(formData, "id"),
    getRequiredString(formData, "categoryId"),
    getRequiredString(formData, "name"),
  );
  revalidateCatalogs();
}

export async function toggleSeasonAction(formData: FormData) {
  const session = await requireUserSession();
  await assertModuleAccess(session, "CATALOG_CORE");

  await toggleCatalogEntry(
    "season",
    getRequiredString(formData, "id"),
    String(formData.get("nextState")) === "true",
  );
  revalidateCatalogs();
}
