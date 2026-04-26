import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud, X, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

type Props = {
  /** Stable identifier used as folder name; pass the product UUID when editing, or a temp id when creating. */
  ownerId: string;
  value: string[];
  onChange: (urls: string[]) => void;
};

export const ImageUploader = ({ ownerId, value, onChange }: Props) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of list) {
        if (!ACCEPTED.includes(file.type)) {
          toast.error(`${file.name}: ${t("admin.products.errors.fileType")}`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: ${t("admin.products.errors.fileSize")}`);
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const safeName = file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9-_]+/g, "-")
          .slice(0, 40);
        const path = `products/${ownerId}/${Date.now()}-${safeName}.${ext}`;

        const { error } = await supabase.storage
          .from("product-images")
          .upload(path, file, { contentType: file.type, upsert: false });

        if (error) {
          toast.error(`${file.name}: ${error.message}`);
          continue;
        }

        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      if (uploaded.length > 0) onChange([...value, ...uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeImage = async (url: string) => {
    // Remove from form
    onChange(value.filter((u) => u !== url));

    // Try to delete from storage (best-effort)
    try {
      const marker = "/storage/v1/object/public/product-images/";
      const idx = url.indexOf(marker);
      if (idx !== -1) {
        const path = url.slice(idx + marker.length);
        await supabase.storage.from("product-images").remove([path]);
      }
    } catch {
      // ignore
    }
  };

  const setAsCover = (url: string) => {
    onChange([url, ...value.filter((u) => u !== url)]);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-accent bg-accent/5"
            : "border-border hover:border-accent/60 hover:bg-muted/40"
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-secondary">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
            <span className="text-sm">{t("common.loading")}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-secondary">
            <UploadCloud className="h-6 w-6 text-accent" />
            <p className="text-sm font-medium text-foreground">
              {t("admin.products.uploader.title")}
            </p>
            <p className="text-xs">{t("admin.products.uploader.hint")}</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {value.length > 0 && (
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {value.map((url, idx) => (
            <div
              key={url}
              className="relative group aspect-square rounded-md overflow-hidden border border-border bg-muted"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              {idx === 0 && (
                <span className="absolute top-1.5 left-1.5 text-[9px] uppercase tracking-wider bg-accent text-accent-foreground px-1.5 py-0.5 rounded-sm">
                  {t("admin.products.uploader.cover")}
                </span>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center gap-2">
                {idx !== 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setAsCover(url)}
                    className="h-7 px-2 text-xs gap-1"
                  >
                    <Star className="h-3 w-3" /> {t("admin.products.uploader.makeCover")}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => removeImage(url)}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <X className="h-3 w-3" /> {t("common.delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
