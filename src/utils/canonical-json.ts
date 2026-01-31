const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const canonicalizeValue = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeValue(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  const body = entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalizeValue(entryValue)}`)
    .join(",");

  return `{${body}}`;
};

export const canonicalStringify = (value: unknown): string => canonicalizeValue(value);
