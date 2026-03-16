import { useEffect, useState } from "react";
import { Cake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface UpcomingBirthday {
  full_name: string;
  birthdate: string;
  daysUntil: number;
}

const BirthdayNotification = () => {
  const { isAdmin } = useAuth();
  const [birthdays, setBirthdays] = useState<UpcomingBirthday[]>([]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchBirthdays = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, birthdate")
        .not("birthdate", "is", null);

      if (!data) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming: UpcomingBirthday[] = [];

      data.forEach((profile) => {
        if (!profile.birthdate) return;

        const bd = new Date(profile.birthdate);
        // Set birthday to this year
        const thisYearBday = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        
        // If birthday already passed this year, check next year
        if (thisYearBday < today) {
          thisYearBday.setFullYear(today.getFullYear() + 1);
        }

        const diffTime = thisYearBday.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 4) {
          upcoming.push({
            full_name: profile.full_name,
            birthdate: profile.birthdate,
            daysUntil: diffDays,
          });
        }
      });

      upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
      setBirthdays(upcoming);
    };

    fetchBirthdays();
  }, [isAdmin]);

  if (!isAdmin || birthdays.length === 0) return null;

  const getDayLabel = (days: number) => {
    if (days === 0) return "Today! 🎉";
    if (days === 1) return "Tomorrow";
    return `In ${days} days`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Cake className="h-4 w-4 text-primary" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
            {birthdays.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-3 border-b border-border">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Cake className="h-4 w-4 text-primary" />
            Upcoming Birthdays
          </h4>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {birthdays.map((b, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{b.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(b.birthdate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                b.daysUntil === 0
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {getDayLabel(b.daysUntil)}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default BirthdayNotification;
