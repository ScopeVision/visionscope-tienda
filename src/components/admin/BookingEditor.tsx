import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, History, Save } from "lucide-react";
import BookingCommunications from "./BookingCommunications";
import CustomerPicker from "./CustomerPicker";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, daysBetween, PRICING_MODEL_LABELS, type PricingModel } from "@/lib/rental";
import {
  computeBookingBreakdown,
  type EditableBooking,
  type EditableItem,
  type ExtraFee,
  type DiscountType,
} from "@/lib/bookingPricing";

export const BOOKING_STATUSES = [
  "nuevo",
  "pending_review",
  "awaiting_confirmation",
  "confirmado",
  "preparacion",
  "ready_for_pickup",
  "alquiler",
  "returned",
  "finalizado",
  "cancelado",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  nuevo: "New",
  pending_review: "Pending Review",
  awaiting_confirmation: "Awaiting Confirmation",
  confirmado: "Confirmed",
  preparacion: "In Preparation",
  ready_for_pickup: "Ready for Pickup",
  alquiler: "Active Rental",
  returned: "Returned",
  finalizado: "Completed",
  cancelado: "Cancelled",
};

export const PAYMENT_STATUSES = [
  "unpaid",
  "deposit_pending",
  "partially_paid",
  "paid",
  "refunded",
] as const;

export const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  deposit_pending: "Deposit Pending",
  partially_paid: "Partially Paid",
  paid: "Paid",
  refunded: "Refunded",
};

type Props = {
  bookingId: string | null;
  isCreatingNew?: boolean;
  onClose: () => void;
};

export default function BookingEditor({ bookingId, isCreatingNew, onClose }: Props) {
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; full_name: string; email: string; phone?: string | null } | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["admin-booking-edit", bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, customer:customers(*), items:booking_items(*)")
        .eq("id", bookingId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-mini"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name_es, price_day, price_week, deposit, pricing_model, pricing_multipliers, product_variants(id, name, price_day, deposit)")
        .eq("published", true)
        .order("name_es");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: inventoryUnits = [] } = useQuery({
    queryKey: ["admin-inventory-units-mini"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inventory_units")
        .select("id, product_id, serial, internal_code, owner_id, agreement_type, owner_split_pct, status, active")
        .eq("active", true)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pricingSettings } = useQuery({
    queryKey: ["finance-settings-pricing"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_settings").select("pricing_presets, aggressive_day7_multiplier").maybeSingle();
      if (!data) return null;
      return { presets: (data as any).pricing_presets, aggressive_day7_multiplier: (data as any).aggressive_day7_multiplier };
    },
  });

  const { data: auditLog = [] } = useQuery({
    queryKey: ["admin-booking-audit", bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_audit_log")
        .select("*")
        .eq("booking_id", bookingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [draft, setDraft] = useState<EditableBooking & {
    status: string;
    payment_status: string;
    start_date: string;
    end_date: string;
    notes: string;
    internal_notes: string;
  } | null>(null);

  const [showLog, setShowLog] = useState(false);

  // Create mode: initialize fresh draft when dialog opens
  useEffect(() => {
    if (!isCreatingNew || bookingId) {
      setSelectedCustomer(null);
      setAlreadyCompleted(false);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    setDraft({
      items: [],
      discount_type: "none",
      discount_value: 0,
      extra_fees: [],
      subtotal_override: null,
      total_override: null,
      pricing_settings: null,
      status: "nuevo",
      payment_status: "unpaid",
      start_date: today,
      end_date: today,
      notes: "",
      internal_notes: "",
    });
  }, [isCreatingNew, bookingId]);

  useEffect(() => {
    if (isCreatingNew && !bookingId) return; // handled by create-mode effect above
    if (!booking) {
      setDraft(null);
      return;
    }
    const days = daysBetween(booking.start_date, booking.end_date);
    const items: EditableItem[] = (booking.items ?? []).map((it: any) => ({
      id: it.id,
      product_id: it.product_id,
      variant_id: it.variant_id,
      product_name: it.product_name,
      quantity: it.quantity,
      days: it.days || days,
      price_day: Number(it.price_day),
      price_week: it.price_week != null ? Number(it.price_week) : null,
      deposit: Number(it.deposit),
      discount_type: (it.discount_type as DiscountType) || "none",
      discount_value: Number(it.discount_value) || 0,
      price_override: it.price_override != null ? Number(it.price_override) : null,
      pricing_model: (it.pricing_model as PricingModel) || null,
      pricing_multipliers: null,
      override_reason: it.override_reason ?? null,
      inventory_unit_id: it.inventory_unit_id ?? null,
    }));
    setDraft({
      items,
      discount_type: (booking.discount_type as DiscountType) || "none",
      discount_value: Number(booking.discount_value) || 0,
      extra_fees: Array.isArray(booking.extra_fees) ? (booking.extra_fees as unknown as ExtraFee[]) : [],
      subtotal_override: booking.subtotal_override != null ? Number(booking.subtotal_override) : null,
      total_override: booking.total_override != null ? Number(booking.total_override) : null,
      pricing_settings: pricingSettings ?? null,
      status: booking.status,
      payment_status: booking.payment_status || "unpaid",
      start_date: booking.start_date,
      end_date: booking.end_date,
      notes: booking.notes ?? "",
      internal_notes: booking.internal_notes ?? "",
    });
  }, [booking, pricingSettings, isCreatingNew, bookingId]);

  const breakdown = useMemo(() => {
    if (!draft) return null;
    return computeBookingBreakdown(draft);
  }, [draft]);



  const updateItem = (idx: number, patch: Partial<EditableItem>) => {
    setDraft((d) => {
      if (!d) return d;
      const next = [...d.items];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, items: next };
    });
  };

  const addItem = () => {
    if (!draft) return;
    const days = daysBetween(draft.start_date, draft.end_date);
    setDraft({
      ...draft,
      items: [
        ...draft.items,
        {
          product_id: "",
          variant_id: null,
          product_name: "",
          quantity: 1,
          days,
          price_day: 0,
          price_week: null,
          deposit: 0,
          discount_type: "none",
          discount_value: 0,
          price_override: null,
          pricing_model: null,
          pricing_multipliers: null,
          override_reason: null,
          inventory_unit_id: null,
        },
      ],
    });
  };

  const removeItem = (idx: number) => {
    setDraft((d) => (d ? { ...d, items: d.items.filter((_, i) => i !== idx) } : d));
  };

  const onPickProduct = (idx: number, productId: string) => {
    const p: any = products.find((x: any) => x.id === productId);
    if (!p) return;
    updateItem(idx, {
      product_id: productId,
      variant_id: null,
      product_name: p.name_es,
      price_day: Number(p.price_day),
      price_week: p.price_week != null ? Number(p.price_week) : null,
      deposit: Number(p.deposit),
      pricing_model: (p.pricing_model as PricingModel) ?? "premium",
      pricing_multipliers: Array.isArray(p.pricing_multipliers) ? p.pricing_multipliers : null,
    });
  };

  const onPickVariant = (idx: number, variantId: string) => {
    const item = draft?.items[idx];
    if (!item) return;
    if (variantId === "__none__") {
      const p: any = products.find((x: any) => x.id === item.product_id);
      updateItem(idx, {
        variant_id: null,
        price_day: p ? Number(p.price_day) : item.price_day,
        deposit: p ? Number(p.deposit) : item.deposit,
      });
      return;
    }
    const p: any = products.find((x: any) => x.id === item.product_id);
    const v = p?.product_variants?.find((x: any) => x.id === variantId);
    if (!v) return;
    updateItem(idx, {
      variant_id: variantId,
      price_day: Number(v.price_day),
      deposit: Number(v.deposit),
    });
  };

  const save = async () => {
    if (!draft || !breakdown) return;

    // ── CREATE MODE ──────────────────────────────────────────────────────────
    if (isCreatingNew && !bookingId) {
      if (!selectedCustomer) {
        toast.error("Selecciona un cliente antes de guardar");
        return;
      }
      if (draft.items.length === 0) {
        toast.error("Añade al menos un producto");
        return;
      }
      if (draft.items.some((i) => !i.product_id)) {
        toast.error("Hay productos sin seleccionar");
        return;
      }
      setSaving(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id ?? null;
        const days = daysBetween(draft.start_date, draft.end_date);
        const today = new Date().toISOString().split('T')[0];
        const isRetroactive = draft.start_date < today;

        const { data: newBooking, error: bErr } = await supabase
          .from("bookings")
          .insert({
            customer_id: selectedCustomer.id,
            start_date: draft.start_date,
            end_date: draft.end_date,
            status: draft.status as any,
            payment_status: draft.payment_status as any,
            subtotal: breakdown.effective_subtotal,
            deposit_total: breakdown.deposit_total,
            total: breakdown.total,
            discount_type: draft.discount_type,
            discount_value: draft.discount_value,
            extra_fees: draft.extra_fees as any,
            subtotal_override: draft.subtotal_override,
            total_override: draft.total_override,
            notes: draft.notes || null,
            internal_notes: draft.internal_notes || null,
          })
          .select()
          .single();
        if (bErr) throw bErr;

        for (const item of draft.items) {
          const br = computeBookingBreakdown({ ...draft, items: [item] });
          const auto = br.items[0].auto_subtotal;
          const isOverride =
            item.price_override != null ||
            (item.discount_type !== "none" && (item.discount_value ?? 0) > 0);
          const { error: iErr } = await supabase.from("booking_items").insert({
            booking_id: newBooking.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            product_name: item.product_name,
            quantity: item.quantity,
            days: item.days || days,
            price_day: item.price_day,
            price_week: item.price_week ?? null,
            deposit: item.deposit,
            discount_type: item.discount_type,
            discount_value: item.discount_value,
            price_override: item.price_override,
            pricing_model: item.pricing_model ?? null,
            auto_subtotal: auto,
            override_reason: item.override_reason || null,
            inventory_unit_id: item.inventory_unit_id ?? null,
            overridden_by: isOverride ? userId : null,
            overridden_at: isOverride ? new Date().toISOString() : null,
            subtotal: br.items[0].final_subtotal,
          });
          if (iErr) throw iErr;
        }

        await supabase.from("booking_audit_log").insert({
          booking_id: newBooking.id,
          actor_user_id: userId,
          action: "create",
          changes: {
            retroactive: isRetroactive,
            logged_on: new Date().toISOString(),
            start_date: draft.start_date,
            end_date: draft.end_date,
            customer_id: selectedCustomer.id,
            customer_name: selectedCustomer.full_name,
            items_count: draft.items.length,
            total: breakdown.total,
            ...(isRetroactive
              ? { note: "Reserva retroactiva registrada manualmente por el administrador" }
              : {}),
          },
        });

        toast.success("Reserva creada correctamente");
        qc.invalidateQueries({ queryKey: ["admin-bookings"] });
        qc.invalidateQueries({ queryKey: ["admin-stats"] });
        onClose();
      } catch (e: any) {
        toast.error(e.message || "Error al crear la reserva");
      } finally {
        setSaving(false);
      }
      return;
    }

    // ── EDIT MODE ────────────────────────────────────────────────────────────
    if (!booking) return;
    if (draft.items.some((i) => !i.product_id)) {
      toast.error("Hay productos sin seleccionar");
      return;
    }
    setSaving(true);
    try {
      const changes: any = {};
      if (draft.status !== booking.status) changes.status = [booking.status, draft.status];
      if (draft.payment_status !== (booking.payment_status || "unpaid"))
        changes.payment_status = [booking.payment_status || "unpaid", draft.payment_status];
      if (Number(booking.total) !== breakdown.total)
        changes.total = [Number(booking.total), breakdown.total];

      // Update booking
      const { error: bErr } = await supabase
        .from("bookings")
        .update({
          status: draft.status as any,
          payment_status: draft.payment_status as any,
          start_date: draft.start_date,
          end_date: draft.end_date,
          discount_type: draft.discount_type,
          discount_value: draft.discount_value,
          extra_fees: draft.extra_fees as any,
          subtotal_override: draft.subtotal_override,
          total_override: draft.total_override,
          subtotal: breakdown.effective_subtotal,
          deposit_total: breakdown.deposit_total,
          total: breakdown.total,
          notes: draft.notes || null,
          internal_notes: draft.internal_notes || null,
        })
        .eq("id", booking.id);
      if (bErr) throw bErr;

      // Delete removed items
      const keptIds = draft.items.filter((i) => i.id).map((i) => i.id!);
      const originalIds = (booking.items ?? []).map((i: any) => i.id);
      const toDelete = originalIds.filter((id: string) => !keptIds.includes(id));
      if (toDelete.length) {
        const { error } = await supabase.from("booking_items").delete().in("id", toDelete);
        if (error) throw error;
      }

      // Upsert items + audit overrides
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const days = daysBetween(draft.start_date, draft.end_date);
      const originalItemsById: Record<string, any> = {};
      for (const i of (booking.items ?? []) as any[]) originalItemsById[i.id] = i;
      const overrideEvents: any[] = [];

      for (const item of draft.items) {
        const br = computeBookingBreakdown({ ...draft, items: [item] });
        const auto = br.items[0].auto_subtotal;
        const isOverride =
          item.price_override != null ||
          (item.discount_type !== "none" && (item.discount_value ?? 0) > 0) ||
          (item.override_reason ?? "").trim().length > 0;

        const payload: any = {
          booking_id: booking.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.product_name,
          quantity: item.quantity,
          days: item.days || days,
          price_day: item.price_day,
          price_week: item.price_week ?? null,
          deposit: item.deposit,
          discount_type: item.discount_type,
          discount_value: item.discount_value,
          price_override: item.price_override,
          pricing_model: item.pricing_model ?? null,
          auto_subtotal: auto,
          override_reason: item.override_reason || null,
          inventory_unit_id: item.inventory_unit_id ?? null,
          overridden_by: isOverride ? userId : null,
          overridden_at: isOverride ? new Date().toISOString() : null,
          subtotal: br.items[0].final_subtotal,
        };
        if (item.id) {
          const prev = originalItemsById[item.id];
          const changedOverride =
            (prev?.price_override ?? null) !== (item.price_override ?? null) ||
            (prev?.discount_type ?? "none") !== item.discount_type ||
            Number(prev?.discount_value ?? 0) !== Number(item.discount_value ?? 0) ||
            (prev?.pricing_model ?? null) !== (item.pricing_model ?? null) ||
            (prev?.override_reason ?? null) !== (item.override_reason ?? null) ||
            (prev?.inventory_unit_id ?? null) !== (item.inventory_unit_id ?? null);
          if (changedOverride) {
            overrideEvents.push({
              item_id: item.id,
              product: item.product_name,
              before: {
                price_override: prev?.price_override ?? null,
                discount_type: prev?.discount_type ?? "none",
                discount_value: Number(prev?.discount_value ?? 0),
                pricing_model: prev?.pricing_model ?? null,
                override_reason: prev?.override_reason ?? null,
                inventory_unit_id: prev?.inventory_unit_id ?? null,
              },
              after: {
                price_override: item.price_override,
                discount_type: item.discount_type,
                discount_value: item.discount_value,
                pricing_model: item.pricing_model,
                override_reason: item.override_reason,
                inventory_unit_id: item.inventory_unit_id ?? null,
              },
            });
          }
          const { error } = await supabase.from("booking_items").update(payload).eq("id", item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("booking_items").insert(payload);
          if (error) throw error;
          if (isOverride) {
            overrideEvents.push({ item_id: null, product: item.product_name, before: null, after: payload });
          }
        }
      }

      // Audit log
      const itemsCountDelta = draft.items.length - (booking.items?.length ?? 0);
      if (itemsCountDelta !== 0) changes.items_count = [booking.items?.length ?? 0, draft.items.length];
      if (Object.keys(changes).length > 0) {
        await supabase.from("booking_audit_log").insert({
          booking_id: booking.id,
          actor_user_id: userId,
          action: "update",
          changes,
        });
      }
      for (const ev of overrideEvents) {
        await supabase.from("booking_audit_log").insert({
          booking_id: booking.id,
          actor_user_id: userId,
          action: "line_override",
          entity_type: "booking_items",
          entity_id: ev.item_id,
          changes: ev,
        });
      }

      toast.success("Pedido guardado");
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-edit"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-audit"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => formatCurrency(n, i18n.language);

  return (
    <Dialog open={!!bookingId || !!isCreatingNew} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        {(!draft || (!!bookingId && (isLoading || !booking))) ? (
          <div className="py-10 text-center text-secondary">Cargando…</div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono flex items-center gap-3">
                {isCreatingNew ? "Nueva reserva" : booking?.reference}
                <Badge variant="secondary">{STATUS_LABELS[draft.status] ?? draft.status}</Badge>
                <Badge variant="outline">{PAYMENT_LABELS[draft.payment_status] ?? draft.payment_status}</Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 mt-2">
              {/* Status + payment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Estado operativo</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BOOKING_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado de pago</Label>
                  <Select value={draft.payment_status} onValueChange={(v) => setDraft({ ...draft, payment_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{PAYMENT_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Customer */}
              {isCreatingNew ? (
                <CustomerPicker
                  value={selectedCustomer?.id ?? null}
                  onChange={(c) => setSelectedCustomer(c)}
                />
              ) : (
                <div className="rounded-md border border-border p-3 text-sm">
                  <div className="font-medium">{(booking as any).customer?.full_name}</div>
                  <div className="text-secondary">{(booking as any).customer?.email} · {(booking as any).customer?.phone ?? "—"}</div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Inicio</Label>
                  <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>Fin</Label>
                  <Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
                </div>
              </div>

              {/* Retroactive warning */}
              {draft.start_date < new Date().toISOString().split('T')[0] && (
                <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                  ⚠ La fecha de inicio es anterior a hoy. Se registrará como reserva retroactiva en el historial.
                </div>
              )}

              {/* "Already completed" shortcut — create mode only */}
              {isCreatingNew && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="already-completed"
                    checked={alreadyCompleted}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      setAlreadyCompleted(checked);
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              status: checked ? "finalizado" : "nuevo",
                              payment_status: checked ? "paid" : "unpaid",
                            }
                          : d
                      );
                    }}
                  />
                  <label htmlFor="already-completed" className="text-sm cursor-pointer select-none">
                    Reserva ya completada (marcar como finalizada y pagada)
                  </label>
                </div>
              )}


              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Productos</h3>
                  <Button size="sm" variant="outline" onClick={addItem} className="gap-1">
                    <Plus className="h-4 w-4" /> Añadir
                  </Button>
                </div>
                <div className="space-y-3">
                  {draft.items.map((item, idx) => {
                    const product: any = products.find((p: any) => p.id === item.product_id);
                    const variants = product?.product_variants ?? [];
                    const br = breakdown!.items[idx];
                    return (
                      <div key={idx} className="rounded-md border border-border p-3 space-y-2">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-12 md:col-span-5">
                            <Label className="text-xs">Producto</Label>
                            <Select value={item.product_id} onValueChange={(v) => onPickProduct(idx, v)}>
                              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                              <SelectContent>
                                {products.map((p: any) => (
                                  <SelectItem key={p.id} value={p.id}>{p.name_es}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-12 md:col-span-3">
                            <Label className="text-xs">Variante</Label>
                            <Select
                              value={item.variant_id ?? "__none__"}
                              onValueChange={(v) => onPickVariant(idx, v)}
                              disabled={!variants.length}
                            >
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— ninguna —</SelectItem>
                                {variants.map((v: any) => (
                                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-4 md:col-span-1">
                            <Label className="text-xs">Qty</Label>
                            <Input type="number" min={1} value={item.quantity}
                              onChange={(e) => updateItem(idx, { quantity: Math.max(1, +e.target.value || 1) })} />
                          </div>
                          <div className="col-span-4 md:col-span-1">
                            <Label className="text-xs">Días</Label>
                            <Input type="number" min={1} value={item.days}
                              onChange={(e) => updateItem(idx, { days: Math.max(1, +e.target.value || 1) })} />
                          </div>
                          <div className="col-span-3 md:col-span-1">
                            <Label className="text-xs">€/día</Label>
                            <Input type="number" step="0.01" value={item.price_day}
                              onChange={(e) => updateItem(idx, { price_day: +e.target.value || 0 })} />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-12 gap-2 items-end pt-1 border-t border-border">
                          <div className="col-span-4 md:col-span-3">
                            <Label className="text-xs">Descuento línea</Label>
                            <Select value={item.discount_type} onValueChange={(v) => updateItem(idx, { discount_type: v as DiscountType })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Ninguno</SelectItem>
                                <SelectItem value="fixed">Fijo €</SelectItem>
                                <SelectItem value="percent">%</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-4 md:col-span-2">
                            <Label className="text-xs">Valor</Label>
                            <Input type="number" step="0.01" value={item.discount_value}
                              disabled={item.discount_type === "none"}
                              onChange={(e) => updateItem(idx, { discount_value: +e.target.value || 0 })} />
                          </div>
                          <div className="col-span-4 md:col-span-3">
                            <Label className="text-xs">Override subtotal</Label>
                            <Input type="number" step="0.01" placeholder="auto"
                              value={item.price_override ?? ""}
                              onChange={(e) => updateItem(idx, { price_override: e.target.value === "" ? null : +e.target.value })} />
                          </div>
                          <div className="col-span-12 md:col-span-4 text-right text-sm">
                            <div className="text-secondary text-xs">Auto: {fmt(br.auto_subtotal)}</div>
                            <div className="font-medium">Total línea: {fmt(br.final_subtotal)}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-6 md:col-span-3">
                            <Label className="text-xs">Pricing model</Label>
                            <Select
                              value={(item.pricing_model ?? "premium") as string}
                              onValueChange={(v) => updateItem(idx, { pricing_model: v as PricingModel })}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.keys(PRICING_MODEL_LABELS) as PricingModel[]).map((m) => (
                                  <SelectItem key={m} value={m}>{PRICING_MODEL_LABELS[m]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-12 md:col-span-9">
                            <Label className="text-xs">Motivo de override</Label>
                            <Input
                              placeholder="Ej: cliente recurrente, ampliación, prueba…"
                              value={item.override_reason ?? ""}
                              onChange={(e) => updateItem(idx, { override_reason: e.target.value || null })}
                            />
                          </div>
                        </div>

                        {(() => {
                          const productUnits = inventoryUnits.filter((u: any) => u.product_id === item.product_id);
                          return (
                            <div className="grid grid-cols-12 gap-2 items-end pt-1 border-t border-border">
                              <div className="col-span-12 md:col-span-6">
                                <Label className="text-xs">Unidad de inventario asignada</Label>
                                <Select
                                  value={item.inventory_unit_id ?? "__none__"}
                                  onValueChange={(v) => updateItem(idx, { inventory_unit_id: v === "__none__" ? null : v })}
                                  disabled={!item.product_id}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={productUnits.length ? "Auto-asignar al pagar" : "Sin unidades definidas"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Auto / sin unidad —</SelectItem>
                                    {productUnits.map((u: any) => (
                                      <SelectItem key={u.id} value={u.id}>
                                        {u.serial || u.internal_code || u.id.slice(0, 8)} · {u.agreement_type} · {u.owner_split_pct}% owner
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-12 md:col-span-6 text-[11px] text-secondary">
                                {productUnits.length === 0
                                  ? "⚠ Sin unidades: al pagar se registrará como company-owned sin payout."
                                  : "El payout y owner se resuelven desde la unidad seleccionada."}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                  {draft.items.length === 0 && (
                    <p className="text-secondary text-sm text-center py-4">Sin productos</p>
                  )}
                </div>
              </section>

              {/* Global discount + fees */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-md border border-border p-3 space-y-2">
                  <h4 className="font-medium text-sm">Descuento global</h4>
                  <div className="flex gap-2">
                    <Select value={draft.discount_type} onValueChange={(v) => setDraft({ ...draft, discount_type: v as DiscountType })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguno</SelectItem>
                        <SelectItem value="fixed">Fijo €</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" step="0.01" value={draft.discount_value}
                      disabled={draft.discount_type === "none"}
                      onChange={(e) => setDraft({ ...draft, discount_value: +e.target.value || 0 })} />
                  </div>
                </div>
                <div className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Fees extra</h4>
                    <Button size="sm" variant="ghost" className="gap-1"
                      onClick={() => setDraft({ ...draft, extra_fees: [...draft.extra_fees, { label: "", amount: 0 }] })}>
                      <Plus className="h-3 w-3" /> Añadir
                    </Button>
                  </div>
                  {draft.extra_fees.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <Input placeholder="Concepto" value={f.label}
                        onChange={(e) => {
                          const next = [...draft.extra_fees];
                          next[i] = { ...next[i], label: e.target.value };
                          setDraft({ ...draft, extra_fees: next });
                        }} />
                      <Input type="number" step="0.01" className="w-28" value={f.amount}
                        onChange={(e) => {
                          const next = [...draft.extra_fees];
                          next[i] = { ...next[i], amount: +e.target.value || 0 };
                          setDraft({ ...draft, extra_fees: next });
                        }} />
                      <Button size="icon" variant="ghost"
                        onClick={() => setDraft({ ...draft, extra_fees: draft.extra_fees.filter((_, j) => j !== i) })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Summary */}
              <section className="rounded-md border border-border p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-secondary">Subtotal automático</span><span>{fmt(breakdown!.auto_subtotal)}</span></div>
                {breakdown!.items_discount_total > 0 && (
                  <div className="flex justify-between text-secondary"><span>Descuentos por línea</span><span>-{fmt(breakdown!.items_discount_total)}</span></div>
                )}
                {breakdown!.global_discount_amount > 0 && (
                  <div className="flex justify-between text-secondary"><span>Descuento global</span><span>-{fmt(breakdown!.global_discount_amount)}</span></div>
                )}
                {breakdown!.extra_fees_total > 0 && (
                  <div className="flex justify-between text-secondary"><span>Fees extra</span><span>+{fmt(breakdown!.extra_fees_total)}</span></div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Override subtotal</Label>
                  <Input type="number" step="0.01" className="w-32" placeholder="auto"
                    value={draft.subtotal_override ?? ""}
                    onChange={(e) => setDraft({ ...draft, subtotal_override: e.target.value === "" ? null : +e.target.value })} />
                </div>
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Override total</Label>
                  <Input type="number" step="0.01" className="w-32" placeholder="auto"
                    value={draft.total_override ?? ""}
                    onChange={(e) => setDraft({ ...draft, total_override: e.target.value === "" ? null : +e.target.value })} />
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-base font-medium"><span>Total final</span><span>{fmt(breakdown!.total)}</span></div>
                <div className="flex justify-between text-secondary"><span>Fianza</span><span>{fmt(breakdown!.deposit_total)}</span></div>
              </section>

              {/* Notes */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Notas generales</Label>
                  <Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                </div>
                <div>
                  <Label>Notas internas (no visibles para el cliente)</Label>
                  <Textarea rows={3} value={draft.internal_notes} onChange={(e) => setDraft({ ...draft, internal_notes: e.target.value })} />
                </div>
              </section>

              {/* Communications + PDF */}
              {booking && <BookingCommunications booking={booking} />}

              {/* Audit log */}
              <section>
                <Button variant="ghost" size="sm" className="gap-2" onClick={() => setShowLog((v) => !v)}>
                  <History className="h-4 w-4" /> Historial ({auditLog.length})
                </Button>
                {showLog && (
                  <ul className="mt-2 space-y-1 text-xs text-secondary border-t border-border pt-2">
                    {auditLog.length === 0 && <li>Sin cambios registrados</li>}
                    {auditLog.map((l: any) => (
                      <li key={l.id} className="flex justify-between gap-3">
                        <span>{new Date(l.created_at).toLocaleString(i18n.language)}</span>
                        <span className="font-mono truncate">{JSON.stringify(l.changes)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={save} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
