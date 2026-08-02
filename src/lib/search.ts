function matchesValue(value: unknown, lower: string): boolean {
  if (typeof value === "string") return value.toLowerCase().includes(lower);
  if (Array.isArray(value)) return value.some((v) => matchesValue(v, lower));
  if (value && typeof value === "object")
    return Object.values(value).some((v) => matchesValue(v, lower));
  return false;
}

export function fuzzySearch<T extends Record<string, unknown>>(
  items: T[],
  query: string,
  fields: (keyof T)[],
): T[] {
  if (!query.trim()) return [...items];
  const lower = query.toLowerCase();
  return items.filter((item) =>
    fields.some((field) => matchesValue(item[field], lower)),
  );
}
