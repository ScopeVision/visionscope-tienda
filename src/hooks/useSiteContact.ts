import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SiteContact = {
  whatsapp_url: string;
  instagram_url: string;
  contact_email: string;
};

const FALLBACK: SiteContact = {
  whatsapp_url: "https://wa.me/qr/3BHCCMSKBRQZP1",
  instagram_url: "https://www.instagram.com/thevisionscope/",
  contact_email: "thevisionscope.ventas@gmail.com",
};

export const useSiteContact = () => {
  return useQuery({
    queryKey: ["site-contact"],
    queryFn: async (): Promise<SiteContact> => {
      const { data, error } = await supabase.rpc("get_public_contact" as any);
      if (error || !data || (Array.isArray(data) && data.length === 0)) return FALLBACK;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        whatsapp_url: row.whatsapp_url || FALLBACK.whatsapp_url,
        instagram_url: row.instagram_url || FALLBACK.instagram_url,
        contact_email: row.contact_email || FALLBACK.contact_email,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
};
