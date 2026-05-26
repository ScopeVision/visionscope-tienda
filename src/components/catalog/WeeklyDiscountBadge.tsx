import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { calcWeeklyBreakdown, formatCurrency, type PricingModel } from "@/lib/rental";
import { cn } from "@/lib/utils";

type Props = {
  priceDay: number;
  priceWeek?: number | null;
  pricingModel?: PricingModel | null;
  customMultipliers?: number[] | null;
  variant?: "pill" | "block" | "inline";
  className?: string;
};

/**
 * Communicates the progressive daily discount applied to weekly rentals.
 */
export const WeeklyDiscountBadge = ({
  priceDay,
  priceWeek,
  pricingModel,
  customMultipliers,
  variant = "pill",
  className,
}: Props) => {
  const { t, i18n } = useTranslation();
  const { weekly, listPrice, savings, savingsPct } = calcWeeklyBreakdown(priceDay, {
    model: pricingModel ?? "premium",
    customMultipliers: customMultipliers ?? null,
    priceWeek: priceWeek ?? null,
  });
  if (!priceDay || savings <= 0) return null;

  if (variant === "pill") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-accent border border-accent/30 bg-accent-soft/60 px-2 py-0.5 rounded-sm",
          className
        )}
        title={t("pricing.tooltip", {
          list: formatCurrency(listPrice, i18n.language),
          weekly: formatCurrency(weekly, i18n.language),
          savings: formatCurrency(savings, i18n.language),
        })}
      >
        <Sparkles className="h-3 w-3" />
        {t("pricing.progressiveDiscount")}
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <div className={cn("text-xs text-secondary flex items-center gap-1.5", className)}>
        <Sparkles className="h-3 w-3 text-accent" />
        <span>
          {t("pricing.weeklyFrom")}{" "}
          <span className="font-medium text-foreground">
            {formatCurrency(weekly, i18n.language)}
          </span>{" "}
          —{" "}
          <span className="text-accent">
            {t("pricing.saveAmount", {
              amount: formatCurrency(savings, i18n.language),
              pct: Math.round(savingsPct * 100),
            })}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-3 rounded-md border border-accent/40 bg-accent-soft/60 space-y-1.5",
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-accent uppercase tracking-[0.18em]">
        <Sparkles className="h-3.5 w-3.5" />
        {t("pricing.progressiveDiscount")}
      </div>
      <div className="flex justify-between text-xs text-secondary">
        <span>{t("pricing.listPrice")}</span>
        <span className="line-through">{formatCurrency(listPrice, i18n.language)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-secondary">{t("pricing.weeklyReal")}</span>
        <span className="font-medium text-foreground">
          {formatCurrency(weekly, i18n.language)}
        </span>
      </div>
      <div className="flex justify-between text-xs pt-1 border-t border-accent/20">
        <span className="text-accent font-medium">{t("pricing.savings")}</span>
        <span className="text-accent font-medium">
          −{formatCurrency(savings, i18n.language)} ({Math.round(savingsPct * 100)}%)
        </span>
      </div>
    </div>
  );
};
