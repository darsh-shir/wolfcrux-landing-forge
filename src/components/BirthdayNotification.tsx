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

interface MonthBirthday {
  full_name: string;
  birthdate: string;
  day: number;
  passed: boolean;
}

const BirthdayNotification = () => {
  const { user } = useAuth();
  const [birthdays, setBirthdays] = useState<UpcomingBirthday[]>([]);
  const [monthBirthdays, setMonthBirthdays] = useState<MonthBirthday[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchBirthdays = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, birthdate")
        .not("birthdate", "is", null);

      if (!data) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentMonth = today.getMonth();
      const currentDay = today.getDate();

      const upcoming: UpcomingBirthday[] = [];
      const thisMonth: MonthBirthday[] = [];

      data.forEach((profile) => {
        if (!profile.birthdate) return;

        const bd = new Date(profile.birthdate);
        const bdMonth = bd.getMonth();
        const bdDay = bd.getDate();

        // Current month birthdays
        if (bdMonth === currentMonth) {
          thisMonth.push({
            full_name: profile.full_name,
            birthdate: profile.birthdate,
            day: bdDay,
            passed: bdDay < currentDay,
          });
        }

        // Upcoming within 4 days
        const thisYearBday = new Date(today.getFullYear(), bdMonth, bdDay);
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
      thisMonth.sort((a, b) => a.day - b.day);
      setBirthdays(upcoming);
      setMonthBirthdays(thisMonth);
    };

    fetchBirthdays();
  }, [user]);

  if (!user || (birthdays.length === 0 && monthBirthdays.length === 0)) return null;

  const totalCount = birthdays.length + monthBirthdays.length;

  const getDayLabel = (days: number) => {
    if (days === 0) return "Today! 🎉";
    if (days === 1) return "Tomorrow";
    return `In ${days} days`;
  };

  const currentMonthName = new Date().toLocaleDateString("en-IN", { month: "long" });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Cake className="h-4 w-4 text-primary" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
            {totalCount}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Upcoming section */}
        {birthdays.length > 0 && (
          <>
            <div className="p-3 border-b border-border">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Cake className="h-4 w-4 text-primary" />
                Upcoming Birthdays
              </h4>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {birthdays.map((b, i) => (
                <div
                  key={`upcoming-${i}`}
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
          </>
        )}

        {/* This month section */}
        {monthBirthdays.length > 0 && (
          <>
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="font-semibold text-sm text-foreground">
                🎂 {currentMonthName} Birthdays
              </h4>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {monthBirthdays.map((b, i) => (
                <div
                  key={`month-${i}`}
                  className={`flex items-center justify-between px-3 py-2 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors ${
                    b.passed ? "opacity-50" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{b.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.birthdate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    b.passed
                      ? "bg-muted text-muted-foreground line-through"
                      : "bg-accent/20 text-accent-foreground"
                  }`}>
                    {b.day === new Date().getDate() ? "Today! 🎉" : `${b.day}th`}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default BirthdayNotification;
