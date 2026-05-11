import { differenceInCalendarDays } from "date-fns";

/**
 * Progressive daily discount: each additional day costs 6% less than the base
 * day rate, calculated against the base price. Day n = P * (1 - 0.06 * (n-1)).
 * Only valid for 1..7 days. For 8+ days, contactRequired is true and subtotal
 * is returned as 0 — the UI must surface a "contact us" CTA instead.
 */
export const MAX_AUTO_DAYS = 7;
export const DAILY_DISCOUNT_STEP = 0.06;

export function dailyFactor(dayIndex: number): number {
  // dayIndex is 1-based. Floor at 0 to be safe.
  return Math.max(0, 1 - DAILY_DISCOUNT_STEP * (dayIndex - 1));
}

export function calcItemPrice(opts: {
  priceDay: number;
  priceWeek?: number | null; // kept for backward compatibility — ignored
  days: number;
  quantity?: number;
}): {
  subtotal: number;
  weeklyApplied: boolean;
  contactRequired: boolean;
  avgPerDay: number;
} {
  const qty = Math.max(1, opts.quantity ?? 1);
  const days = Math.max(1, Math.floor(opts.days));
  const day = Number(opts.priceDay) || 0;

  if (days > MAX_AUTO_DAYS) {
    return { subtotal: 0, weeklyApplied: false, contactRequired: true, avgPerDay: 0 };
  }

  let perUnit = 0;
  for (let n = 1; n <= days; n++) {
    perUnit += day * dailyFactor(n);
  }
  const subtotal = perUnit * qty;
  return {
    subtotal,
    weeklyApplied: false,
    contactRequired: false,
    avgPerDay: days > 0 ? perUnit / days : day,
  };
}

/**
 * Computes the effective weekly price (sum of progressive day prices for 7 days)
 * along with the "list price" (day × 7) and the absolute and relative savings.
 * Useful to surface the progressive discount in the UI.
 */
export function calcWeeklyBreakdown(priceDay: number): {
  weekly: number;
  listPrice: number;
  savings: number;
  savingsPct: number;
} {
  const day = Number(priceDay) || 0;
  let weekly = 0;
  for (let n = 1; n <= 7; n++) weekly += day * dailyFactor(n);
  const listPrice = day * 7;
  const savings = Math.max(0, listPrice - weekly);
  const savingsPct = listPrice > 0 ? savings / listPrice : 0;
  return { weekly, listPrice, savings, savingsPct };
}

export function daysBetween(start: Date | string, end: Date | string): number {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  return Math.max(1, differenceInCalendarDays(e, s) + 1);
}

export function formatCurrency(value: number, lang: string = "es"): string {
  const locale =
    lang === "ca" ? "ca-ES" : lang === "en" ? "en-GB" : lang === "fr" ? "fr-FR" : "es-ES";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);
}
