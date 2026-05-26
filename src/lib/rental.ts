import { differenceInCalendarDays } from "date-fns";

/**
 * Advanced rental pricing system.
 *
 * Each product chooses a pricing model. The model resolves to a 7-element
 * multipliers array (one entry per day, 1..7). Day total = price_day * multiplier.
 *
 *   PREMIUM     — Napalm-style premium pricing (1, 1.6, 2.25, 2.8, 3.3, 3.7, 4)
 *   AGGRESSIVE  — More conversion-oriented (1, 1.5, 2, 2.4, 2.8, 3.2, day7)
 *   WEEKLY_FLAT — Linear up to day 6, flat week price on day 7 (price_week/price_day)
 *   CUSTOM      — Custom multipliers per product (manual table)
 *
 * 8+ days always requires manual quote (contactRequired=true).
 */

export const MAX_AUTO_DAYS = 7;

export type PricingModel = "premium" | "aggressive" | "weekly_flat" | "custom";

export const DEFAULT_PRESETS: Record<"premium" | "aggressive", number[]> = {
  premium: [1, 1.6, 2.25, 2.8, 3.3, 3.7, 4.0],
  aggressive: [1, 1.5, 2.0, 2.4, 2.8, 3.2, 3.5],
};

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  premium: "Premium",
  aggressive: "Aggressive",
  weekly_flat: "Weekly flat",
  custom: "Custom",
};

export type PricingSettings = {
  presets?: Partial<Record<"premium" | "aggressive", number[]>>;
  aggressive_day7_multiplier?: number;
};

export interface ResolveMultipliersInput {
  model?: PricingModel | null;
  customMultipliers?: number[] | null;
  priceDay: number;
  priceWeek?: number | null;
  settings?: PricingSettings | null;
}

/** Returns a length-7 array of multipliers (day 1..day 7). */
export function getMultipliers(input: ResolveMultipliersInput): number[] {
  const model: PricingModel = (input.model ?? "premium") as PricingModel;
  const presets = {
    premium: input.settings?.presets?.premium ?? DEFAULT_PRESETS.premium,
    aggressive: input.settings?.presets?.aggressive ?? DEFAULT_PRESETS.aggressive,
  };
  const day7Aggressive = input.settings?.aggressive_day7_multiplier ?? 3.5;

  let arr: number[];
  if (model === "custom" && Array.isArray(input.customMultipliers) && input.customMultipliers.length >= 1) {
    arr = input.customMultipliers.slice();
  } else if (model === "aggressive") {
    arr = presets.aggressive.slice();
    if (arr.length >= 7) arr[6] = day7Aggressive;
  } else if (model === "weekly_flat") {
    const pw = Number(input.priceWeek) || 0;
    const pd = Number(input.priceDay) || 0;
    if (pd > 0 && pw > 0) {
      const wf = pw / pd;
      arr = [1, 2, 3, 4, 5, 6, wf];
    } else {
      arr = presets.premium.slice();
    }
  } else {
    arr = presets.premium.slice();
  }

  // Pad / truncate to exactly 7
  while (arr.length < 7) arr.push(arr[arr.length - 1] ?? 1);
  return arr.slice(0, 7);
}

export interface CalcItemPriceInput {
  priceDay: number;
  priceWeek?: number | null;
  days: number;
  quantity?: number;
  model?: PricingModel | null;
  customMultipliers?: number[] | null;
  settings?: PricingSettings | null;
}

export interface CalcItemPriceResult {
  subtotal: number;
  weeklyApplied: boolean;
  contactRequired: boolean;
  avgPerDay: number;
  perUnit: number;
  multiplier: number;
  multipliers: number[];
}

export function calcItemPrice(opts: CalcItemPriceInput): CalcItemPriceResult {
  const qty = Math.max(1, opts.quantity ?? 1);
  const days = Math.max(1, Math.floor(opts.days));
  const day = Number(opts.priceDay) || 0;

  if (days > MAX_AUTO_DAYS) {
    return {
      subtotal: 0,
      weeklyApplied: false,
      contactRequired: true,
      avgPerDay: 0,
      perUnit: 0,
      multiplier: 0,
      multipliers: [],
    };
  }

  const multipliers = getMultipliers({
    model: opts.model,
    customMultipliers: opts.customMultipliers,
    priceDay: day,
    priceWeek: opts.priceWeek,
    settings: opts.settings,
  });
  const multiplier = multipliers[days - 1] ?? 1;
  const perUnit = +(day * multiplier).toFixed(2);
  const subtotal = +(perUnit * qty).toFixed(2);
  const avgPerDay = days > 0 ? perUnit / days : day;
  const weeklyApplied = days === 7 && (opts.model === "weekly_flat" || opts.priceWeek != null);

  return { subtotal, weeklyApplied, contactRequired: false, avgPerDay, perUnit, multiplier, multipliers };
}

/** Full 1-7 days pricing table (per unit). Useful for product detail UI. */
export function calcPricingTable(opts: Omit<CalcItemPriceInput, "days">) {
  const day = Number(opts.priceDay) || 0;
  const multipliers = getMultipliers({
    model: opts.model,
    customMultipliers: opts.customMultipliers,
    priceDay: day,
    priceWeek: opts.priceWeek,
    settings: opts.settings,
  });
  const linearWeek = day * 7;
  return multipliers.map((m, i) => {
    const dayNum = i + 1;
    const price = +(day * m).toFixed(2);
    const linear = day * dayNum;
    const savings = Math.max(0, linear - price);
    const savingsPct = linear > 0 ? savings / linear : 0;
    return { day: dayNum, multiplier: m, price, linear, savings, savingsPct, isWeek: dayNum === 7 };
  });
}

/** Backward compat: weekly breakdown using product's pricing model. */
export function calcWeeklyBreakdown(
  priceDay: number,
  opts?: { model?: PricingModel | null; customMultipliers?: number[] | null; priceWeek?: number | null; settings?: PricingSettings | null },
) {
  const r = calcItemPrice({
    priceDay,
    priceWeek: opts?.priceWeek,
    days: 7,
    quantity: 1,
    model: opts?.model,
    customMultipliers: opts?.customMultipliers,
    settings: opts?.settings,
  });
  const listPrice = (Number(priceDay) || 0) * 7;
  const weekly = r.subtotal;
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
