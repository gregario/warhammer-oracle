export function fuzzySearch<T extends Record<string, unknown>>(
  items: T[],
  query: string,
  fields: (keyof T)[],
): T[] {
  if (!query.trim()) return [...items];
  const lower = query.toLowerCase();
  return items.filter((item) =>
    fields.some((field) => {
      const value = item[field];
      if (typeof value === "string")
        return value.toLowerCase().includes(lower);
      if (Array.isArray(value))
        return value.some(
          (v) => typeof v === "string" && v.toLowerCase().includes(lower),
        );
      return false;
    }),
  );
}
