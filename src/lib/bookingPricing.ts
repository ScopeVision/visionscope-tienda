import { calcItemPrice } from "./rental";

export type DiscountType = "none" | "fixed" | "percent";

export interface ExtraFee {
  label: string;
  amount: number;
}

export interface EditableItem {
  id?: string;
  product_id: string;
  variant_id?: string | null;
  product_name: string;
  quantity: number;
  days: number;
  price_day: number;
  deposit: number;
  discount_type: DiscountType;
  discount_value: number;
  price_override?: number | null;
}

export interface EditableBooking {
  items: EditableItem[];
  discount_type: DiscountType;
  discount_value: number;
  extra_fees: ExtraFee[];
  subtotal_override?: number | null;
  total_override?: number | null;
}

export interface ItemBreakdown {
  auto_subtotal: number;
  discount_amount: number;
  final_subtotal: number;
  deposit_total: number;
}

export interface BookingBreakdown {
  items: ItemBreakdown[];
  auto_subtotal: number;
  items_discount_total: number;
  subtotal_after_item_discounts: number;
  global_discount_amount: number;
  effective_subtotal: number;
  extra_fees_total: number;
  total: number;
  deposit_total: number;
  subtotal_overridden: boolean;
  total_overridden: boolean;
}

function applyDiscount(base: number, type: DiscountType, value: number): number {
  if (!value || type === "none") return 0;
  if (type === "fixed") return Math.min(base, Math.max(0, value));
  if (type === "percent") return Math.max(0, base * Math.min(100, Math.max(0, value)) / 100);
  return 0;
}

export function computeItemBreakdown(item: EditableItem): ItemBreakdown {
  const { subtotal } = calcItemPrice({
    priceDay: item.price_day,
    days: item.days,
    quantity: item.quantity,
  });
  const auto_subtotal = subtotal;
  let final_subtotal: number;
  let discount_amount = 0;

  if (item.price_override != null && !Number.isNaN(item.price_override)) {
    final_subtotal = Math.max(0, Number(item.price_override));
    discount_amount = Math.max(0, auto_subtotal - final_subtotal);
  } else {
    discount_amount = applyDiscount(auto_subtotal, item.discount_type, item.discount_value);
    final_subtotal = Math.max(0, auto_subtotal - discount_amount);
  }

  return {
    auto_subtotal,
    discount_amount,
    final_subtotal,
    deposit_total: (Number(item.deposit) || 0) * Math.max(1, item.quantity),
  };
}

export function computeBookingBreakdown(b: EditableBooking): BookingBreakdown {
  const items = b.items.map(computeItemBreakdown);
  const auto_subtotal = items.reduce((s, i) => s + i.auto_subtotal, 0);
  const items_discount_total = items.reduce((s, i) => s + i.discount_amount, 0);
  const subtotal_after_item_discounts = items.reduce((s, i) => s + i.final_subtotal, 0);
  const global_discount_amount = applyDiscount(
    subtotal_after_item_discounts,
    b.discount_type,
    b.discount_value,
  );
  const computed_effective = Math.max(0, subtotal_after_item_discounts - global_discount_amount);
  const subtotal_overridden = b.subtotal_override != null && !Number.isNaN(b.subtotal_override);
  const effective_subtotal = subtotal_overridden ? Number(b.subtotal_override) : computed_effective;
  const extra_fees_total = (b.extra_fees || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const computed_total = effective_subtotal + extra_fees_total;
  const total_overridden = b.total_override != null && !Number.isNaN(b.total_override);
  const total = total_overridden ? Number(b.total_override) : computed_total;
  const deposit_total = items.reduce((s, i) => s + i.deposit_total, 0);

  return {
    items,
    auto_subtotal,
    items_discount_total,
    subtotal_after_item_discounts,
    global_discount_amount,
    effective_subtotal,
    extra_fees_total,
    total,
    deposit_total,
    subtotal_overridden,
    total_overridden,
  };
}
