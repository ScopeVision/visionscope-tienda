import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useInvalidateImageSettings, type ImageSetting } from "@/hooks/useImageSettings";
import { SmartImage } from "@/components/SmartImage";
import { Loader2, RotateCcw } from "lucide-react";

type Props = {
  url: string | null;
  open: boolean;
  onClose: () => void;
};

type Frame = { x: number; y: number; zoom: number };

const DEFAULT: Frame = { x: 50, y: 50, zoom: 1 };

export const ImageFramingEditor = ({ url, open, onClose }: Props) => {
  const { t } = useTranslation();
  const invalidate = useInvalidateImageSettings();
  const [desktop, setDesktop] = useState<Frame>(DEFAULT);
  const [mobile, setMobile] = useState<Frame>(DEFAULT);
  const [sameAsDesktop, setSameAsDesktop] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !url) return;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("image_settings")
        .select("*")
        .eq("url", url)
        .maybeSingle();
      const s = data as ImageSetting | null;
      if (s) {
        setDesktop({ x: Number(s.focal_x), y: Number(s.focal_y), zoom: Number(s.zoom) });
        const hasMobile = s.focal_x_mobile != null;
        setSameAsDesktop(!hasMobile);
        setMobile(
          hasMobile
            ? {
                x: Number(s.focal_x_mobile),
                y: Number(s.focal_y_mobile),
                zoom: Number(s.zoom_mobile ?? 1),
              }
            : { x: Number(s.focal_x), y: Number(s.focal_y), zoom: Number(s.zoom) },
        );
      } else {
        setDesktop(DEFAULT);
        setMobile(DEFAULT);
        setSameAsDesktop(true);
      }
      setLoading(false);
    })();
  }, [open, url]);

  const save = async () => {
    if (!url) return;
    setSaving(true);
    const payload = {
      url,
      focal_x: desktop.x,
      focal_y: desktop.y,
      zoom: desktop.zoom,
      focal_x_mobile: sameAsDesktop ? null : mobile.x,
      focal_y_mobile: sameAsDesktop ? null : mobile.y,
      zoom_mobile: sameAsDesktop ? null : mobile.zoom,
    };
    const { error } = await (supabase as any)
      .from("image_settings")
      .upsert(payload, { onConflict: "url" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("admin.imageFraming.saved", { defaultValue: "Framing saved" }));
    invalidate();
    onClose();
  };

  const reset = () => {
    setDesktop(DEFAULT);
    setMobile(DEFAULT);
    setSameAsDesktop(true);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-tight">
            {t("admin.imageFraming.title", { defaultValue: "Adjust framing" })}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-16 grid place-items-center text-secondary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-secondary leading-relaxed">
              {t("admin.imageFraming.help", {
                defaultValue:
                  "Drag the image to reposition. Use zoom to crop closer. The visible area shows exactly what will render on the site.",
              })}
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <FramePanel
                label={t("admin.imageFraming.card", { defaultValue: "Card (1:1)" })}
                aspect="1 / 1"
                url={url}
                frame={desktop}
                onChange={setDesktop}
              />
              <FramePanel
                label={t("admin.imageFraming.wide", { defaultValue: "Wide (16:9)" })}
                aspect="16 / 9"
                url={url}
                frame={desktop}
                onChange={setDesktop}
              />
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs uppercase tracking-[0.18em]">
                    {t("admin.imageFraming.mobile", { defaultValue: "Mobile (4:5)" })}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-secondary">
                      {t("admin.imageFraming.sameAsDesktop", { defaultValue: "= desktop" })}
                    </span>
                    <Switch checked={sameAsDesktop} onCheckedChange={setSameAsDesktop} />
                  </div>
                </div>
                <FramePanel
                  label=""
                  aspect="4 / 5"
                  url={url}
                  frame={sameAsDesktop ? desktop : mobile}
                  onChange={sameAsDesktop ? () => {} : setMobile}
                  disabled={sameAsDesktop}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button type="button" variant="ghost" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {t("common.reset", { defaultValue: "Reset" })}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function FramePanel({
  label,
  aspect,
  url,
  frame,
  onChange,
  disabled = false,
}: {
  label: string;
  aspect: string;
  url: string | null;
  frame: Frame;
  onChange: (f: Frame) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, fx: frame.x, fy: frame.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    // Dragging right shifts focal LEFT (image moves with cursor)
    // Sensitivity scales with zoom: more zoom = finer control
    const sens = Math.max(1, frame.zoom);
    const nx = Math.max(0, Math.min(100, drag.current.fx - (dx / rect.width) * 100 / sens));
    const ny = Math.max(0, Math.min(100, drag.current.fy - (dy / rect.height) * 100 / sens));
    onChange({ ...frame, x: nx, y: ny });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-xs uppercase tracking-[0.18em]">{label}</Label>
      )}
      <div
        ref={ref}
        className={`relative w-full overflow-hidden rounded-md border border-border bg-muted ${
          disabled ? "opacity-50 pointer-events-none" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{ aspectRatio: aspect, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {url && (
          <img
            src={url}
            alt=""
            draggable={false}
            className="w-full h-full object-cover select-none pointer-events-none"
            style={{
              objectPosition: `${frame.x}% ${frame.y}%`,
              transform: frame.zoom !== 1 ? `scale(${frame.zoom})` : "none",
              transformOrigin: `${frame.x}% ${frame.y}%`,
            }}
          />
        )}
        {/* Rule-of-thirds grid */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/20" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/20" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/20" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/20" />
        </div>
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow-lg bg-accent pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: `50%`, top: `50%` }}
        />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <span className="text-[10px] uppercase tracking-[0.18em] text-secondary w-12">Zoom</span>
        <Slider
          value={[frame.zoom]}
          min={1}
          max={4}
          step={0.05}
          disabled={disabled}
          onValueChange={(v) => onChange({ ...frame, zoom: v[0] })}
        />
        <span className="text-xs tabular-nums w-12 text-right">{frame.zoom.toFixed(2)}×</span>
      </div>
    </div>
  );
}
