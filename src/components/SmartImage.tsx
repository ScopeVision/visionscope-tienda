import { ImgHTMLAttributes, CSSProperties } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { getRenderProps, useImageSetting } from "@/hooks/useImageSettings";
import { cn } from "@/lib/utils";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  alt: string;
  /** When true, wrap in overflow-hidden container so zoom (scale) is clipped. */
  wrap?: boolean;
  /** Optional className for the wrapper (only used when wrap=true). */
  wrapClassName?: string;
};

/**
 * Image component that applies admin-defined focal point and zoom from `image_settings`.
 * Falls back to centered cover when no setting exists.
 */
export const SmartImage = ({
  src,
  alt,
  className,
  style,
  wrap = false,
  wrapClassName,
  ...rest
}: Props) => {
  const isMobile = useIsMobile();
  const setting = useImageSetting(src ?? undefined);
  const { objectPosition, transform } = getRenderProps(setting, isMobile);

  const imgStyle: CSSProperties = {
    objectPosition,
    transform,
    transformOrigin: `${objectPosition}`,
    ...style,
  };

  const img = (
    <img
      src={src ?? undefined}
      alt={alt}
      className={cn("w-full h-full object-cover", className)}
      style={imgStyle}
      {...rest}
    />
  );

  if (wrap) {
    return (
      <div className={cn("relative w-full h-full overflow-hidden", wrapClassName)}>
        {img}
      </div>
    );
  }
  return img;
};
