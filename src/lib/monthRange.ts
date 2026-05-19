export interface MonthRange {
  year: number;
  month: number; // 0-11
  startISO: string; // YYYY-MM-DD
  endISO: string;
  label: string;
}

export function getMonthRange(year: number, month: number, locale = "es"): MonthRange {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(start);
  return {
    year,
    month,
    startISO: fmt(start),
    endISO: fmt(end),
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
}

export function listMonths(yearsBack = 2, yearsForward = 1, locale = "es"): MonthRange[] {
  const now = new Date();
  const out: MonthRange[] = [];
  for (let y = now.getFullYear() - yearsBack; y <= now.getFullYear() + yearsForward; y++) {
    for (let m = 0; m < 12; m++) out.push(getMonthRange(y, m, locale));
  }
  return out;
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}
