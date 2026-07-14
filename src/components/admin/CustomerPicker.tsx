import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, UserPlus, X } from "lucide-react";

type SelectedCustomer = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
};

type Props = {
  value: string | null;
  onChange: (c: SelectedCustomer | null) => void;
};

export default function CustomerPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SelectedCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<SelectedCustomer | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = `%${query.trim()}%`;
        const { data, error } = await supabase
          .from("customers")
          .select("id, full_name, email, phone, company")
          .or(`full_name.ilike.${q},email.ilike.${q},phone.ilike.${q}`)
          .order("full_name")
          .limit(10);
        if (error) throw error;
        setResults(data ?? []);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const pick = (c: SelectedCustomer) => {
    setSelected(c);
    setQuery("");
    setShowDropdown(false);
    onChange(c);
  };

  const clear = () => {
    setSelected(null);
    onChange(null);
    setQuery("");
  };

  const createAndPick = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          full_name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          phone: newPhone.trim() || null,
          company: newCompany.trim() || null,
        })
        .select("id, full_name, email, phone, company")
        .single();
      if (error) throw error;
      toast.success("Cliente creado");
      pick(data);
      setShowCreateForm(false);
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewCompany("");
    } catch (e: any) {
      toast.error(e.message || "Error al crear cliente");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={wrapperRef} className="space-y-2">
      <Label>Cliente <span className="text-destructive">*</span></Label>

      {selected ? (
        <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
          <div>
            <div className="font-medium">{selected.full_name}</div>
            <div className="text-secondary text-xs">
              {selected.email}{selected.phone ? ` · ${selected.phone}` : ""}
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={clear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, email o teléfono…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary">…</span>
          )}
          {showDropdown && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
              {results.length === 0 ? (
                <div className="p-3 text-sm text-secondary">Sin resultados</div>
              ) : (
                results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onMouseDown={() => pick(c)}
                  >
                    <div className="font-medium">{c.full_name}</div>
                    <div className="text-xs text-secondary">
                      {c.email}{c.phone ? ` · ${c.phone}` : ""}
                    </div>
                  </button>
                ))
              )}
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-muted border-t border-border flex items-center gap-2"
                onMouseDown={() => { setShowDropdown(false); setShowCreateForm(true); }}
              >
                <UserPlus className="h-3.5 w-3.5" /> Crear cliente nuevo
              </button>
            </div>
          )}
        </div>
      )}

      {showCreateForm && !selected && (
        <div className="rounded-md border border-border p-3 space-y-2 bg-muted/30">
          <p className="text-sm font-medium">Nuevo cliente</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nombre <span className="text-destructive">*</span></Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div>
              <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@ejemplo.com" />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+34…" />
            </div>
            <div>
              <Label className="text-xs">Empresa</Label>
              <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowCreateForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={createAndPick} disabled={creating}>
              {creating ? "Creando…" : "Crear y seleccionar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
