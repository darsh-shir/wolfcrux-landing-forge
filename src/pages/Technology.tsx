import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";
import { Cpu, Database, Network, Gauge, Lock, Code } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const Technology = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <FloatingShapes />
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-5xl md:text-6xl font-bold text-foreground mb-6">
              Technology
            </h1>
            <p className="font-['Inter'] text-xl text-muted-foreground leading-relaxed">
              Our technology stack is built for speed, reliability, and precision. 
              Every component is optimized to operate at microsecond latencies while 
              processing millions of market events per second.
            </p>
          </div>
        </div>
      </section>

      {/* Core Tech */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
            Core Infrastructure
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-border hover:shadow-lg transition-shadow animate-fade-in">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6">
                  <Gauge className="text-accent" size={28} />
                </div>
                <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                  Low Latency Execution
                </h3>
                <p className="font-['Inter'] text-muted-foreground leading-relaxed">
                  Custom-built trading engines written in C++ and optimized assembly, 
                  achieving sub-microsecond order processing times with kernel bypass 
                  networking.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6">
                  <Network className="text-accent" size={28} />
                </div>
                <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                  Co-Location
                </h3>
                <p className="font-['Inter'] text-muted-foreground leading-relaxed">
                  Strategic placement of servers in proximity to major US exchanges, 
                  minimizing network latency and ensuring fastest possible market access.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6">
                  <Database className="text-accent" size={28} />
                </div>
                <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                  Big Data Analytics
                </h3>
                <p className="font-['Inter'] text-muted-foreground leading-relaxed">
                  Distributed processing frameworks analyzing terabytes of historical 
                  and real-time market data to identify patterns and optimize strategies.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6">
                  <Cpu className="text-accent" size={28} />
                </div>
                <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                  Machine Learning
                </h3>
                <p className="font-['Inter'] text-muted-foreground leading-relaxed">
                  Advanced ML models for price prediction, pattern recognition, and 
                  strategy optimization, continuously learning from market dynamics.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6">
                  <Lock className="text-accent" size={28} />
                </div>
                <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                  Risk Management
                </h3>
                <p className="font-['Inter'] text-muted-foreground leading-relaxed">
                  Real-time risk monitoring systems with automated circuit breakers 
                  and position limits to ensure controlled exposure at all times.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow animate-fade-in" style={{ animationDelay: "0.5s" }}>
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6">
                  <Code className="text-accent" size={28} />
                </div>
                <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                  Proprietary Algorithms
                </h3>
                <p className="font-['Inter'] text-muted-foreground leading-relaxed">
                  Custom-developed trading algorithms leveraging quantitative research, 
                  market microstructure analysis, and statistical arbitrage techniques.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="animate-fade-in">
              <h2 className="font-['Space_Grotesk'] text-3xl font-bold text-foreground mb-6">
                Performance Metrics
              </h2>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-['Inter'] text-muted-foreground">Order Latency</span>
                    <span className="font-['Space_Grotesk'] font-semibold text-accent">&lt;1μs</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent w-[95%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-['Inter'] text-muted-foreground">Market Data Processing</span>
                    <span className="font-['Space_Grotesk'] font-semibold text-accent">10M+ msg/sec</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent w-[90%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-['Inter'] text-muted-foreground">System Uptime</span>
                    <span className="font-['Space_Grotesk'] font-semibold text-accent">99.99%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent w-[99%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-['Inter'] text-muted-foreground">Network Reliability</span>
                    <span className="font-['Space_Grotesk'] font-semibold text-accent">99.999%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent w-[100%]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <h2 className="font-['Space_Grotesk'] text-3xl font-bold text-foreground mb-6">
                Innovation Focus
              </h2>
              <p className="font-['Inter'] text-muted-foreground leading-relaxed mb-4">
                Our technology team continuously researches and implements cutting-edge 
                solutions to maintain our competitive advantage. Current areas of focus include:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="font-['Inter'] text-muted-foreground">
                    FPGA-based order processing for nanosecond latencies
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="font-['Inter'] text-muted-foreground">
                    Deep learning models for market regime detection
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="font-['Inter'] text-muted-foreground">
                    Quantum-inspired optimization algorithms
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="font-['Inter'] text-muted-foreground">
                    Advanced order book simulation engines
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="font-['Inter'] text-muted-foreground">
                    Real-time sentiment analysis from alternative data
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Technology;
