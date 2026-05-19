import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Play } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";

export type ProjectItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_image: string;
  gallery: string[];
  category: string;
  client: string;
  year: number | null;
  link_url: string;
  sort_order: number;
};

const Projects = () => {
  const { t } = useTranslation();

  const { data: projects = [] } = useQuery({
    queryKey: ["public-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_items" as any)
        .select("*")
        .eq("published", true)
        .order("sort_order");
      if (error) throw error;
      return ((data ?? []) as unknown) as ProjectItem[];
    },
  });

  return (
    <div className="container-page py-20">
      <div className="mb-12">
        <span className="cine-eyebrow">{t("projects.eyebrow")}</span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-medium tracking-tight uppercase">
          {t("projects.title")}
        </h1>
        <p className="text-secondary mt-3 max-w-xl">{t("projects.subtitle")}</p>
      </div>

      {projects.length === 0 ? (
        <p className="text-secondary text-center py-24">—</p>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 [column-fill:_balance]">
          {projects.map((p, idx) => {
            const span = idx % 3 === 0 ? "tall" : idx % 3 === 1 ? "wide" : "normal";
            const isExternal = p.link_url && /^https?:/.test(p.link_url);
            const href = p.link_url || `/projects/${p.slug}`;
            const Wrapper: any = isExternal ? "a" : Link;
            const wrapperProps: any = isExternal
              ? { href, target: "_blank", rel: "noopener noreferrer" }
              : { to: href };

            return (
              <Wrapper
                key={p.id}
                {...wrapperProps}
                className="group relative block mb-5 break-inside-avoid rounded-sm overflow-hidden border border-border bg-surface transition-smooth hover-glow"
              >
                <div className={span === "tall" ? "aspect-[3/4]" : span === "wide" ? "aspect-[16/10]" : "aspect-[4/3]"}>
                  <img
                    src={p.cover_image}
                    alt={p.title}
                    loading="lazy"
                    className="w-full h-full object-cover opacity-85 transition-all duration-500 group-hover:opacity-100 group-hover:scale-[1.03]"
                  />
                </div>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none mix-blend-overlay"
                  style={{ background: "radial-gradient(ellipse at center, hsl(46 86% 62% / 0.18), transparent 70%)" }}
                  aria-hidden
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                <div className="absolute top-4 right-4 grid place-items-center w-10 h-10 rounded-full bg-accent text-accent-foreground opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                  <Play className="h-4 w-4 fill-current" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  {(p.client || p.year) && (
                    <div className="text-[10px] uppercase tracking-[0.28em] text-accent">
                      {[p.client, p.year].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  <h3 className="mt-1.5 text-xl font-medium uppercase tracking-[0.06em] text-foreground group-hover:text-accent transition-colors">
                    {p.title}
                  </h3>
                  <div className="mt-2 h-px w-8 bg-accent transition-all duration-300 group-hover:w-20" />
                </div>
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Projects;
