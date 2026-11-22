import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { isExEmployee } from "@/lib/employees";

interface Person {
  user_id: string;
  full_name: string;
  trader_number?: string | null;
  employee_role?: string | null;
}

/**
 * Searchable employee picker: type part of a name or ID to find someone.
 * Current employees are listed by ID; ex-employees come last, marked "(ex)".
 */
const EmployeePicker = ({
  users,
  value,
  onValueChange,
  placeholder = "Select employee",
  allLabel,
  disabledUserId,
  className,
}: {
  users: Person[];
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  /** Adds an "everyone" option with this label (value "all"). */
  allLabel?: string;
  disabledUserId?: string;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = users.find((u) => u.user_id === value);
  const num = (u: Person) => parseInt((u.trader_number || "").replace(/\D/g, "")) || 999999;
  const sorted = [...users].sort(
    (a, b) =>
      Number(isExEmployee(a)) - Number(isExEmployee(b)) || num(a) - num(b) || a.full_name.localeCompare(b.full_name)
  );
  const pick = (id: string) => {
    onValueChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn("w-full justify-between font-normal", className)}>
          <span className="truncate">
            {value === "all" && allLabel ? allLabel : selected ? `${selected.full_name}${isExEmployee(selected) ? " (ex)" : ""}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type a name or ID…" />
          <CommandList>
            <CommandEmpty>No one found.</CommandEmpty>
            <CommandGroup>
              {allLabel && (
                <CommandItem value={`__all ${allLabel}`} onSelect={() => pick("all")}>
                  <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                  {allLabel}
                </CommandItem>
              )}
              {sorted.map((u) => (
                <CommandItem
                  key={u.user_id}
                  value={`${u.full_name} ${u.trader_number || ""} ${u.user_id}`}
                  disabled={u.user_id === disabledUserId}
                  onSelect={() => pick(u.user_id)}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === u.user_id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">
                    {u.full_name}
                    {isExEmployee(u) && <span className="text-muted-foreground"> (ex)</span>}
                  </span>
                  {u.trader_number && <span className="ml-2 font-mono text-xs text-muted-foreground">{u.trader_number}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default EmployeePicker;
