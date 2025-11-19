import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";
import { Building2, Users, Target, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <FloatingShapes />
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-5xl md:text-6xl font-bold text-foreground mb-6">
              About Wolfcrux
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
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-border animate-fade-in">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Building2 className="text-accent" size={24} />
                </div>
                <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">Established</h3>
                <p className="font-['Inter'] text-muted-foreground">February 2025</p>
              </CardContent>
            </Card>

            <Card className="border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Globe className="text-accent" size={24} />
                </div>
                <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">Location</h3>
                <p className="font-['Inter'] text-muted-foreground">Mumbai, India</p>
              </CardContent>
            </Card>

            <Card className="border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Target className="text-accent" size={24} />
                </div>
                <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">Focus</h3>
                <p className="font-['Inter'] text-muted-foreground">US Markets HFT</p>
              </CardContent>
            </Card>

            <Card className="border-border animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="text-accent" size={24} />
                </div>
                <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">Structure</h3>
                <p className="font-['Inter'] text-muted-foreground">LLP Partnership</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="animate-fade-in">
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

            <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
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
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
            Our Values
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center animate-fade-in">
              <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                Innovation
              </h3>
              <p className="font-['Inter'] text-muted-foreground">
                Constantly pushing boundaries with novel approaches to trading and technology
              </p>
            </div>

            <div className="text-center animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                Precision
              </h3>
              <p className="font-['Inter'] text-muted-foreground">
                Excellence in execution and attention to every detail of our operations
              </p>
            </div>

            <div className="text-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                Integrity
              </h3>
              <p className="font-['Inter'] text-muted-foreground">
                Operating with the highest ethical standards and transparency
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Photo Section */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
            Our Team
          </h2>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border shadow-lg bg-muted/20 animate-fade-in">
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-['Inter'] text-muted-foreground">Team photo will be displayed here</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
