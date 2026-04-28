import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";
import { useReveal } from "@/hooks/useReveal";

import AnimatedCounter from "@/components/landing/AnimatedCounter";
import TypewriterText from "@/components/landing/TypewriterText";
import AuroraBackground from "@/components/landing/AuroraBackground";
import MagneticButton from "@/components/landing/MagneticButton";
import SpotlightTiltCard from "@/components/landing/SpotlightTiltCard";
import ScrollProgress from "@/components/landing/ScrollProgress";
import WaveDivider from "@/components/landing/WaveDivider";
import TestimonialsCarousel from "@/components/landing/TestimonialsCarousel";
import TextScramble from "@/components/landing/TextScramble";

import purviPhoto from "@/assets/purvi_photo.jpg";
import labdhiPhoto from "@/assets/labdhi_photo.jpg";
import darshitPhoto from "@/assets/darshit_photo.jpeg";
import jinalPhoto from "@/assets/jinal-photo.jpeg";

const Index = () => {
  useReveal();

  const testimonials = [
    {
      quote:
        "What sets Wolfcrux apart is how the seniors break down complex ideas into simple, actionable steps. I’ve never felt this confident placing trades backed by real logic and risk control.",
      author: "Purvi",
      position: "Equity Trader",
      image: purviPhoto,
    },
    {
      quote:
        "The trust here is real — from day one I felt like I was part of something bigger. Knowing the team has your back during tough market days makes all the difference.",
      author: "Labdhi",
      position: "Equity Trader",
      image: labdhiPhoto,
    },
    {
      quote:
        "Wolfcrux’s technology and data-driven approach completely changed the way I analyze price action. Tools here are built for traders who want speed, precision, and real edge.",
      author: "Darshit",
      position: "Equity Analyst",
      image: darshitPhoto,
    },
    {
      quote:
        "Working here has shown me what professional trading truly feels like — clear communication, teamwork, and consistent results.",
      author: "Jinal",
      position: "Equity Trader",
      image: jinalPhoto,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <AuroraBackground />
        <FloatingShapes />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center space-y-8 animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-4xl sm:text-5xl md:text-7xl font-bold text-foreground leading-tight">
              <TextScramble text="Precision Trading at" />
              <br />
              <span className="text-gradient-accent">Microsecond Speed</span>
            </h1>

            <p className="font-['Inter'] text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Wolfcrux Global Markets trades{" "}
              <TypewriterText
                words={["US equities", "futures", "options", "volatility"]}
                className="text-accent font-semibold"
              />{" "}
              with unparalleled efficiency.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <MagneticButton>
                <Link to="/about">
                  <Button
                    size="lg"
                    className="group bg-accent hover:bg-accent/90 text-accent-foreground font-['Inter'] shadow-lg shadow-accent/20"
                  >
                    Discover Our Approach
                    <ArrowRight
                      className="ml-2 group-hover:translate-x-1 transition-transform"
                      size={20}
                    />
                  </Button>
                </Link>
              </MagneticButton>
              <MagneticButton>
                <Link to="/careers">
                  <Button size="lg" variant="outline" className="font-['Inter']">
                    Join Our Team
                  </Button>
                </Link>
              </MagneticButton>
            </div>

            {/* Animated stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 max-w-4xl mx-auto">
              {[
                { end: 10, suffix: "M+", label: "Trades / day" },
                { end: 99.9, suffix: "%", decimals: 1, label: "Uptime" },
                { end: 5, prefix: "<", suffix: "μs", label: "Latency" },
                { end: 2025, label: "Established" },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className="text-center animate-scale-in"
                  style={{ animationDelay: `${0.2 + i * 0.1}s` }}
                >
                  <div className="text-3xl md:text-4xl font-bold text-gradient-accent font-['Space_Grotesk']">
                    <AnimatedCounter
                      end={s.end}
                      prefix={s.prefix}
                      suffix={s.suffix}
                      decimals={s.decimals}
                    />
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground font-['Inter'] mt-1">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <WaveDivider />

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-muted/30 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16 reveal">
            <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-5xl font-bold text-foreground mb-4">
              Our Advantage
            </h2>
            <p className="font-['Inter'] text-lg text-muted-foreground max-w-2xl mx-auto">
              Combining technology, data science, and market expertise to deliver consistent results
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: "Lightning Fast",
                desc: "Microsecond-level execution powered by proprietary infrastructure and co-location strategies in major US data centers.",
              },
              {
                icon: TrendingUp,
                title: "Data-Driven",
                desc: "Advanced quantitative models analyzing terabytes of market data to identify profitable opportunities in real-time.",
              },
              {
                icon: Shield,
                title: "Risk Managed",
                desc: "Sophisticated risk management systems ensuring controlled exposure and sustainable performance across market conditions.",
              },
            ].map((f, i) => (
              <div
                key={f.title}
                className="reveal"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <SpotlightTiltCard className="gradient-border h-full">
                  <Card className="border-0 bg-transparent group h-full">
                    <CardContent className="p-8">
                      <div className="icon-glow w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-accent/15">
                        <f.icon className="text-accent" size={28} />
                      </div>
                      <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                        {f.title}
                      </h3>
                      <p className="font-['Inter'] text-muted-foreground">
                        {f.desc}
                      </p>
                    </CardContent>
                  </Card>
                </SpotlightTiltCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider flip />

      {/* Testimonials carousel */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        <AuroraBackground className="opacity-60" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-10 reveal">
            <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-5xl font-bold text-foreground mb-4">
              What Our Traders Say
            </h2>
            <p className="font-['Inter'] text-lg text-muted-foreground max-w-2xl mx-auto">
              Real voices from the desk.
            </p>
          </div>
          <div className="reveal">
            <TestimonialsCarousel items={testimonials} />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-primary/5" />
        <FloatingShapes />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6">
            Interested in Working with Us?
          </h2>
          <p className="font-['Inter'] text-lg text-muted-foreground mb-8">
            We're always looking for exceptional talent to join our team of traders,
            engineers, and researchers.
          </p>
          <MagneticButton>
            <Link to="/careers">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-['Inter'] shadow-lg shadow-accent/20"
              >
                Explore Opportunities
                <ArrowRight className="ml-2" size={20} />
              </Button>
            </Link>
          </MagneticButton>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
