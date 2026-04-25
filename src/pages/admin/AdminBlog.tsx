import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AdminBlog = () => {
  const { t, i18n } = useTranslation();
  const { data = [] } = useQuery({
    queryKey: ["admin-blog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div>
      <h1 className="text-2xl font-display font-medium mb-6">{t("admin.blog")}</h1>
      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>{t("common.name")}</TableHead><TableHead>Slug</TableHead><TableHead>{t("common.status")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-secondary py-8">{t("blog.empty")}</TableCell></TableRow>
            ) : data.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{localized(p, "title", i18n.language)}</TableCell>
                <TableCell className="font-mono text-xs text-secondary">{p.slug}</TableCell>
                <TableCell>{p.published ? t("admin.published") : t("admin.hidden")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-secondary mt-4">Editor enriquecido y CRUD → siguiente iteración.</p>
    </div>
  );
};

export default AdminBlog;
