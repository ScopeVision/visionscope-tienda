import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AdminCategories = () => {
  const { t, i18n } = useTranslation();
  const { data = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div>
      <h1 className="text-2xl font-display font-medium mb-6">{t("admin.categories")}</h1>
      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Slug</TableHead><TableHead>{t("common.name")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs text-secondary">{c.slug}</TableCell>
                <TableCell className="font-medium">{localized(c, "name", i18n.language)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminCategories;
