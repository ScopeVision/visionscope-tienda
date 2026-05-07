import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import type { ProjectItem } from "./Projects";

const ProjectDetail = () => {
  const { t } = useTranslation();
  const { slug } = useParams();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_items" as any)
        .select("*")
        .eq("slug", slug!)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown) as ProjectItem | null;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return <div className="container-page py-32 text-center text-secondary">…</div>;
  }
  if (!project) {
    return (
      <div className="container-page py-32 text-center">
        <p className="text-secondary">404</p>
        <Link to="/projects" className="mt-4 inline-block text-accent uppercase tracking-[0.22em] text-xs">
          {t("projects.back")}
        </Link>
      </div>
    );
  }

  const credits = [
    { label: t("projects.role.client"), value: project.client },
    { label: t("projects.role.year"), value: project.year ? String(project.year) : "" },
    { label: "Categoría", value: project.category },
  ].filter((c) => c.value);

  return (
    <div>
      <section className="relative -mt-16 h-[80vh] min-h-[520px] w-full overflow-hidden grain">
        <img src={project.cover_image} alt={project.title} className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, hsl(0 0% 4% / 0.55) 0%, hsl(0 0% 4% / 0.25) 35%, hsl(0 0% 4% / 0.9) 100%)",
          }}
          aria-hidden
        />
        <div className="relative z-10 h-full container-page flex flex-col justify-end pb-16 pt-24">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-secondary hover:text-accent w-fit"
          >
            <ArrowLeft className="h-3 w-3" /> {t("projects.back")}
          </Link>
          {(project.client || project.year) && (
            <div className="mt-6 cine-eyebrow">
              {[project.client, project.year].filter(Boolean).join(" · ")}
            </div>
          )}
          <h1 className="mt-3 text-4xl md:text-6xl lg:text-7xl font-display font-medium tracking-tight uppercase text-foreground max-w-4xl text-balance">
            {project.title}
          </h1>
        </div>
      </section>

      <section className="container-page py-20 grid lg:grid-cols-[1.6fr_1fr] gap-14">
        <div>
          <p className="text-lg text-foreground/90 leading-relaxed max-w-2xl whitespace-pre-line">
            {project.description}
          </p>
          {project.gallery && project.gallery.length > 0 && (
            <div className="mt-10 grid grid-cols-2 gap-4">
              {project.gallery.map((url, i) => (
                <img key={i} src={url} alt="" className="w-full rounded-sm border border-border" />
              ))}
            </div>
          )}
        </div>
        {credits.length > 0 && (
          <aside>
            <h2 className="cine-eyebrow">{t("projects.credits")}</h2>
            <dl className="mt-6 divide-y divide-border border-y border-border">
              {credits.map((c) => (
                <div key={c.label} className="grid grid-cols-[110px_1fr] gap-4 py-4">
                  <dt className="text-[11px] uppercase tracking-[0.22em] text-secondary self-center">{c.label}</dt>
                  <dd className="text-sm text-accent font-medium">{c.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        )}
      </section>
    </div>
  );
};

export default ProjectDetail;
