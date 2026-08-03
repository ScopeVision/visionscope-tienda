import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Search, Save } from "lucide-react";

const STATUSES = [
  { value: "active", label: "Activo", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  { value: "observation", label: "En observación", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  { value: "test", label: "Prueba", className: "bg-muted text-secondary border-border" },
  { value: "inactive", label: "Inactivo", className: "bg-slate-500/15 text-slate-500 border-slate-500/30" },
  { value: "blocked", label: "Bloqueado", className: "bg-destructive/15 text-destructive border-destructive/30" },
] as const;

const statusMeta = (value?: string | null) =>
  STATUSES.find((s) => s.value === value) ?? STATUSES[0];

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-ES") : "—";

type Customer = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  tax_id: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  bookings?: { id: string }[];
};

const EDITABLE_FIELDS: { key: keyof Customer; label: string; type?: string }[] = [
  { key: "full_name", label: "Nombre" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Teléfono" },
  { key: "company", label: "Empresa" },
  { key: "tax_id", label: "NIF/CIF" },
  { key: "address_line1", label: "Dirección" },
  { key: "address_line2", label: "Dirección (línea 2)" },
  { key: "city", label: "Ciudad" },
  { key: "postal_code", label: "Código postal" },
  { key: "country", label: "País" },
];

const AdminCustomers = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [saving, setSaving] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, full_name, email, phone, company, tax_id, address_line1, address_line2, city, postal_code, country, notes, status, created_at, updated_at, bookings:bookings(id)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Customer[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((c) => {
      if (statusFilter !== "all" && (c.status ?? "active") !== statusFilter) return false;
      if (!q) return true;
      return (
        (c.full_name ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, statusFilter]);

  const openEditor = (c: Customer) => {
    setEditing(c);
    setForm({ ...c });
  };

  const setField = (key: keyof Customer, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!editing) return;
    const name = (form.full_name ?? "").trim();
    const email = (form.email ?? "").trim();
    if (!name) return toast.error("El nombre es obligatorio");
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.error("Email no válido");

    setSaving(true);
    const { error } = await supabase
      .from("customers")
      .update({
        full_name: name,
        email: email.toLowerCase(),
        phone: form.phone?.trim() || null,
        company: form.company?.trim() || null,
        tax_id: form.tax_id?.trim() || null,
        address_line1: form.address_line1?.trim() || null,
        address_line2: form.address_line2?.trim() || null,
        city: form.city?.trim() || null,
        postal_code: form.postal_code?.trim() || null,
        country: form.country?.trim() || null,
        notes: form.notes?.trim() || null,
        status: form.status ?? "active",
      } as any)
      .eq("id", editing.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Guardado");
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-medium mb-6">{t("admin.customers")}</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("common.phone")}</TableHead>
              <TableHead>{t("common.company")}</TableHead>
              <TableHead>Fecha de alta</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-secondary py-8">{t("common.loading")}</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-secondary py-8">Sin resultados</TableCell></TableRow>
            ) : filtered.map((c) => {
              const meta = statusMeta(c.status);
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => openEditor(c)}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell className="text-secondary">{c.email}</TableCell>
                  <TableCell className="text-secondary">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-secondary">{c.company ?? "—"}</TableCell>
                  <TableCell className="text-secondary">{formatDate(c.created_at)}</TableCell>
                  <TableCell className="text-right">{c.bookings?.length ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Editar cliente</SheetTitle>
            <SheetDescription>
              Alta: {formatDateTime(editing?.created_at)} · Última actualización: {formatDateTime(editing?.updated_at)}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Estado</Label>
              <Select value={(form.status as string) ?? "active"} onValueChange={(v) => setField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {EDITABLE_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">{f.label}</Label>
                  <Input
                    type={f.type ?? "text"}
                    value={((form[f.key] as string) ?? "")}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Notas</Label>
              <Textarea
                rows={4}
                value={(form.notes as string) ?? ""}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
              <Button onClick={save} disabled={saving} className="gap-2 bg-foreground text-background hover:bg-foreground/90">
                <Save className="h-4 w-4" /> {saving ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminCustomers;
