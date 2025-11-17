import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, LineChart, Users, Cpu, Code2 } from "lucide-react";

const Careers = () => {
  const positions = [
    {
      title: "US Equity Trader",
      department: "Trading",
      location: "Mumbai",
      icon: LineChart,
      description: `
        This is a full-time, on-site role for an Equity Trader in Mumbai. 
        The Equity Trader will focus on analyzing market trends, providing liquidity, 
        executing trading strategies, and actively engaging in U.S. equity markets.

        Responsibilities include:
        • Applying technical analysis  
        • Executing trades with discipline  
        • Making informed decisions under pressure  
        • Managing risk effectively  
        • Tracking U.S. equity market behavior  
        • Contributing to team trading performance  

        Qualifications:
        • Strong technical analysis skills  
        • Knowledge of stock market dynamics  
        • Ability to analyze market data quickly  
        • High discipline and strong work ethic  
        • Bachelor’s degree in Finance/Economics (preferred)  
        • Prior trading experience is a plus but not required  

        Salary:
        • ₹20,000 – ₹25,000 per month  
        • Monthly incentives paid separately  

        Job Timings:
        • Monday to Friday  
        • 1:30 PM to 8:30 PM  
      `,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <FloatingShapes />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-5xl md:text-6xl font-bold text-foreground mb-6">
              Join Our Team
            </h1>
            <p className="font-['Inter'] text-xl text-muted-foreground leading-relaxed">
              We're looking for exceptional talent to help us push the boundaries 
              of quantitative trading. If you're passionate about technology, 
              mathematics, and financial markets, we'd love to hear from you.
            </p>
          </div>
        </div>
      </section>

      {/* Why Join */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
            Why Wolfcrux?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="text-accent" size={32} />
              </div>
              <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-foreground mb-2">
                Collaborative Culture
              </h3>
              <p className="font-['Inter'] text-sm text-muted-foreground">
                Work with brilliant minds in a supportive, innovative environment
              </p>
            </div>

            <div className="text-center animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <LineChart className="text-accent" size={32} />
              </div>
              <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-foreground mb-2">
                Growth Opportunities
              </h3>
              <p className="font-['Inter'] text-sm text-muted-foreground">
                Rapid career progression in a fast-growing firm
              </p>
            </div>

            <div className="text-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Cpu className="text-accent" size={32} />
              </div>
              <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-foreground mb-2">
                Cutting-Edge Tech
              </h3>
              <p className="font-['Inter'] text-sm text-muted-foreground">
                Work with the latest technology and infrastructure
              </p>
            </div>

            <div className="text-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Code2 className="text-accent" size={32} />
              </div>
              <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-foreground mb-2">
                Competitive Package
              </h3>
              <p className="font-['Inter'] text-sm text-muted-foreground">
                Industry-leading compensation and benefits
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold text-foreground mb-12">
            Open Positions
          </h2>

          <div className="space-y-6">
            {positions.map((position, index) => (
              <Card
                key={index}
                className="border-border hover:shadow-lg transition-all animate-fade-in group cursor-pointer"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => window.location.href = "mailto:info@wolfcrux.com"}
              >
                <CardContent className="p-8">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex items-start gap-6 flex-1">
                      <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <position.icon className="text-accent" size={24} />
                      </div>

                      <div className="flex-1">
                        <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-2">
                          {position.title}
                        </h3>

                        <div className="flex gap-4 mb-3">
                          <span className="font-['Inter'] text-sm text-muted-foreground">{position.department}</span>
                          <span className="font-['Inter'] text-sm text-muted-foreground">• {position.location}</span>
                        </div>

                        <p className="whitespace-pre-line font-['Inter'] text-muted-foreground">
                          {position.description}
                        </p>
                      </div>
                    </div>

                    <ArrowRight
                      className="text-accent group-hover:translate-x-2 transition-transform flex-shrink-0"
                      size={24}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Careers;
