import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { Badge } from "@/components/ui/badge";

const AdminTags = () => {
  const { t, i18n } = useTranslation();
  const { data = [] } = useQuery({
    queryKey: ["admin-tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("slug");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div>
      <h1 className="text-2xl font-display font-medium mb-6">{t("admin.tags")}</h1>
      <div className="flex flex-wrap gap-2 p-6 rounded-xl bg-surface border border-border">
        {data.map((tag: any) => (
          <Badge key={tag.id} variant="secondary" className="bg-muted text-foreground font-normal">
            {localized(tag, "name", i18n.language)}
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default AdminTags;
