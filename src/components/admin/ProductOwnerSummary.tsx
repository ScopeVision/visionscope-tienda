import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Boxes, Info } from "lucide-react";

const sb = supabase as any;

/**
 * Read-only summary of the real owner assignment for this product.
 * The financial engine (handle_booking_payment_change) resolves the owner
 * per physical unit via inventory_units, so this panel just reflects that
 * source of truth and links to the correct editor.
 */
export function ProductOwnerSummary({
  productId,
  onGoToUnits,
}: {
  productId?: string;
  onGoToUnits?: () => void;
}) {
  const { data: units = [], isLoading } = useQuery({
    enabled: !!productId,
    queryKey: ["product-owner-summary", productId],
    queryFn: async () => {
      const { data } = await sb
        .from("inventory_units")
        .select("id, serial, internal_code, owner_id, owner_split_pct, agreement_type, finance_owners:owner_id(name)")
        .eq("product_id", productId)
        .eq("active", true)
        .order("created_at");
      return data || [];
    },
  });

  if (!productId) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-secondary">
        Guarda el producto primero para ver la asignación de owners.
      </div>
    );
  }

  const ownerKeys = new Set(units.map((u: any) => u.owner_id ?? "__company__"));
  const mixedOwners = ownerKeys.size > 1;

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Boxes className="h-4 w-4 text-accent" />
        <span className="text-xs uppercase tracking-wider text-secondary">
          Owners de este producto
        </span>
        <span className="text-[10px] text-secondary ml-auto">
          fuente real de payouts · por unidad de inventario
        </span>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2 text-[11px] text-secondary">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          El owner y el split se definen por unidad física en el panel de
          Unidades de Inventario. Este bloque es solo informativo.
        </span>
      </div>

      {isLoading ? (
        <div className="text-xs text-secondary">Cargando…</div>
      ) : units.length === 0 ? (
        <div className="text-xs text-secondary">
          Este producto no tiene unidades de inventario asignadas todavía.
        </div>
      ) : (
        <>
          {mixedOwners && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Atención: este producto tiene owners distintos según la unidad.
                Revisa cada unidad individualmente.
              </span>
            </div>
          )}
          <ul className="space-y-1.5">
            {units.map((u: any) => {
              const ownerName = u.owner_id ? (u.finance_owners?.name ?? "Owner") : "Empresa";
              const label = u.serial || u.internal_code || u.id.slice(0, 8);
              const split = Number(u.owner_split_pct ?? 0);
              return (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-2 text-xs border border-border rounded-md px-2 py-1.5"
                >
                  <span className="font-medium truncate">{label}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant={u.owner_id ? "secondary" : "outline"}>{ownerName}</Badge>
                    <span className="text-secondary">
                      empresa {100 - split}% · owner {split}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {onGoToUnits && (
        <button
          type="button"
          onClick={onGoToUnits}
          className="text-xs text-accent hover:underline"
        >
          Ir a Unidades de Inventario →
        </button>
      )}
    </div>
  );
}
