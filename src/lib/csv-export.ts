// Lightweight CSV export helpers used by admin/teacher panels.
// Generates a UTF-8 CSV (with BOM for Excel) and triggers a browser download.

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // CSV/formula injection: neutralize leading =, +, -, @, tab, CR so Excel/Sheets
  // treat the value as text instead of evaluating it as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv<T extends Record<string, unknown>>(
  rows: T[],
  headers: { key: keyof T & string; label: string }[],
  separator: "," | ";" = ";",
): string {
  const head = headers.map((h) => escapeCell(h.label)).join(separator);
  const body = rows.map((r) => headers.map((h) => escapeCell(r[h.key])).join(separator)).join("\n");
  return `${head}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportRowsAsCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  headers: { key: keyof T & string; label: string }[],
) {
  downloadCsv(filename, rowsToCsv(rows, headers));
}
