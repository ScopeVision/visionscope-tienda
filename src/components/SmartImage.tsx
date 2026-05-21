import { CSSProperties, ImgHTMLAttributes } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { getRenderProps, useImageSetting, type ImageSetting } from "@/hooks/useImageSettings";
import { cn } from "@/lib/utils";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "className" | "style"> & {
  src?: string | null;
  alt: string;
  /** Class applied to the wrapper. Hover effects (group-hover:scale-…), opacity transitions and positioning go here. */
  className?: string;
  /** Inline style applied to the wrapper. */
  style?: CSSProperties;
  /** Optional class applied to the inner <img>. Avoid object-* utilities — cover is enforced. */
  imgClassName?: string;
  /** Optional override of the resolved image setting (used by admin preview). */
  settingOverride?: ImageSetting | null;
  /** Mark this image as high-priority (LCP/hero). Disables lazy loading. */
  priority?: boolean;
};

/**
 * Single source of truth for image rendering across the site.
 *
 * Performance defaults:
 * - loading="lazy" and decoding="async" by default — only above-the-fold
 *   hero images should opt in via `priority` (or pass loading="eager").
 * - fetchpriority is hinted accordingly so the browser preloads the LCP.
 */
export const SmartImage = ({
  src,
  alt,
  className,
  style,
  imgClassName,
  settingOverride,
  priority = false,
  loading,
  ...imgRest
}: Props) => {
  const isMobile = useIsMobile();
  const fetched = useImageSetting(src ?? undefined);
  const setting = settingOverride !== undefined ? settingOverride ?? undefined : fetched;
  const { objectPosition, transform } = getRenderProps(setting, isMobile);

  const resolvedLoading = loading ?? (priority ? "eager" : "lazy");
  const fetchPriority = priority ? "high" : "low";

  return (
    <div
      className={cn("relative w-full h-full overflow-hidden", className)}
      style={style}
    >
      <img
        src={src ?? undefined}
        alt={alt}
        draggable={false}
        loading={resolvedLoading}
        decoding="async"
        // @ts-expect-error fetchpriority is a valid HTML attribute, types lag.
        fetchpriority={fetchPriority}
        className={cn(
          "absolute inset-0 w-full h-full select-none",
          imgClassName,
        )}
        style={{
          objectFit: "cover",
          objectPosition,
          transform,
          transformOrigin: objectPosition,
        }}
        {...imgRest}
      />
    </div>
  );
};
