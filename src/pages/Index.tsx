import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";
import { useReveal } from "@/hooks/useReveal";

const Index = () => {
  useReveal();
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <FloatingShapes />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center space-y-8 animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-4xl sm:text-5xl md:text-7xl font-bold text-foreground leading-tight">
              Precision Trading at
              <br />
              <span className="text-gradient-accent">Microsecond Speed</span>
            </h1>
            
            <p className="font-['Inter'] text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Wolfcrux Global Markets leverages cutting-edge technology and quantitative 
              strategies to trade US markets with unparalleled efficiency.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/about">
                <Button size="lg" className="group bg-accent hover:bg-accent/90 text-accent-foreground font-['Inter']">
                  Discover Our Approach
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                </Button>
              </Link>
              <Link to="/careers">
                <Button size="lg" variant="outline" className="font-['Inter']">
                  Join Our Team
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 max-w-3xl mx-auto">
              {[
                { value: "2025", label: "Established" },
                { value: "HFT", label: "High Frequency Trading" },
                { value: "Mumbai", label: "India" },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className="text-center animate-scale-in"
                  style={{ animationDelay: `${0.2 + i * 0.12}s` }}
                >
                  <div className="text-4xl font-bold text-accent font-['Space_Grotesk']">
                    {s.value}
                  </div>
                  <div className="text-sm text-muted-foreground font-['Inter']">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <Card
                key={f.title}
                className="border-border hover-lift reveal group"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <CardContent className="p-8">
                  <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110 group-hover:bg-accent/15">
                    <f.icon className="text-accent" size={28} />
                  </div>
                  <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                    {f.title}
                  </h3>
                  <p className="font-['Inter'] text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
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
          <Link to="/careers">
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground font-['Inter']">
              Explore Opportunities
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
