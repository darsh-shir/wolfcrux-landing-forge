import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <FloatingShapes />
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="text-center space-y-8 animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-5xl md:text-7xl font-bold text-foreground leading-tight">
              Precision Trading at
              <br />
              <span className="text-accent">Microsecond Speed</span>
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
              <div className="text-center">
                <div className="text-4xl font-bold text-accent font-['Space_Grotesk']">2025</div>
                <div className="text-sm text-muted-foreground font-['Inter']">Established</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-accent font-['Space_Grotesk']">HFT</div>
                <div className="text-sm text-muted-foreground font-['Inter']">High Frequency Trading</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-accent font-['Space_Grotesk']">Mumbai</div>
                <div className="text-sm text-muted-foreground font-['Inter']">India</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="font-['Space_Grotesk'] text-3xl md:text-5xl font-bold text-foreground mb-4">
              Our Advantage
            </h2>
            <p className="font-['Inter'] text-lg text-muted-foreground max-w-2xl mx-auto">
              Combining technology, data science, and market expertise to deliver consistent results
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-border hover:shadow-lg transition-shadow animate-fade-in">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6">
                  <Zap className="text-accent" size={28} />
                </div>
                <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                  Lightning Fast
                </h3>
                <p className="font-['Inter'] text-muted-foreground">
                  Microsecond-level execution powered by proprietary infrastructure 
                  and co-location strategies in major US data centers.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6">
                  <TrendingUp className="text-accent" size={28} />
                </div>
                <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                  Data-Driven
                </h3>
                <p className="font-['Inter'] text-muted-foreground">
                  Advanced quantitative models analyzing terabytes of market data 
                  to identify profitable opportunities in real-time.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6">
                  <Shield className="text-accent" size={28} />
                </div>
                <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                  Risk Managed
                </h3>
                <p className="font-['Inter'] text-muted-foreground">
                  Sophisticated risk management systems ensuring controlled exposure 
                  and sustainable performance across market conditions.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-primary/5" />
        <FloatingShapes />
        
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold text-foreground mb-6">
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
