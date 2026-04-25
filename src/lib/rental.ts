import { differenceInCalendarDays } from "date-fns";

/** Calculate the rental price for one item across N days, applying weekly rate if cheaper. */
export function calcItemPrice(opts: {
  priceDay: number;
  priceWeek?: number | null;
  days: number;
  quantity?: number;
}): { subtotal: number; weeklyApplied: boolean } {
  const qty = Math.max(1, opts.quantity ?? 1);
  const days = Math.max(1, Math.floor(opts.days));
  const day = Number(opts.priceDay) || 0;
  const week = opts.priceWeek ? Number(opts.priceWeek) : null;

  if (!week || days < 7) {
    return { subtotal: day * days * qty, weeklyApplied: false };
  }

  const weeks = Math.floor(days / 7);
  const remDays = days - weeks * 7;
  // Daily extras capped at weekly rate.
  const remCost = Math.min(remDays * day, week);
  const subtotal = (weeks * week + remCost) * qty;
  return { subtotal, weeklyApplied: true };
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
