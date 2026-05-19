import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listMonths, monthKey, parseMonthKey } from "@/lib/monthRange";
import { useMemo } from "react";

type Props = {
  value: string; // "YYYY-M"
  onChange: (key: string) => void;
};

export default function MonthNavigator({ value, onChange }: Props) {
  const months = useMemo(() => listMonths(2, 1), []);
  const { year, month } = parseMonthKey(value);

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    onChange(monthKey(d.getFullYear(), d.getMonth()));
  };

  return (
    <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-lg p-1.5">
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => shift(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 px-1">
        <Calendar className="h-4 w-4 text-secondary" />
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 min-w-[180px] border-0 shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            {months.map((m) => (
              <SelectItem key={monthKey(m.year, m.month)} value={monthKey(m.year, m.month)}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => shift(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
