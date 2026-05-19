import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, UploadCloud, X, Crop } from "lucide-react";
import { toast } from "sonner";
import { ImageFramingEditor } from "@/components/admin/ImageFramingEditor";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;

type Props = {
  folder: string; // e.g. "hero", "projects", "categories"
  value: string; // single URL
  onChange: (url: string) => void;
  recommendation?: string;
};

export const SiteImageUploader = ({ folder, value, onChange, recommendation }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Formato no soportado (jpg, png, webp, avif)");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Imagen demasiado grande (máx 8 MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("site-content")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        toast.error(error.message);
        return;
      }
      const { data } = supabase.storage.from("site-content").getPublicUrl(path);
      onChange(data.publicUrl);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {recommendation && (
        <p className="text-[11px] text-secondary">📐 {recommendation}</p>
      )}
      {value ? (
        <div className="relative w-full aspect-video rounded-md overflow-hidden border border-border bg-muted group">
          <img src={value} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 grid place-items-center w-7 h-7 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground transition-colors"
            aria-label="Quitar imagen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full aspect-video border-2 border-dashed border-border rounded-md grid place-items-center hover:border-accent/60 hover:bg-muted/40 transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-secondary">
              <UploadCloud className="h-6 w-6 text-accent" />
              <span className="text-xs">Subir imagen</span>
            </div>
          )}
        </button>
      )}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="o pega URL de imagen…"
        className="text-xs"
      />
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {uploading && <p className="text-xs text-secondary">Subiendo…</p>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="gap-2"
      >
        <UploadCloud className="h-3.5 w-3.5" /> {value ? "Cambiar" : "Subir"}
      </Button>
    </div>
  );
};
