import { useEffect } from "react";

const SITE_URL = "https://www.wolfcrux.com";

interface PageMeta {
  /** Full page title, shown in the browser tab and in Google results. */
  title: string;
  /** One or two sentences shown under the title in Google results. */
  description?: string;
  /** Path of the page, e.g. "/careers". Used for the canonical URL. */
  path?: string;
  /** Keep the page out of search engines (login, 404, …). */
  noindex?: boolean;
  /** Optional schema.org structured data for this page. */
  jsonLd?: Record<string, unknown>;
}

/** Find a <meta>/<link> tag in <head>, creating it if missing. */
const ensureTag = (selector: string, create: () => HTMLElement) => {
  let el = document.head.querySelector<HTMLElement>(selector);
  let created = false;
  if (!el) {
    el = create();
    document.head.appendChild(el);
    created = true;
  }
  return { el, created };
};

const metaTag = (attr: "name" | "property", key: string) =>
  ensureTag(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement("meta");
    m.setAttribute(attr, key);
    return m;
  });

/**
 * Sets per-page <title>, description, canonical and social tags, and restores
 * the previous values when the page unmounts so other pages keep their own.
 */
export const usePageMeta = ({ title, description, path, noindex, jsonLd }: PageMeta) => {
  const jsonLdString = jsonLd ? JSON.stringify(jsonLd) : undefined;

  useEffect(() => {
    const restore: Array<() => void> = [];

    const prevTitle = document.title;
    document.title = title;
    restore.push(() => (document.title = prevTitle));

    const setAttr = (
      { el, created }: { el: HTMLElement; created: boolean },
      attr: string,
      value: string
    ) => {
      const prev = el.getAttribute(attr);
      el.setAttribute(attr, value);
      restore.push(() => {
        if (created) el.remove();
        else if (prev === null) el.removeAttribute(attr);
        else el.setAttribute(attr, prev);
      });
    };

    const url = path !== undefined ? `${SITE_URL}${path}` : undefined;

    setAttr(metaTag("property", "og:title"), "content", title);
    setAttr(metaTag("name", "twitter:title"), "content", title);
    if (description) {
      setAttr(metaTag("name", "description"), "content", description);
      setAttr(metaTag("property", "og:description"), "content", description);
      setAttr(metaTag("name", "twitter:description"), "content", description);
    }
    if (url) {
      setAttr(metaTag("property", "og:url"), "content", url);
      setAttr(
        ensureTag('link[rel="canonical"]', () => {
          const l = document.createElement("link");
          l.setAttribute("rel", "canonical");
          return l;
        }),
        "href",
        url
      );
    }
    if (noindex) setAttr(metaTag("name", "robots"), "content", "noindex, nofollow");

    if (jsonLdString) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = jsonLdString;
      document.head.appendChild(script);
      restore.push(() => script.remove());
    }

    return () => restore.reverse().forEach((fn) => fn());
  }, [title, description, path, noindex, jsonLdString]);
};
