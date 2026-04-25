import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { ArrowLeft } from "lucide-react";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("blog_posts").select("*").eq("slug", slug!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) return <div className="container-page py-20 text-secondary">{t("common.loading")}</div>;
  if (!post) return <div className="container-page py-20">404</div>;

  return (
    <article className="container-page py-12 max-w-3xl">
      <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> {t("blog.back")}
      </Link>
      <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight">
        {localized(post, "title", i18n.language)}
      </h1>
      <div className="mt-8 prose prose-stone max-w-none whitespace-pre-line text-foreground">
        {localized(post, "content", i18n.language)}
      </div>
    </article>
  );
};

export default BlogPost;
