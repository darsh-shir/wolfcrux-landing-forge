import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "trainee" | "partner" | "active" | "inactive";

const toneClass: Record<Tone, string> = {
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  neutral: "bg-muted text-muted-foreground border-border",
  trainee: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  partner: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  inactive: "bg-muted text-muted-foreground border-border",
};

interface Props {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

/** Semantic status pill — uses design tokens, never raw colors at the call site. */
export function StatusBadge({ tone = "neutral", children, className, dot }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
