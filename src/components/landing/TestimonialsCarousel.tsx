import { useEffect, useState } from "react";
import { Quote } from "lucide-react";

interface Item {
  quote: string;
  author: string;
  position: string;
  image: string;
}

interface Props {
  items: Item[];
  intervalMs?: number;
}

const TestimonialsCarousel = ({ items, intervalMs = 6000 }: Props) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = window.setInterval(
      () => setIdx((i) => (i + 1) % items.length),
      intervalMs
    );
    return () => clearInterval(t);
  }, [items.length, intervalMs]);

  const current = items[idx];

  return (
    <div className="relative max-w-3xl mx-auto">
      <div
        key={idx}
        className="rounded-2xl border border-border bg-card/70 backdrop-blur-sm p-8 md:p-10 shadow-sm animate-fade-in"
      >
        <Quote className="text-accent mb-4" size={28} />
        <p className="font-['Inter'] text-base md:text-lg text-foreground/90 leading-relaxed">
          “{current.quote}”
        </p>
        <div className="flex items-center gap-3 mt-6">
          <img
            src={current.image}
            alt={current.author}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-accent/30"
          />
          <div>
            <div className="font-semibold text-foreground">{current.author}</div>
            <div className="text-xs text-muted-foreground">{current.position}</div>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 mt-5">
        {items.map((_, i) => (
          <button
            key={i}
            aria-label={`Show testimonial ${i + 1}`}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === idx ? "w-8 bg-accent" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default TestimonialsCarousel;
