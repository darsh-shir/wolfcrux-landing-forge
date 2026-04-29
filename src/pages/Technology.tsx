import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

import { Cpu, Database, Network, Gauge, Lock, Code } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useReveal } from "@/hooks/useReveal";

import AuroraBackground from "@/components/landing/AuroraBackground";

import SpotlightTiltCard from "@/components/landing/SpotlightTiltCard";
import ScrollProgress from "@/components/landing/ScrollProgress";
import AnimatedCounter from "@/components/landing/AnimatedCounter";

const Technology = () => {
  useReveal();
  return (
    <div className="min-h-screen bg-background relative">
      <ScrollProgress />
      <Navigation />

      {/* Hero Section — code rain signature */}
      <section className="relative pt-24 md:pt-32 pb-12 md:pb-20 overflow-hidden">
        <AuroraBackground className="opacity-70" />
        

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-3xl sm:text-4xl md:text-6xl font-bold text-foreground mb-6">
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
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-bold text-foreground text-center mb-12 reveal">
            Core Infrastructure
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Gauge, title: "Low Latency Execution", desc: "Custom-built trading engines written in C++ and optimized assembly, achieving sub-microsecond order processing times with kernel bypass networking." },
              { icon: Network, title: "Co-Location", desc: "Strategic placement of servers in proximity to major US exchanges, minimizing network latency and ensuring fastest possible market access." },
              { icon: Database, title: "Big Data Analytics", desc: "Distributed processing frameworks analyzing terabytes of historical and real-time market data to identify patterns and optimize strategies." },
              { icon: Cpu, title: "Machine Learning", desc: "Advanced ML models for price prediction, pattern recognition, and strategy optimization, continuously learning from market dynamics." },
              { icon: Lock, title: "Risk Management", desc: "Real-time risk monitoring systems with automated circuit breakers and position limits to ensure controlled exposure at all times." },
              { icon: Code, title: "Proprietary Algorithms", desc: "Custom-developed trading algorithms leveraging quantitative research, market microstructure analysis, and statistical arbitrage techniques." },
            ].map((c, i) => (
              <div
                key={c.title}
                className="reveal"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <SpotlightTiltCard className="gradient-border h-full">
                  <Card className="border-0 bg-transparent h-full group">
                    <CardContent className="p-6 sm:p-8">
                      <div className="icon-glow w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-accent/15">
                        <c.icon className="text-accent" size={28} />
                      </div>
                      <h3 className="font-['Space_Grotesk'] text-xl font-semibold text-foreground mb-3">
                        {c.title}
                      </h3>
                      <p className="font-['Inter'] text-muted-foreground leading-relaxed">
                        {c.desc}
                      </p>
                    </CardContent>
                  </Card>
                </SpotlightTiltCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack — animated counter metrics */}
      <section className="py-12 md:py-20 relative overflow-hidden">
        <AuroraBackground className="opacity-40" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="reveal group/metrics">
              <h2 className="font-['Space_Grotesk'] text-3xl font-bold text-foreground mb-6">
                Performance Metrics
              </h2>
              <div className="space-y-6">
                {[
                  { label: "Order Latency", end: 1, prefix: "<", suffix: "μs", width: 95 },
                  { label: "Market Data Processing", end: 10, suffix: "M+ msg/sec", width: 90 },
                  { label: "System Uptime", end: 99.99, suffix: "%", decimals: 2, width: 99 },
                  { label: "Network Reliability", end: 99.999, suffix: "%", decimals: 3, width: 100 },
                ].map((m, i) => (
                  <div key={m.label}>
                    <div className="flex justify-between mb-2">
                      <span className="font-['Inter'] text-muted-foreground">
                        {m.label}
                      </span>
                      <span className="font-['Space_Grotesk'] font-semibold text-gradient-accent">
                        <AnimatedCounter
                          end={m.end}
                          prefix={m.prefix}
                          suffix={m.suffix}
                          decimals={m.decimals}
                        />
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[hsl(220_90%_55%)] via-[hsl(265_85%_60%)] to-[hsl(190_95%_50%)] rounded-full origin-left scale-x-0 group-[.is-visible]/metrics:scale-x-100 transition-transform duration-1000 ease-out"
                        style={{
                          width: `${m.width}%`,
                          transitionDelay: `${200 + i * 150}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="reveal" style={{ transitionDelay: "150ms" }}>
              <h2 className="font-['Space_Grotesk'] text-3xl font-bold text-foreground mb-6">
                Innovation Focus
              </h2>
              <p className="font-['Inter'] text-muted-foreground leading-relaxed mb-4">
                Our technology team continuously researches and implements cutting-edge
                solutions to maintain our competitive advantage. Current areas of focus include:
              </p>
              <ul className="space-y-3">
                {[
                  "FPGA-based order processing for nanosecond latencies",
                  "Deep learning models for market regime detection",
                  "Quantum-inspired optimization algorithms",
                  "Advanced order book simulation engines",
                  "Real-time sentiment analysis from alternative data",
                ].map((item, i) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 transition-all duration-300 hover:translate-x-1.5 hover:text-foreground reveal"
                    style={{ transitionDelay: `${i * 80}ms` }}
                  >
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0 animate-pulse" />
                    <span className="font-['Inter'] text-muted-foreground">{item}</span>
                  </li>
                ))}
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
