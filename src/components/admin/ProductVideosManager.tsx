import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const VIDEO_TYPES = ["review", "demo", "tutorial", "sample", "official"] as const;

export const parseYoutubeId = (raw: string): string | null => {
  const url = raw.trim();
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return /^[\w-]{11}$/.test(url) ? url : null;
};

const thumbOf = (v: any) =>
  v.thumbnail_url || (v.video_id ? `https://img.youtube.com/vi/${v.video_id}/hqdefault.jpg` : undefined);

export const ProductVideosManager = ({ productId }: { productId?: string | null }) => {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("review");
  const [saving, setSaving] = useState(false);

  const { data: videos = [] } = useQuery({
    queryKey: ["product-videos-admin", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_videos")
        .select("*")
        .eq("product_id", productId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["product-videos-admin", productId] });
    qc.invalidateQueries({ queryKey: ["product-videos", productId] });
  };

  const draftId = parseYoutubeId(url);

  const addVideo = async () => {
    if (!productId) return;
    if (!draftId) {
      toast.error("URL de YouTube no válida");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("product_videos").insert({
      product_id: productId,
      provider: "youtube",
      video_id: draftId,
      url: url.trim(),
      title: title.trim() || null,
      video_type: type,
      sort_order: videos.length,
      is_published: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setUrl("");
    setTitle("");
    refresh();
    toast.success("Vídeo añadido");
  };

  const update = async (id: string, patch: Partial<{ title: string | null; video_type: string; is_published: boolean; sort_order: number }>) => {
    const { error } = await supabase.from("product_videos").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este vídeo?")) return;
    const { error } = await supabase.from("product_videos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= videos.length) return;
    const a: any = videos[idx];
    const b: any = videos[target];
    await supabase.from("product_videos").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("product_videos").update({ sort_order: a.sort_order }).eq("id", b.id);
    refresh();
  };

  if (!productId) {
    return (
      <p className="text-sm text-secondary border border-dashed border-border rounded-md p-4">
        Guarda el producto primero para poder añadir vídeos.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border p-4 space-y-3">
        <div className="grid sm:grid-cols-[1fr_1fr_160px] gap-3">
          <div className="space-y-1.5">
            <Label>URL de YouTube</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Título (opcional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="RED Komodo 6K — Review" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 w-full px-3 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {VIDEO_TYPES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {draftId && (
            <img
              src={`https://img.youtube.com/vi/${draftId}/hqdefault.jpg`}
              alt=""
              className="h-16 w-28 object-cover rounded-sm border border-border"
            />
          )}
          {url && !draftId && (
            <span className="text-xs text-destructive">URL de YouTube no reconocida</span>
          )}
          <Button type="button" onClick={addVideo} disabled={saving || !draftId} className="gap-1.5 ml-auto">
            <Plus className="h-4 w-4" /> Añadir vídeo
          </Button>
        </div>
      </div>

      {videos.length === 0 ? (
        <p className="text-sm text-secondary">Este producto no tiene vídeos todavía.</p>
      ) : (
        <div className="space-y-2">
          {videos.map((v: any, idx: number) => (
            <div key={v.id} className="flex items-center gap-3 rounded-md border border-border p-3">
              <img src={thumbOf(v)} alt="" className="h-14 w-24 object-cover rounded-sm border border-border shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Input
                  defaultValue={v.title ?? ""}
                  placeholder="Título"
                  className="h-8 text-sm"
                  onBlur={(e) => {
                    const val = e.target.value.trim() || null;
                    if (val !== (v.title ?? null)) update(v.id, { title: val });
                  }}
                />
                <div className="text-[11px] font-mono text-secondary truncate">{v.url}</div>
              </div>
              <select
                value={v.video_type ?? "review"}
                onChange={(e) => update(v.id, { video_type: e.target.value })}
                className="h-8 px-2 rounded-md bg-background border border-input text-xs"
              >
                {VIDEO_TYPES.map((tOpt) => (
                  <option key={tOpt} value={tOpt}>{tOpt}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={!!v.is_published}
                  onCheckedChange={(c) => update(v.id, { is_published: c })}
                />
                <span className="text-[10px] uppercase tracking-wider text-secondary">Público</span>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => move(idx, -1)} aria-label="Subir">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => move(idx, 1)} aria-label="Bajar">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(v.id)}
                  aria-label="Eliminar"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductVideosManager;
