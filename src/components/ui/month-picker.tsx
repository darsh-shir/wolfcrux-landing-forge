import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  year: number;
  month: number; // 1-12
  onChange: (year: number, month: number) => void;
  minYear?: number;
  maxYear?: number;
  className?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Shared month/year picker used across PayoutSheet, MonthlyPnL, etc. */
export function MonthPicker({ year, month, onChange, minYear = 2023, maxYear, className }: Props) {
  const max = maxYear ?? new Date().getFullYear() + 1;
  const years = Array.from({ length: max - minYear + 1 }, (_, i) => minYear + i);

  const step = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    onChange(y, m);
  };

  return (
    <div className={`inline-flex items-center gap-1 rounded-md border border-border bg-background p-1 ${className ?? ""}`}>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => step(-1)} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground ml-1" />

      <Select value={String(month)} onValueChange={(v) => onChange(year, Number(v))}>
        <SelectTrigger className="h-7 w-[120px] border-0 bg-transparent shadow-none focus:ring-0">
          <SelectValue>{MONTHS[month - 1]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => (
            <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(v) => onChange(Number(v), month)}>
        <SelectTrigger className="h-7 w-[80px] border-0 bg-transparent shadow-none focus:ring-0">
          <SelectValue>{year}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => step(1)} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
