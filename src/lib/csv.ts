/** Quote every cell and neutralize spreadsheet formulas before serializing. */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (typeof value !== "number" && (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(rows: readonly (readonly unknown[])[], filename: string): void {
  const url = URL.createObjectURL(new Blob(["\uFEFF", serializeCsv(rows)], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
