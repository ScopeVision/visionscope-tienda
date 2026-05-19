import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ImageSetting = {
  url: string;
  focal_x: number;
  focal_y: number;
  zoom: number;
  focal_x_mobile: number | null;
  focal_y_mobile: number | null;
  zoom_mobile: number | null;
};

const KEY = ["image-settings"] as const;

export function useImageSettingsMap() {
  return useQuery({
    queryKey: KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("image_settings")
        .select("*");
      if (error) throw error;
      const map = new Map<string, ImageSetting>();
      (data ?? []).forEach((r: ImageSetting) => map.set(r.url, r));
      return map;
    },
  });
}

export function useImageSetting(url?: string | null) {
  const { data } = useImageSettingsMap();
  if (!url || !data) return undefined;
  return data.get(url);
}

export function useInvalidateImageSettings() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function getRenderProps(
  s: ImageSetting | undefined,
  isMobile: boolean,
): { objectPosition: string; transform: string } {
  if (!s) return { objectPosition: "50% 50%", transform: "none" };
  const x = isMobile && s.focal_x_mobile != null ? s.focal_x_mobile : s.focal_x;
  const y = isMobile && s.focal_y_mobile != null ? s.focal_y_mobile : s.focal_y;
  const z = isMobile && s.zoom_mobile != null ? s.zoom_mobile : s.zoom;
  return {
    objectPosition: `${x}% ${y}%`,
    transform: z && z !== 1 ? `scale(${z})` : "none",
  };
}
