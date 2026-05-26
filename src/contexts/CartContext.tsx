import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { calcItemPrice, daysBetween, type PricingModel } from "@/lib/rental";

export type CartItem = {
  productId: string;
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
  updateQuantity: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  days: number;
  subtotal: number;
  depositTotal: number;
  total: number;
};

const CartContext = createContext<CartCtx | null>(null);

const STORAGE_KEY = "lillo-cart-v1";

type Persisted = { items: CartItem[]; startDate: string | null; endDate: string | null };

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Persisted = JSON.parse(raw);
        setItems(parsed.items ?? []);
        setStartDate(parsed.startDate ?? null);
        setEndDate(parsed.endDate ?? null);
      }
    } catch {
      // ignore
    }
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
          calcItemPrice({
            priceDay: it.priceDay,
            priceWeek: it.priceWeek,
            days,
            quantity: it.quantity,
            model: it.pricingModel ?? "premium",
            customMultipliers: it.customMultipliers ?? null,
          }).subtotal,
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
        const idx = curr.findIndex((c) => c.productId === item.productId);
        if (idx >= 0) {
          const copy = [...curr];
          copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + item.quantity };
          return copy;
        }
        return [...curr, item];
      }),
    updateQuantity: (productId, qty) =>
      setItems((curr) =>
        curr.map((c) => (c.productId === productId ? { ...c, quantity: Math.max(1, qty) } : c))
      ),
    remove: (productId) => setItems((curr) => curr.filter((c) => c.productId !== productId)),
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
