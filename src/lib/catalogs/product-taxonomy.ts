type CatalogResolveInput = {
  categoryId?: string | null;
  id?: string | null;
  name?: string | null;
};

function normalizeName(value?: string | null) {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : null;
}

export async function resolveProductSubtypeId(
  tx: any,
  input: CatalogResolveInput,
) {
  if (input.id) {
    return input.id;
  }

  if (!input.categoryId) {
    return null;
  }

  const name = normalizeName(input.name);

  if (!name) {
    return null;
  }

  const existing = await tx.productSubtype.findUnique({
    where: {
      categoryId_name: {
        categoryId: input.categoryId,
        name,
      },
    },
  });

  if (existing) {
    return existing.id;
  }

  const created = await tx.productSubtype.create({
    data: {
      categoryId: input.categoryId,
      name,
    },
  });

  return created.id;
}

export async function resolveSeasonId(tx: any, input: CatalogResolveInput) {
  if (input.id) {
    return input.id;
  }

  if (!input.categoryId) {
    return null;
  }

  const name = normalizeName(input.name);

  if (!name) {
    return null;
  }

  const existing = await tx.season.findUnique({
    where: {
      categoryId_name: {
        categoryId: input.categoryId,
        name,
      },
    },
  });

  if (existing) {
    return existing.id;
  }

  const created = await tx.season.create({
    data: {
      categoryId: input.categoryId,
      name,
    },
  });

  return created.id;
}
