import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Play } from "lucide-react";
import { PROJECTS } from "./Projects";
import { Button } from "@/components/ui/button";

const ProjectDetail = () => {
  const { t } = useTranslation();
  const { slug } = useParams();
  const project = PROJECTS.find((p) => p.slug === slug);

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
    { label: t("projects.role.year"), value: String(project.year) },
    { label: t("projects.role.director"), value: project.director },
    { label: t("projects.role.dop"), value: project.dop },
    { label: t("projects.role.production"), value: project.production },
  ];

  return (
    <div>
      {/* Hero video / image */}
      <section className="relative -mt-16 h-[80vh] min-h-[520px] w-full overflow-hidden grain">
        {project.video ? (
          <video
            src={project.video}
            poster={project.cover}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <img src={project.cover} alt={project.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
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
          <div className="mt-6 cine-eyebrow">
            {project.client} · {project.year}
          </div>
          <h1 className="mt-3 text-4xl md:text-6xl lg:text-7xl font-display font-medium tracking-tight uppercase text-foreground max-w-4xl text-balance">
            {project.title}
          </h1>

          {!project.video && (
            <Button
              className="mt-8 self-start bg-accent text-accent-foreground hover:bg-accent/90 gap-2 uppercase tracking-[0.2em] text-xs h-12 px-7 rounded-sm"
            >
              <Play className="h-4 w-4 fill-current" /> {t("projects.watch")}
            </Button>
          )}
        </div>
      </section>

      {/* Body */}
      <section className="container-page py-20 grid lg:grid-cols-[1.6fr_1fr] gap-14">
        <div>
          <p className="text-lg text-foreground/90 leading-relaxed max-w-2xl">
            {project.description}
          </p>
        </div>
        <aside>
          <h2 className="cine-eyebrow">{t("projects.credits")}</h2>
          <dl className="mt-6 divide-y divide-border border-y border-border">
            {credits.map((c) => (
              <div key={c.label} className="grid grid-cols-[110px_1fr] gap-4 py-4">
                <dt className="text-[11px] uppercase tracking-[0.22em] text-secondary self-center">
                  {c.label}
                </dt>
                <dd className="text-sm text-accent font-medium">{c.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>
    </div>
  );
};

export default ProjectDetail;
