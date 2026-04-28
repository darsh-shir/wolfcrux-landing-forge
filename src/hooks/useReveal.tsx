import { useEffect, useRef } from "react";

/**
 * Adds an `is-visible` class to elements with the `.reveal` class
 * when they enter the viewport. Pair with the `.reveal` utility in index.css.
 *
 * Usage:
 *   useReveal();
 *   <div className="reveal">...</div>
 *   <div className="reveal" style={{ transitionDelay: "120ms" }}>...</div>
 */
export const useReveal = (rootSelector?: string) => {
  const observed = useRef<WeakSet<Element>>(new WeakSet());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootSelector
      ? document.querySelector(rootSelector) ?? document
      : document;

    const elements = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));

    if (reduce) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    elements.forEach((el) => {
      if (!observed.current.has(el)) {
        observer.observe(el);
        observed.current.add(el);
      }
    });

    return () => observer.disconnect();
  }, [rootSelector]);
};

export default useReveal;
