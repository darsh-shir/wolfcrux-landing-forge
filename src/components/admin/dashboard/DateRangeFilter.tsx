import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { DateRangeFilter as DateRangeFilterType } from "./types";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  value: DateRangeFilterType;
  onChange: (value: DateRangeFilterType) => void;
  customDateRange?: { start: Date; end: Date };
  onCustomDateChange?: (range: { start: Date; end: Date }) => void;
}

const DateRangeFilterComponent = ({ 
  value, 
  onChange, 
  customDateRange,
  onCustomDateChange 
}: DateRangeFilterProps) => {
  const filters: { label: string; value: DateRangeFilterType }[] = [
    { label: "Today", value: "today" },
    { label: "Week", value: "week" },
    { label: "Month", value: "month" },
    { label: "Quarter", value: "quarter" },
    { label: "Year", value: "year" },
    { label: "Lifetime", value: "lifetime" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex bg-muted/50 rounded-lg p-1">
        {filters.map((filter) => (
          <Button
            key={filter.value}
            variant="ghost"
            size="sm"
            className={cn(
              "px-3 py-1.5 text-sm",
              value === filter.value 
                ? "bg-background shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onChange(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Custom Date Range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              value === "custom" && "border-primary",
              !customDateRange && "text-muted-foreground"
            )}
            onClick={() => onChange("custom")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {customDateRange ? (
              <>
                {format(customDateRange.start, "MMM d")} - {format(customDateRange.end, "MMM d, yyyy")}
              </>
            ) : (
              "Custom Range"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{
              from: customDateRange?.start,
              to: customDateRange?.end,
            }}
            onSelect={(range) => {
              if (range?.from && range?.to && onCustomDateChange) {
                onCustomDateChange({ start: range.from, end: range.to });
                onChange("custom");
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DateRangeFilterComponent;
