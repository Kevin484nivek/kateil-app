export function getRequiredString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function getOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value.length > 0 ? value : null;
}

export function getOptionalDecimal(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim().replace(",", ".");

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid decimal for ${key}`);
  }

  return parsed.toFixed(2);
}

export function getRequiredDecimal(formData: FormData, key: string) {
  const parsed = getOptionalDecimal(formData, key);

  if (parsed === null) {
    throw new Error(`Missing decimal for ${key}`);
  }

  return parsed;
}

export function getRequiredInt(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Missing integer for ${key}`);
  }

  return parsed;
}

export function getOptionalBoolean(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim().toLowerCase();

  if (!value) {
    return false;
  }

  return value === "true" || value === "on" || value === "1";
}
