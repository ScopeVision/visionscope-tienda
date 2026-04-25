import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { format } from "date-fns";

const Blog = () => {
  const { t, i18n } = useTranslation();
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight">{t("blog.title")}</h1>
      <p className="text-secondary mt-2">{t("blog.subtitle")}</p>
      <div className="mt-10 space-y-5">
        {isLoading ? (
          <p className="text-secondary">{t("common.loading")}</p>
        ) : posts.length === 0 ? (
          <p className="text-secondary">{t("blog.empty")}</p>
        ) : (
          posts.map((p: any) => (
            <Link
              key={p.id}
              to={`/blog/${p.slug}`}
              className="block p-6 rounded-xl bg-surface border border-border hover:border-accent hover:shadow-card transition-smooth"
            >
              <div className="text-xs text-secondary mb-2">
                {p.published_at ? format(new Date(p.published_at), "PP") : ""}
              </div>
              <h2 className="text-xl font-medium">{localized(p, "title", i18n.language)}</h2>
              <p className="text-secondary mt-2 line-clamp-2">{localized(p, "excerpt", i18n.language)}</p>
              <span className="text-accent text-sm mt-3 inline-block">{t("blog.readMore")} →</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default Blog;
