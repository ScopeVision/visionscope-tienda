import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";

export type Project = {
  slug: string;
  title: string;
  client: string;
  year: number;
  director: string;
  dop: string;
  production: string;
  description: string;
  cover: string;
  video?: string; // mp4 / hls url (optional)
  span?: "tall" | "wide" | "normal"; // for masonry-like grid
};

export const PROJECTS: Project[] = [
  {
    slug: "northern-lights",
    title: "Northern Lights",
    client: "Aurora Films",
    year: 2024,
    director: "Elena Marín",
    dop: "Tomás Riera",
    production: "VisionScope Studio",
    description:
      "Pieza visual rodada en Islandia con cámara de cine digital y ópticas vintage. Una exploración del paisaje y la luz.",
    cover:
      "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=80",
    span: "tall",
  },
  {
    slug: "neon-city",
    title: "Neon City",
    client: "Lumen Agency",
    year: 2024,
    director: "Marc Vidal",
    dop: "Laia Puig",
    production: "VisionScope Studio",
    description: "Spot publicitario nocturno en Tokio. Ópticas anamórficas y cámaras Full Frame.",
    cover:
      "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1600&q=80",
    span: "wide",
  },
  {
    slug: "silent-coast",
    title: "Silent Coast",
    client: "Atlantic Docs",
    year: 2023,
    director: "Sara López",
    dop: "Jordi Aguilar",
    production: "VisionScope Studio",
    description: "Documental sobre la costa atlántica. Rodaje en formato Super 35 con luz natural.",
    cover:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "machine-room",
    title: "Machine Room",
    client: "Industria 4.0",
    year: 2023,
    director: "Pau Serra",
    dop: "Tomás Riera",
    production: "VisionScope Studio",
    description: "Pieza industrial cinematográfica con iluminación dramática y movimientos de cámara robóticos.",
    cover:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1600&q=80",
    span: "tall",
  },
  {
    slug: "midnight-drive",
    title: "Midnight Drive",
    client: "Velocity Records",
    year: 2024,
    director: "Marc Vidal",
    dop: "Laia Puig",
    production: "VisionScope Studio",
    description: "Videoclip rodado íntegramente de noche en carretera. Sistema gimbal + drone.",
    cover:
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1600&q=80",
    span: "wide",
  },
  {
    slug: "atelier",
    title: "Atelier",
    client: "Maison Vert",
    year: 2024,
    director: "Sara López",
    dop: "Jordi Aguilar",
    production: "VisionScope Studio",
    description: "Pieza de moda íntima y delicada en estudio. Iluminación motivada por ventanas naturales.",
    cover:
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1600&q=80",
  },
];

const Projects = () => {
  const { t } = useTranslation();
  return (
    <div className="container-page py-20">
      <div className="mb-12">
        <span className="cine-eyebrow">{t("projects.eyebrow")}</span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-medium tracking-tight uppercase">
          {t("projects.title")}
        </h1>
        <p className="text-secondary mt-3 max-w-xl">{t("projects.subtitle")}</p>
      </div>

      {/* Masonry-like layout via CSS columns */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 [column-fill:_balance]">
        {PROJECTS.map((p) => (
          <Link
            key={p.slug}
            to={`/projects/${p.slug}`}
            className={
              "group relative block mb-5 break-inside-avoid rounded-sm overflow-hidden border border-border bg-surface transition-smooth hover-glow"
            }
          >
            <div
              className={
                p.span === "tall"
                  ? "aspect-[3/4]"
                  : p.span === "wide"
                  ? "aspect-[16/10]"
                  : "aspect-[4/3]"
              }
            >
              <img
                src={p.cover}
                alt={p.title}
                loading="lazy"
                className="w-full h-full object-cover opacity-85 transition-all duration-500 group-hover:opacity-100 group-hover:scale-[1.03]"
              />
            </div>
            {/* Subtle yellow overlay on hover */}
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
              <div className="text-[10px] uppercase tracking-[0.28em] text-accent">
                {p.client} · {p.year}
              </div>
              <h3 className="mt-1.5 text-xl font-medium uppercase tracking-[0.06em] text-foreground group-hover:text-accent transition-colors">
                {p.title}
              </h3>
              <div className="mt-2 h-px w-8 bg-accent transition-all duration-300 group-hover:w-20" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Projects;
