import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Wraps route content with a quick CSS-driven fade so navigation feels smooth.
 * Pure CSS — no framer-motion dependency.
 */
export const RouteTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [displayed, setDisplayed] = useState(children);
  const [key, setKey] = useState(location.pathname);

  useEffect(() => {
    setKey(location.pathname);
    setDisplayed(children);
  }, [location.pathname, children]);

  return (
    <div
      key={key}
      className="route-fade"
      style={{ animation: "route-fade-in 220ms cubic-bezier(0.22,1,0.36,1)" }}
    >
      {displayed}
    </div>
  );
};
