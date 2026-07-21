import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, ClipboardList, Users, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Stat = ({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) => (
  <div className="p-6 rounded-xl bg-surface border border-border">
    <Icon className="h-5 w-5 text-accent mb-3" />
    <div className="text-3xl font-display font-medium">{value}</div>
    <div className="text-sm text-secondary mt-1">{label}</div>
  </div>
);

type Settings = {
  orders_email: string;
  contact_email: string;
  whatsapp_url: string;
  instagram_url: string;
};

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: products }, { count: bookings }, { count: customers }, { count: pending }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("bookings").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "nuevo"),
      ]);
      return { products: products ?? 0, bookings: bookings ?? 0, customers: customers ?? 0, pending: pending ?? 0 };
    },
  });

  const [settings, setSettings] = useState<Settings>({
    orders_email: "",
    contact_email: "",
    whatsapp_url: "",
    instagram_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings" as any)
        .select("*")
        .maybeSingle();
      if (data) setSettings(data as any);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings" as any)
      .update(settings)
      .eq("id", true);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Guardado");
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-display font-medium mb-6">{t("admin.dashboard")}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label={t("admin.products.label")} value={data?.products ?? 0} icon={Package} />
          <Stat label={t("admin.bookings")} value={data?.bookings ?? 0} icon={ClipboardList} />
          <Stat label={t("bookings.tabs.nuevo")} value={data?.pending ?? 0} icon={ClipboardList} />
          <Stat label={t("admin.customers")} value={data?.customers ?? 0} icon={Users} />
        </div>
      </div>

      <div className="p-6 rounded-xl bg-surface border border-border max-w-2xl">
        <h2 className="text-lg font-medium mb-1">Datos de contacto</h2>
        <p className="text-sm text-secondary mb-5">
          Estos datos se usan para notificaciones de pedidos y enlaces públicos del sitio.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">
              Email para pedidos
            </Label>
            <Input
              value={settings.orders_email}
              onChange={(e) => setSettings({ ...settings, orders_email: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">
              Email de contacto general
            </Label>
            <Input
              value={settings.contact_email}
              onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">
              WhatsApp (URL)
            </Label>
            <Input
              value={settings.whatsapp_url}
              onChange={(e) => setSettings({ ...settings, whatsapp_url: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">
              Instagram (URL)
            </Label>
            <Input
              value={settings.instagram_url}
              onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })}
            />
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="mt-5 gap-2 bg-foreground text-background hover:bg-foreground/90">
          <Save className="h-4 w-4" /> {saving ? t("common.loading") : t("common.save")}
        </Button>
      </div>

      <InternalCodePinSection />
    </div>
  );
};

const InternalCodePinSection = () => {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [currentInput, setCurrentInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings" as any)
        .select("internal_code_pin")
        .maybeSingle();
      if (data) setCurrent((data as any).internal_code_pin ?? null);
    })();
  }, []);

  const save = async () => {
    if (!/^\d{4}$/.test(pin)) {
      toast.error("El PIN debe tener exactamente 4 dígitos");
      return;
    }
    if (pin !== confirm) {
      toast.error("Los PIN no coinciden");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("site_settings" as any)
      .update({ internal_code_pin: pin })
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCurrent(pin);
    setPin("");
    setConfirm("");
    toast.success("PIN guardado");
  };

  return (
    <div className="p-6 rounded-xl bg-surface border border-border max-w-2xl">
      <h2 className="text-lg font-medium mb-1">Códigos Internos</h2>
      <p className="text-sm text-secondary mb-5">
        PIN de 4 dígitos requerido para editar manualmente el código interno de un producto.
        {current ? " Ya hay un PIN configurado; introduce uno nuevo para cambiarlo." : " No hay PIN configurado."}
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">PIN</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Confirmar PIN</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
          />
        </div>
      </div>
      <Button onClick={save} disabled={saving} className="mt-5 gap-2 bg-foreground text-background hover:bg-foreground/90">
        <Save className="h-4 w-4" /> {saving ? t("common.loading") : t("common.save")}
      </Button>
    </div>
  );
};

export default AdminDashboard;
