import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";
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
        This is a full-time, on-site role for a US Equity Trader based in Mumbai. 
        The Equity Trader will be responsible for analyzing market trends, providing liquidity, 
        and executing high-precision trading strategies during US market hours. You will participate in 
        fast-paced trading sessions, apply technical analysis, and make informed decisions under pressure.

        Your role includes interpreting real-time data, maintaining discipline, and contributing to the team’s 
        overall trading performance. You will collaborate with senior traders, refine trading strategies, and adapt 
        quickly to changing market conditions. A strong passion for financial markets, high focus, and a willingness 
        to continuously improve are essential.

        **Qualifications**
        • Strong understanding of stock market concepts and live market behavior  
        • Technical Analysis knowledge & ability to build or follow strategies  
        • Excellent analytical thinking and fast decision-making ability  
        • Strong discipline and emotional control  
        • Bachelor's degree in Finance / Economics preferred  
        • Prior trading experience is an advantage, not mandatory  

        **Salary**
        • Monthly Salary: ₹20,000 – ₹25,000  
        • Additional Monthly Incentives paid  

        **Timings**
        • Monday to Friday — 1:30 PM to 8:00 PM
      `,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* HERO SECTION */}
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

      {/* WHY JOIN */}
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

      {/* OPEN POSITIONS */}
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
                onClick={() => (window.location.href = "mailto:info@wolfcrux.com")}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-8">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex items-start gap-6 flex-1">
                      <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <position.icon className="text-accent" size={24} />
                      </div>

                      <div className="flex-1 whitespace-pre-line">
                        <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-2">
                          {position.title}
                        </h3>

                        <div className="flex gap-4 mb-3">
                          <span className="font-['Inter'] text-sm text-muted-foreground">
                            {position.department}
                          </span>
                          <span className="font-['Inter'] text-sm text-muted-foreground">
                            • {position.location}
                          </span>
                        </div>

                        <p className="font-['Inter'] text-muted-foreground whitespace-pre-line">
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

      {/* APPLICATION PROCESS */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
            Application Process
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">

            <div className="text-center animate-fade-in">
              <div className="w-12 h-12 bg-accent text-accent-foreground rounded-full flex items-center justify-center mx-auto mb-4 font-['Space_Grotesk'] font-bold text-lg">
                1
              </div>
              <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">Apply</h3>
              <p className="font-['Inter'] text-sm text-muted-foreground">Submit your application and resume</p>
            </div>

            <div className="text-center animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="w-12 h-12 bg-accent text-accent-foreground rounded-full flex items-center justify-center mx-auto mb-4 font-['Space_Grotesk'] font-bold text-lg">
                2
              </div>
              <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">Screen</h3>
              <p className="font-['Inter'] text-sm text-muted-foreground">Technical assessment and review</p>
            </div>

            <div className="text-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="w-12 h-12 bg-accent text-accent-foreground rounded-full flex items-center justify-center mx-auto mb-4 font-['Space_Grotesk'] font-bold text-lg">
                3
              </div>
              <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">Interview</h3>
              <p className="font-['Inter'] text-sm text-muted-foreground">Meet with our team</p>
            </div>

            <div className="text-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <div className="w-12 h-12 bg-accent text-accent-foreground rounded-full flex items-center justify-center mx-auto mb-4 font-['Space_Grotesk'] font-bold text-lg">
                4
              </div>
              <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">Offer</h3>
              <p className="font-['Inter'] text-sm text-muted-foreground">Welcome to Wolfcrux!</p>
            </div>

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-primary/5" />
        <FloatingShapes />

        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold text-foreground mb-6">
            Don't See a Perfect Fit?
          </h2>
          <p className="font-['Inter'] text-lg text-muted-foreground mb-8">
            We're always interested in hearing from talented individuals. 
            Send us your resume and we'll keep you in mind for future opportunities.
          </p>

          <Button
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-['Inter']"
            onClick={() => (window.location.href = "mailto:info@wolfcrux.com")}
          >
            Get in Touch
            <ArrowRight className="ml-2" size={20} />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Careers;
