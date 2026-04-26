type SearchField = {
  value: string | null | undefined;
  weight?: number;
};

const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const MULTISPACE_REGEX = /\s+/g;

export function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLocaleLowerCase("es-ES")
    .replace(MULTISPACE_REGEX, " ")
    .trim();
}

export function tokenizeSearchQuery(query: string | null | undefined) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  return Array.from(new Set(normalizedQuery.split(" ").filter(Boolean)));
}

export function getSmartSearchScore(
  query: string | null | undefined,
  fields: SearchField[],
) {
  const tokens = tokenizeSearchQuery(query);

  if (tokens.length === 0) {
    return null;
  }

  const normalizedFields = fields
    .map((field) => ({
      value: normalizeSearchText(field.value),
      weight: field.weight ?? 1,
    }))
    .filter((field) => field.value.length > 0);

  if (normalizedFields.length === 0) {
    return null;
  }

  const joinedValue = normalizedFields.map((field) => field.value).join(" ");
  let score = 0;

  for (const token of tokens) {
    let tokenBestScore = -1;

    for (const field of normalizedFields) {
      const words = field.value.split(" ");
      let fieldScore = -1;

      if (field.value === token) {
        fieldScore = 140 + field.weight * 10;
      } else if (words.includes(token)) {
        fieldScore = 110 + field.weight * 10;
      } else if (words.some((word) => word.startsWith(token))) {
        fieldScore = 90 + field.weight * 10;
      } else if (field.value.startsWith(token)) {
        fieldScore = 70 + field.weight * 10;
      } else if (field.value.includes(token)) {
        fieldScore = 45 + field.weight * 10;
      }

      tokenBestScore = Math.max(tokenBestScore, fieldScore);
    }

    if (tokenBestScore < 0) {
      return null;
    }

    score += tokenBestScore;
  }

  const normalizedQuery = normalizeSearchText(query);

  if (normalizedQuery && joinedValue.includes(normalizedQuery)) {
    score += 80;
  }

  return score;
}
