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
};

/**
 * Single source of truth for image rendering across the site.
 *
 * - Always wraps the image so its zoom (scale) is clipped consistently.
 * - Forces object-fit: cover via inline style so it cannot be overridden by
 *   utility merges. The admin-defined focal point and zoom always win.
 * - Hover effects (group-hover:scale-105, opacity transitions, etc.) belong
 *   on the wrapper via `className`; they compose cleanly with the saved zoom
 *   because the saved zoom lives on the inner <img>.
 */
export const SmartImage = ({
  src,
  alt,
  className,
  style,
  imgClassName,
  settingOverride,
  ...imgRest
}: Props) => {
  const isMobile = useIsMobile();
  const fetched = useImageSetting(src ?? undefined);
  const setting = settingOverride !== undefined ? settingOverride ?? undefined : fetched;
  const { objectPosition, transform } = getRenderProps(setting, isMobile);

  return (
    <div
      className={cn("relative w-full h-full overflow-hidden", className)}
      style={style}
    >
      <img
        src={src ?? undefined}
        alt={alt}
        draggable={false}
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
