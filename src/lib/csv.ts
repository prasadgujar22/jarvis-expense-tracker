/** Minimal RFC 4180 CSV parse/serialize. */
export interface CSVRow {
  /** 1-based line number in the source file where this row starts. */
  line: number;
  cells: string[];
}

export function parseCSV(text: string): string[][] {
  return parseCSVRows(text).map((r) => r.cells);
}

/** Like parseCSV but keeps each row's source line, so messages can point at the right line even when blank lines are skipped. */
export function parseCSVRows(text: string): CSVRow[] {
  const rows: CSVRow[] = [];
  let line = 1;
  let rowLine = 1;
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (c === '\n') line++;
        field += c;
      }
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push({ line: rowLine, cells: row });
      row = [];
      line++;
      rowLine = line;
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push({ line: rowLine, cells: row });
  return rows;
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** Prefix values a spreadsheet would treat as a formula with an apostrophe. Plain numbers (e.g. "-12.50") are left alone. */
export function guardFormula(v: string): string {
  if (FORMULA_START.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) return "'" + v;
  return v;
}

/** Reverse guardFormula when re-importing a file Kosh exported. */
export function unguardFormula(v: string): string {
  return /^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v;
}

function escapeField(raw: string): string {
  // Guard BEFORE quoting so quoted fields are protected too.
  const v = guardFormula(raw);
  if (/[",\n\r]/.test(v) || /^\s|\s$/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

export function toCSV(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(escapeField).join(',')).join('\r\n') + '\r\n';
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
