/** Never replace complete books with the first page of a larger result. */
export async function loadFinancialPages<T extends { id: string }>(url: string, key: string): Promise<T[]> {
  const limit = 2000;
  const records: T[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += limit) {
    const response = await fetch(`${url}?limit=${limit}&offset=${offset}`, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("Ledger synchronization unavailable.");
    const body = await response.json();
    const page: T[] = body[key];
    if (!Array.isArray(page) || page.length > limit) throw new Error("Invalid ledger response.");
    for (const row of page) {
      if (!row || typeof row.id !== "string" || seen.has(row.id)) throw new Error("Ledger changed during pagination. Reload and retry.");
      seen.add(row.id);
      records.push(row);
    }
    if (page.length < limit) return records;
  }
}
