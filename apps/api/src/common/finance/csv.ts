/**
 * Minimal RFC 4180 CSV writer with protection against spreadsheet formula injection
 * (cells starting with = + - @ tab or CR are prefixed with a single quote).
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown, { allowFormulaChars = false } = {}): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (!allowFormulaChars && FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
  /** Set for trusted numeric columns (e.g. signed amounts) that legitimately start with "-". */
  numeric?: boolean;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => escapeCsvCell(c.header)).join(',')];
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => escapeCsvCell(c.value(row), { allowFormulaChars: c.numeric === true }))
        .join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}
