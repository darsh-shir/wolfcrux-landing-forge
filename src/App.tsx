import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import { RouteTransition } from "@/components/RouteTransition";
import RequireAuth from "@/components/RequireAuth";

/**
 * Like React.lazy, but if a page's code file can't be fetched (usually because a
 * new version of the site was deployed while this tab was open) reload once to
 * pick up the new version instead of showing a blank screen.
 */
const page = (load: () => Promise<{ default: React.ComponentType }>) =>
  lazy(() => {
    const key = "wolfcrux-chunk-reload";
    return load()
      .then((mod) => {
        try { sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
        return mod;
      })
      .catch((err) => {
        let alreadyReloaded = true;
        try {
          alreadyReloaded = sessionStorage.getItem(key) === "1";
          if (!alreadyReloaded) sessionStorage.setItem(key, "1");
        } catch { /* storage unavailable: don't risk a reload loop */ }
        if (alreadyReloaded) throw err;
        window.location.reload();
        return new Promise<never>(() => {});
      });
  });
// Every page except the homepage is loaded on demand, so visitors only
// download the code for the page they are viewing.
const About = page(() => import("./pages/About"));
const Technology = page(() => import("./pages/Technology"));
const Testimonials = page(() => import("./pages/Testimonials"));
const Careers = page(() => import("./pages/Careers"));
const Contact = page(() => import("./pages/Contact"));
const Dashboard = page(() => import("./pages/Dashboard"));
const Auth = page(() => import("./pages/Auth"));
const MyData = page(() => import("./pages/MyData"));
const Admin = page(() => import("./pages/Admin"));
const Practice = page(() => import("./pages/Practice"));
const NewsCheck = page(() => import("./pages/NewsCheck"));
const Followers = page(() => import("./pages/Followers"));
const NotFound = page(() => import("./pages/NotFound"));


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <a href="#main-content" className="skip-link">Skip to content</a>
          <RouteTransition>
            <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/terminal" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/about" element={<About />} />
              <Route path="/technology" element={<Technology />} />
              <Route path="/testimonials" element={<Testimonials />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/my-data" element={<MyData />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/newscheck/:ticker" element={<NewsCheck />} />
              <Route path="/newscheck" element={<NewsCheck />} />
              <Route path="/followers" element={<Followers />} />
              <Route path="/follower" element={<Followers />} />
              <Route path="/Followers" element={<Followers />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </RouteTransition>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
