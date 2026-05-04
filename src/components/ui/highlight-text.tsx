import { cn } from "@/lib/utils";

interface Props {
  text: string;
  query: string;
  className?: string;
}

/** Renders text with case-insensitive matches highlighted. */
export function HighlightText({ text, query, className }: Props) {
  if (!query.trim()) return <span className={className}>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-accent/25 text-foreground rounded px-0.5">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}
