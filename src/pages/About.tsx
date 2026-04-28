import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";
import { Building2, Users, Target, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import teamPhoto from "@/assets/team-photo.jpeg";
import { useReveal } from "@/hooks/useReveal";

import AuroraBackground from "@/components/landing/AuroraBackground";

import SpotlightTiltCard from "@/components/landing/SpotlightTiltCard";
import ScrollProgress from "@/components/landing/ScrollProgress";
import AnimatedCounter from "@/components/landing/AnimatedCounter";

const About = () => {
  useReveal();
  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-24 md:pt-32 pb-12 md:pb-20 overflow-hidden">
        <AuroraBackground />
        <FloatingShapes />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-3xl sm:text-4xl md:text-6xl font-bold text-foreground mb-6">
              About{" "}
              <span className="text-gradient-accent">Wolfcrux</span>
            </h1>
            <p className="font-['Inter'] text-xl text-muted-foreground leading-relaxed">
              Wolfcrux Global Markets LLP is a premier high-frequency trading firm
              specializing in US equity markets. Founded in February 2025 and based
              in Mumbai, India, we combine cutting-edge technology with quantitative
              expertise to deliver consistent performance.
            </p>
          </div>
        </div>
      </section>

      {/* Company Info Grid */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Building2, title: "Established", value: "February 2025" },
              { icon: Globe, title: "Location", value: "Mumbai, India" },
              { icon: Target, title: "Focus", value: "US Markets HFT" },
              { icon: Users, title: "Structure", value: "LLP Partnership" },
            ].map((item, i) => (
              <div
                key={item.title}
                className="reveal"
                style={{ transitionDelay: `${i * 90}ms` }}
              >
                <SpotlightTiltCard className="gradient-border h-full">
                  <Card className="border-0 bg-transparent h-full group">
                    <CardContent className="p-6">
                      <div className="icon-glow w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-accent/15">
                        <item.icon className="text-accent" size={24} />
                      </div>
                      <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">
                        {item.title}
                      </h3>
                      <p className="font-['Inter'] text-muted-foreground">
                        {item.value}
                      </p>
                    </CardContent>
                  </Card>
                </SpotlightTiltCard>
              </div>
            ))}
          </div>

          {/* Animated year strip — unique signature for About */}
          <div className="mt-12 text-center reveal">
            <div className="inline-flex items-baseline gap-3">
              <span className="text-sm uppercase tracking-widest text-muted-foreground">
                Building since
              </span>
              <span className="text-4xl md:text-5xl font-bold text-gradient-accent font-['Space_Grotesk']">
                <AnimatedCounter end={2025} duration={1600} />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="reveal">
              <h2 className="font-['Space_Grotesk'] text-3xl font-bold text-foreground mb-6">
                Our Mission
              </h2>
              <p className="font-['Inter'] text-muted-foreground leading-relaxed mb-4">
                To leverage cutting-edge technology and quantitative research to provide
                liquidity and efficiency to global financial markets while generating
                superior risk-adjusted returns.
              </p>
              <p className="font-['Inter'] text-muted-foreground leading-relaxed">
                We believe in the power of data-driven decision making, continuous innovation,
                and the pursuit of excellence in everything we do.
              </p>
            </div>

            <div className="reveal" style={{ transitionDelay: "150ms" }}>
              <h2 className="font-['Space_Grotesk'] text-3xl font-bold text-foreground mb-6">
                Our Approach
              </h2>
              <p className="font-['Inter'] text-muted-foreground leading-relaxed mb-4">
                We employ sophisticated algorithms and low-latency infrastructure to execute
                trades at microsecond speeds. Our proprietary systems analyze vast amounts
                of market data to identify and capitalize on fleeting opportunities.
              </p>
              <p className="font-['Inter'] text-muted-foreground leading-relaxed">
                Risk management is at the core of our operations, with real-time monitoring
                and automated controls ensuring we operate within carefully defined parameters.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-12 md:py-20 bg-muted/30 relative overflow-hidden">
        <AuroraBackground className="opacity-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-bold text-foreground text-center mb-12 reveal">
            Our Values
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Innovation", desc: "Constantly pushing boundaries with novel approaches to trading and technology" },
              { title: "Precision", desc: "Excellence in execution and attention to every detail of our operations" },
              { title: "Integrity", desc: "Operating with the highest ethical standards and transparency" },
            ].map((v, i) => (
              <div
                key={v.title}
                className="reveal"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <SpotlightTiltCard className="gradient-border h-full">
                  <Card className="border-0 bg-transparent h-full">
                    <CardContent className="p-8 text-center">
                      <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                        {v.title}
                      </h3>
                      <p className="font-['Inter'] text-muted-foreground">{v.desc}</p>
                    </CardContent>
                  </Card>
                </SpotlightTiltCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Photo Section */}
      <section className="py-12 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-bold text-foreground text-center mb-12 reveal">
            Our Team
          </h2>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border shadow-lg bg-muted/20 reveal group">
            <img
              src={teamPhoto}
              alt="Wolfcrux Team"
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
