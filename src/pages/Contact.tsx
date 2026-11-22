import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { usePageMeta } from "@/hooks/usePageMeta";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";
import { MapPin, Mail, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useReveal } from "@/hooks/useReveal";

import AuroraBackground from "@/components/landing/AuroraBackground";

import SpotlightTiltCard from "@/components/landing/SpotlightTiltCard";
import ScrollProgress from "@/components/landing/ScrollProgress";
import PulseGlobe from "@/components/landing/PulseGlobe";

const Contact = () => {
  useReveal();
  usePageMeta({ title: "Contact Us | Wolfcrux Global Markets", description: "Get in touch with Wolfcrux Global Markets LLP, Mumbai, India. Email info@wolfcrux.com.", path: "/contact" });
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  // Messages are saved to the database and read by admins in Admin → Messages.
  // If saving fails, fall back to the visitor's email app so nothing is lost.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const get = (key: string) => String(data.get(key) ?? "").trim();

    // Hidden "website" field: real visitors never fill it in, spam bots do.
    if (get("website")) {
      form.reset();
      toast({ title: "Message sent", description: "Thank you — we'll get back to you soon." });
      return;
    }

    setSending(true);
    const { error } = await supabase.from("contact_messages").insert({
      first_name: get("firstName"),
      last_name: get("lastName"),
      email: get("email"),
      subject: get("subject"),
      message: get("message"),
    });
    setSending(false);

    if (!error) {
      form.reset();
      toast({ title: "Message sent", description: "Thank you for reaching out. We'll get back to you soon." });
      return;
    }

    if (error.message?.includes("Too many submissions")) {
      toast({
        title: "Too many messages",
        description: "Please wait a while before sending another, or email info@wolfcrux.com.",
        variant: "destructive",
      });
      return;
    }

    console.error("Contact message not saved:", error.message);
    const name = `${get("firstName")} ${get("lastName")}`.trim();
    const body = `${get("message")}\n\n—\n${name}\n${get("email")}`;
    window.location.href = `mailto:info@wolfcrux.com?subject=${encodeURIComponent(
      get("subject")
    )}&body=${encodeURIComponent(body)}`;
    toast({
      title: "Opening your email app",
      description: "We couldn't send your message directly, so it's ready in your email app instead.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <Navigation />

      {/* Hero — globe signature */}
      <section className="relative pt-24 md:pt-32 pb-12 md:pb-20 overflow-hidden">
        <AuroraBackground />
        <FloatingShapes />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] items-center gap-10">
            <div className="max-w-3xl animate-fade-in">
              <h1 className="font-['Space_Grotesk'] text-3xl sm:text-4xl md:text-6xl font-bold text-foreground mb-6">
                Get in{" "}
                <span className="text-gradient-accent">Touch</span>
              </h1>
              <p className="font-['Inter'] text-xl text-muted-foreground leading-relaxed">
                Have questions about Wolfcrux? Interested in partnering with us?
                We'd love to hear from you.
              </p>
            </div>
            <div className="hidden lg:block w-72 h-72 reveal">
              <PulseGlobe />
            </div>
          </div>
        </div>
      </section>

      {/* Contact Info */}
      <section className="py-12 md:py-20 bg-muted/30 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Building2, title: "Company", value: "Wolfcrux Global Markets LLP" },
              { icon: MapPin, title: "Location", value: "Mumbai, India" },
              {
                icon: Mail,
                title: "Email",
                value: (
                  <a href="mailto:info@wolfcrux.com" className="text-accent story-link">
                    info@wolfcrux.com
                  </a>
                ),
              },
            ].map((c, i) => (
              <div
                key={c.title}
                className="reveal"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <SpotlightTiltCard className="gradient-border h-full">
                  <Card className="border-0 bg-transparent h-full group">
                    <CardContent className="p-6 sm:p-8 text-center">
                      <div className="icon-glow w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-accent/15">
                        <c.icon className="text-accent" size={28} />
                      </div>
                      <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">
                        {c.title}
                      </h3>
                      <p className="font-['Inter'] text-muted-foreground text-sm">
                        {c.value}
                      </p>
                    </CardContent>
                  </Card>
                </SpotlightTiltCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-12 md:py-20 relative overflow-hidden">
        <AuroraBackground className="opacity-40" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-12 reveal">
            <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Send us a Message
            </h2>
            <p className="font-['Inter'] text-muted-foreground">
              Fill out the form below and we'll get back to you as soon as possible.
            </p>
          </div>

          <div className="reveal" style={{ transitionDelay: "150ms" }}>
            <SpotlightTiltCard className="gradient-border" tilt={false}>
              <Card className="border-0 bg-transparent">
                <CardContent className="p-5 sm:p-8">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Honeypot for spam bots: hidden from people and screen readers */}
                    <div className="hidden" aria-hidden="true">
                      <label htmlFor="contact-website">Website</label>
                      <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="contact-firstName" className="block font-['Inter'] text-sm font-medium text-foreground mb-2">
                          First Name
                        </label>
                        <Input
                          id="contact-firstName"
                          name="firstName"
                          maxLength={100}
                          autoComplete="given-name"
                          type="text"
                          required
                          className="font-['Inter'] transition-all focus:ring-2 focus:ring-accent/30"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-lastName" className="block font-['Inter'] text-sm font-medium text-foreground mb-2">
                          Last Name
                        </label>
                        <Input
                          id="contact-lastName"
                          name="lastName"
                          maxLength={100}
                          autoComplete="family-name"
                          type="text"
                          required
                          className="font-['Inter'] transition-all focus:ring-2 focus:ring-accent/30"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="contact-email" className="block font-['Inter'] text-sm font-medium text-foreground mb-2">
                        Email
                      </label>
                      <Input
                        id="contact-email"
                        name="email"
                        maxLength={254}
                        autoComplete="email"
                        type="email"
                        required
                        className="font-['Inter'] transition-all focus:ring-2 focus:ring-accent/30"
                        placeholder="john.doe@example.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="contact-subject" className="block font-['Inter'] text-sm font-medium text-foreground mb-2">
                        Subject
                      </label>
                      <Input
                        id="contact-subject"
                        name="subject"
                        maxLength={200}
                        type="text"
                        required
                        className="font-['Inter'] transition-all focus:ring-2 focus:ring-accent/30"
                        placeholder="How can we help you?"
                      />
                    </div>

                    <div>
                      <label htmlFor="contact-message" className="block font-['Inter'] text-sm font-medium text-foreground mb-2">
                        Message
                      </label>
                      <Textarea
                        id="contact-message"
                        name="message"
                        maxLength={5000}
                        required
                        className="min-h-[150px] font-['Inter'] transition-all focus:ring-2 focus:ring-accent/30"
                        placeholder="Your message..."
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={sending}
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-['Inter'] shadow-lg shadow-accent/20"
                    >
                      {sending ? "Sending…" : "Send Message"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </SpotlightTiltCard>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
