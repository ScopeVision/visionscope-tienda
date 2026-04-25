import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { formatCurrency } from "@/lib/rental";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AdminProducts = () => {
  const { t, i18n } = useTranslation();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-display font-medium mb-6">{t("admin.products")}</h1>
      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("admin.categories")}</TableHead>
              <TableHead className="text-right">{t("common.perDay")}</TableHead>
              <TableHead className="text-right">{t("common.deposit")}</TableHead>
              <TableHead className="text-right">{t("admin.stock")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-secondary py-8">{t("common.loading")}</TableCell></TableRow>
            ) : products.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{localized(p, "name", i18n.language)}</TableCell>
                <TableCell className="text-secondary">{p.category ? localized(p.category, "name", i18n.language) : "—"}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(p.price_day), i18n.language)}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(p.deposit), i18n.language)}</TableCell>
                <TableCell className="text-right">{p.stock}</TableCell>
                <TableCell>
                  <span className={p.published ? "text-accent" : "text-secondary"}>
                    {p.published ? t("admin.published") : t("admin.hidden")}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-secondary mt-4">
        Edición CRUD completa, subida de imágenes y formularios → siguiente iteración.
      </p>
    </div>
  );
};

export default AdminProducts;
