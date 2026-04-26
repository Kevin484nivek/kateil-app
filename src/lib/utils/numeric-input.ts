type SanitizeNumericInputOptions = {
  allowDecimal?: boolean;
  maxDecimals?: number;
};

export function sanitizeNumericInput(
  value: string,
  options: SanitizeNumericInputOptions = {},
) {
  const { allowDecimal = true, maxDecimals } = options;
  const normalized = value.replace(",", ".");

  let result = "";
  let hasDecimalSeparator = false;

  for (const character of normalized) {
    if (character >= "0" && character <= "9") {
      result += character;
      continue;
    }

    if (allowDecimal && character === "." && !hasDecimalSeparator) {
      hasDecimalSeparator = true;
      result += character;
    }
  }

  if (!allowDecimal || maxDecimals == null || !result.includes(".")) {
    return result;
  }

  const [integerPart, decimalPart = ""] = result.split(".");
  return `${integerPart}.${decimalPart.slice(0, maxDecimals)}`;
}

export function sanitizeIntegerInput(value: string) {
  return sanitizeNumericInput(value, { allowDecimal: false });
}
