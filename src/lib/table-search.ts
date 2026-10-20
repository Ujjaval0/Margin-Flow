/** Cache normalization per immutable row while preserving the table's search depth. */
export function createRecordSearch(searchKey?: string) {
  const values = new WeakMap<object, string[]>();
  let lastQuery = "";
  let matches = new WeakMap<object, boolean>();

  return (record: unknown, query: string): boolean => {
    if (!query) return true;
    if (query !== lastQuery) {
      lastQuery = query;
      matches = new WeakMap();
    }
    const object = record !== null && typeof record === "object" ? record : null;
    if (object && matches.has(object)) return matches.get(object)!;
    let tokens = object ? values.get(object) : undefined;
    if (!tokens) {
      tokens = [];
      // 1. If searchKey is specified, prioritize checking that property on row.original.
      if (searchKey && object) {
        const direct = (object as Record<string, unknown>)[searchKey];
        if (direct !== undefined && direct !== null) tokens.push(String(direct).toLowerCase());
      }
      // 2. Also search all top-level and nested primitive values in row.original.
      const collect = (value: unknown, depth = 0) => {
        if (depth > 2 || value === null || value === undefined) return;
        if (typeof value === "string" || typeof value === "number") tokens!.push(String(value).toLowerCase());
        else if (Array.isArray(value)) value.forEach(item => collect(item, depth + 1));
        else if (typeof value === "object") Object.values(value).forEach(item => collect(item, depth + 1));
      };
      collect(record);
      if (object) values.set(object, tokens);
    }
    const result = tokens.some(value => value.includes(query));
    if (object) matches.set(object, result);
    return result;
  };
}
