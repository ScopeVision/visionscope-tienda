import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Package2, Save } from "lucide-react";

const sb = supabase as any;

const AGREEMENTS = [
  { value: "company_owned", label: "Company owned (100% empresa)" },
  { value: "split_70_30", label: "Split 70/30 (owner 70%)" },
  { value: "custom_split", label: "Custom split" },
  { value: "concession", label: "Concesión" },
  { value: "external_managed", label: "Gestionado externo" },
];

/**
 * Inline asset/owner deal panel for a single product.
 * The asset deal belongs to the PRODUCT, not globally to the person:
 * the same owner can have different splits per product.
 */
export function ProductOwnerDeal({ productId, productName }: { productId?: string; productName?: string }) {
  const qc = useQueryClient();

  const { data: owners = [] } = useQuery({
    queryKey: ["product-owner-deal-owners"],
    queryFn: async () =>
      (await sb.from("finance_owners").select("id, name, type, default_company_pct").eq("active", true).order("name")).data || [],
  });

  const { data: asset, isLoading } = useQuery({
    enabled: !!productId,
    queryKey: ["product-asset", productId],
    queryFn: async () =>
      (await sb.from("finance_assets").select("*").eq("product_id", productId).maybeSingle()).data,
  });

  const [draft, setDraft] = useState<any>({
    owner_id: null,
    agreement_type: "company_owned",
    owner_split_pct: 0,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (asset) {
      setDraft({
        owner_id: asset.owner_id,
        agreement_type: asset.agreement_type ?? "company_owned",
        owner_split_pct: Number(asset.owner_split_pct ?? 0),
        notes: asset.notes ?? "",
      });
    }
  }, [asset]);

  if (!productId) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-secondary">
        Guarda el producto primero para asignar owner / asset deal.
      </div>
    );
  }

  const split = draft.agreement_type === "split_70_30" ? 70
    : draft.agreement_type === "company_owned" ? 0
    : Number(draft.owner_split_pct || 0);

  const save = async () => {
    if (draft.agreement_type !== "company_owned" && !draft.owner_id) {
      return toast.error("Selecciona un owner para este deal");
    }
    setSaving(true);
    try {
      const payload: any = {
        product_id: productId,
        name: productName || asset?.name || "Asset",
        owner_id: draft.agreement_type === "company_owned" ? null : draft.owner_id,
        agreement_type: draft.agreement_type,
        owner_split_pct: split,
        custom_company_pct: 100 - split,
        notes: draft.notes || null,
        active: true,
      };
      const res = asset?.id
        ? await sb.from("finance_assets").update(payload).eq("id", asset.id)
        : await sb.from("finance_assets").insert(payload);
      if (res.error) throw res.error;
      toast.success("Asset deal guardado");
      qc.invalidateQueries({ queryKey: ["product-asset", productId] });
      qc.invalidateQueries({ queryKey: ["finance-assets"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Package2 className="h-4 w-4 text-accent" />
        <Label className="text-xs uppercase tracking-wider text-secondary">
          Owner / Asset deal
        </Label>
        <span className="text-[10px] text-secondary ml-auto">
          payouts operativos · NO equity de empresa
        </span>
      </div>

      {isLoading ? (
        <div className="text-xs text-secondary">Cargando…</div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Owner</Label>
              <Select
                value={draft.owner_id ?? "__none__"}
                onValueChange={(v) => setDraft({ ...draft, owner_id: v === "__none__" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sin owner (empresa)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin owner (empresa) —</SelectItem>
                  {owners.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name} · {o.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Agreement type</Label>
              <Select
                value={draft.agreement_type}
                onValueChange={(v) => setDraft({ ...draft, agreement_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AGREEMENTS.map((a) => (<SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {draft.agreement_type !== "company_owned" && draft.agreement_type !== "split_70_30" && (
            <div>
              <Label className="text-xs">% para el owner (0–100)</Label>
              <Input
                type="number" min={0} max={100}
                value={draft.owner_split_pct}
                onChange={(e) => setDraft({ ...draft, owner_split_pct: Number(e.target.value) })}
              />
            </div>
          )}

          <div className="text-[11px] text-secondary">
            Split aplicado por alquiler de este producto:
            <span className="ml-1 font-medium text-foreground">
              empresa {100 - split}% · owner {split}%
            </span>
          </div>

          <div>
            <Label className="text-xs">Notas (opcional)</Label>
            <Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>

          <Button type="button" size="sm" onClick={save} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {asset?.id ? "Actualizar deal" : "Crear deal"}
          </Button>
        </>
      )}
    </div>
  );
}
