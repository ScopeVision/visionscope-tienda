import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { toast } from "sonner";
import { calcCartLinePrice, daysBetween, type PricingModel } from "@/lib/rental";
import { toDateOnly } from "@/lib/dates";

export type CartItem = {
  productId: string;
  variantId?: string | null;
  variantName?: string | null;
  slug: string;
  name: string;
  image?: string;
  priceDay: number;
  priceWeek?: number | null;
  deposit: number;
  quantity: number;
  pricingModel?: PricingModel | null;
  customMultipliers?: number[] | null;
};

type CartCtx = {
  items: CartItem[];
  startDate: string | null;
  endDate: string | null;
  setDates: (start: string | null, end: string | null) => void;
  add: (item: CartItem) => void;
  updateQuantity: (productId: string, variantId: string | null | undefined, qty: number) => void;
  remove: (productId: string, variantId: string | null | undefined) => void;
  clear: () => void;
  days: number;
  subtotal: number;
  depositTotal: number;
  total: number;
};

const CartContext = createContext<CartCtx | null>(null);

const STORAGE_KEY = "lillo-cart-v1";

const lineKey = (productId: string, variantId?: string | null) => `${productId}::${variantId ?? ""}`;

type Persisted = { items: CartItem[]; startDate: string | null; endDate: string | null };

/**
 * Lee el carrito de localStorage de forma SÍNCRONA (antes del primer render),
 * para que las páginas /cart y /checkout ya vean artículos y fechas.
 * Si las fechas guardadas han caducado, se descartan (los artículos se mantienen).
 */
function readPersisted(): Persisted & { expired: boolean } {
  const empty = { items: [], startDate: null, endDate: null, expired: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed: Persisted = JSON.parse(raw);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const startDate = parsed?.startDate ?? null;
    const endDate = parsed?.endDate ?? null;
    const today = toDateOnly(new Date());
    if (startDate && startDate < today) {
      return { items, startDate: null, endDate: null, expired: items.length > 0 };
    }
    return { items, startDate, endDate, expired: false };
  } catch {
    return empty;
  }
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [initial] = useState(readPersisted);
  const [items, setItems] = useState<CartItem[]>(initial.items);
  const [startDate, setStartDate] = useState<string | null>(initial.startDate);
  const [endDate, setEndDate] = useState<string | null>(initial.endDate);

  useEffect(() => {
    if (initial.expired) {
      toast.warning("Las fechas guardadas ya han pasado. Elige nuevas.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const data: Persisted = { items, startDate, endDate };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }, [items, startDate, endDate]);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 1;
    return daysBetween(startDate, endDate);
  }, [startDate, endDate]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (acc, it) =>
          acc +
          // TODO: cargar PricingSettings desde site_settings
          calcCartLinePrice(it, days, undefined).subtotal,
        0
      ),
    [items, days]
  );

  const depositTotal = useMemo(
    () => items.reduce((acc, it) => acc + Number(it.deposit) * it.quantity, 0),
    [items]
  );

  const value: CartCtx = {
    items,
    startDate,
    endDate,
    setDates: (s, e) => {
      setStartDate(s);
      setEndDate(e);
    },
    add: (item) =>
      setItems((curr) => {
        const key = lineKey(item.productId, item.variantId);
        const idx = curr.findIndex((c) => lineKey(c.productId, c.variantId) === key);
        if (idx >= 0) {
          const copy = [...curr];
          copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + item.quantity };
          return copy;
        }
        return [...curr, item];
      }),
    updateQuantity: (productId, variantId, qty) =>
      setItems((curr) =>
        curr.map((c) =>
          lineKey(c.productId, c.variantId) === lineKey(productId, variantId)
            ? { ...c, quantity: Math.max(1, qty) }
            : c
        )
      ),
    remove: (productId, variantId) =>
      setItems((curr) =>
        curr.filter((c) => lineKey(c.productId, c.variantId) !== lineKey(productId, variantId))
      ),
    clear: () => {
      setItems([]);
      setStartDate(null);
      setEndDate(null);
    },
    days,
    subtotal,
    depositTotal,
    total: subtotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
