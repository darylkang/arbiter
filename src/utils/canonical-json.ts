const canonicalizeValue = (value: unknown, seen: WeakSet<object>): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (seen.has(value)) {
    throw new TypeError("Cannot canonicalize circular structure");
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const body = `[${value.map((item) => canonicalizeValue(item, seen)).join(",")}]`;
    seen.delete(value);
    return body;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  const body = entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalizeValue(entryValue, seen)}`)
    .join(",");

  seen.delete(value);
  return `{${body}}`;
};

export const canonicalStringify = (value: unknown): string =>
  canonicalizeValue(value, new WeakSet<object>());
