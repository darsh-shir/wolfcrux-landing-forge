import { useLocation } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useEffect } from "react";

const NotFound = () => {
  usePageMeta({ title: "Page Not Found | Wolfcrux Global Markets", noindex: true });
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-accent underline hover:opacity-80">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
