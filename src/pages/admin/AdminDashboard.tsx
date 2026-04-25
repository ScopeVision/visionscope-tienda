import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, ClipboardList, Users } from "lucide-react";

const Stat = ({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) => (
  <div className="p-6 rounded-xl bg-surface border border-border">
    <Icon className="h-5 w-5 text-accent mb-3" />
    <div className="text-3xl font-display font-medium">{value}</div>
    <div className="text-sm text-secondary mt-1">{label}</div>
  </div>
);

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

  return (
    <div>
      <h1 className="text-2xl font-display font-medium mb-6">{t("admin.dashboard")}</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label={t("admin.products")} value={data?.products ?? 0} icon={Package} />
        <Stat label={t("admin.bookings")} value={data?.bookings ?? 0} icon={ClipboardList} />
        <Stat label={t("bookings.tabs.nuevo")} value={data?.pending ?? 0} icon={ClipboardList} />
        <Stat label={t("admin.customers")} value={data?.customers ?? 0} icon={Users} />
      </div>
    </div>
  );
};

export default AdminDashboard;
