import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import About from "./pages/About";
import Technology from "./pages/Technology";
import Testimonials from "./pages/Testimonials";
import Careers from "./pages/Careers";
import Contact from "./pages/Contact";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import MyData from "./pages/MyData";
import Admin from "./pages/Admin";
import Practice from "./pages/Practice";
import NotFound from "./pages/NotFound";
import { RouteTransition } from "@/components/RouteTransition";

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
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/terminal" element={<Dashboard />} />
              <Route path="/about" element={<About />} />
              <Route path="/technology" element={<Technology />} />
              <Route path="/testimonials" element={<Testimonials />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/my-data" element={<MyData />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/practice" element={<Practice />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </RouteTransition>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
