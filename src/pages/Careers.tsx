import Navigation from "@/components/Navigation";
import { usePageMeta } from "@/hooks/usePageMeta";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, LineChart, Users, Cpu, Code2 } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";
import { useState } from "react";
import ApplyDialog from "@/components/careers/ApplyDialog";
import { DB_UPDATE_APPLIED } from "@/lib/features";

import AuroraBackground from "@/components/landing/AuroraBackground";

import SpotlightTiltCard from "@/components/landing/SpotlightTiltCard";
import ScrollProgress from "@/components/landing/ScrollProgress";
import AnimatedCounter from "@/components/landing/AnimatedCounter";

const Careers = () => {
  useReveal();
  usePageMeta({ title: "Careers — US Equity Trader Jobs in Mumbai | Wolfcrux", description: "Join Wolfcrux Global Markets in Mumbai. We're hiring US Equity Traders — see open roles, salary, timings and how to apply.", path: "/careers" });
  const positions = [
    {
      title: "US Equity Trader",
      department: "Trading",
      location: "Mumbai",
      icon: LineChart,
      summary: [
        "This is a full-time, on-site role for a US Equity Trader based in Mumbai. The Equity Trader will be responsible for analyzing market trends, providing liquidity, and executing high-precision trading strategies during US market hours. You will participate in fast-paced trading sessions, apply technical analysis, and make informed decisions under pressure.",
        "Your role includes interpreting real-time data, maintaining discipline, and contributing to the team’s overall trading performance. You will collaborate with senior traders, refine trading strategies, and adapt quickly to changing market conditions. A strong passion for financial markets, high focus, and a willingness to continuously improve are essential.",
      ],
      sections: [
        {
          heading: "Qualifications",
          items: [
            "Strong understanding of stock market concepts and live market behavior",
            "Technical Analysis knowledge & ability to build or follow strategies",
            "Excellent analytical thinking and fast decision-making ability",
            "Strong discipline and emotional control",
            "Bachelor's degree in Finance / Economics preferred",
            "Prior trading experience is an advantage, not mandatory",
          ],
        },
        {
          heading: "Salary",
          items: [
            "Monthly Salary: ₹20,000 – ₹25,000",
            "Additional monthly incentives can go up to ₹12 Lakhs",
          ],
        },
        {
          heading: "Timings",
          items: ["Monday to Friday — 1:30 PM to 7:00 PM"],
        },
      ],
    },
  ];

  // Role the application form is open for (null = closed).
  const [applyFor, setApplyFor] = useState<string | null>(null);
  // Until the applications inbox exists, applying opens the visitor's email app.
  const apply = (title: string) => {
    if (DB_UPDATE_APPLIED) return setApplyFor(title);
    window.location.href =
      title === "General application"
        ? "mailto:info@wolfcrux.com"
        : `mailto:info@wolfcrux.com?subject=${encodeURIComponent(`Application: ${title}`)}&body=${encodeURIComponent(
            `Hi Wolfcrux team,\n\nI'd like to apply for the ${title} role.\n\nName:\nPhone:\nLinkedIn (optional):\n\nPlease find my resume attached.\n`
          )}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <Navigation />

      {/* HERO */}
      <section className="relative pt-24 md:pt-32 pb-12 md:pb-20 overflow-hidden">
        <AuroraBackground />
        <FloatingShapes />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-3xl sm:text-4xl md:text-6xl font-bold text-foreground mb-6">
              Join Our{" "}
              <span className="text-gradient-accent">Team</span>
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
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-bold text-foreground text-center mb-12 reveal">
            Why Wolfcrux?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Users, title: "Collaborative Culture", desc: "Work with brilliant minds in a supportive, innovative environment" },
              { icon: LineChart, title: "Growth Opportunities", desc: "Rapid career progression in a fast-growing firm" },
              { icon: Cpu, title: "Cutting-Edge Tech", desc: "Work with the latest technology and infrastructure" },
              { icon: Code2, title: "Competitive Package", desc: "Industry-leading compensation and benefits" },
            ].map((item, i) => (
              <div
                key={item.title}
                className="reveal"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <SpotlightTiltCard className="gradient-border h-full">
                  <Card className="border-0 bg-transparent h-full group">
                    <CardContent className="p-6 text-center">
                      <div className="icon-glow w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-accent/20">
                        <item.icon className="text-accent" size={32} />
                      </div>
                      <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-foreground mb-2">
                        {item.title}
                      </h3>
                      <p className="font-['Inter'] text-sm text-muted-foreground">
                        {item.desc}
                      </p>
                    </CardContent>
                  </Card>
                </SpotlightTiltCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OPEN POSITIONS */}
      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-12 reveal flex-wrap gap-4">
            <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
              Open Positions
            </h2>
            <div className="text-right">
              <div className="text-4xl font-bold text-gradient-accent font-['Space_Grotesk']">
                <AnimatedCounter end={positions.length} duration={900} />
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Roles open
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {positions.map((position, index) => (
              <div
                key={index}
                className="reveal"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <SpotlightTiltCard className="gradient-border" tilt={false}>
                  <Card className="border-0 bg-transparent group">
                    <CardContent className="p-6 sm:p-8">
                      <div className="flex items-start justify-between gap-4 sm:gap-6">
                        <div className="flex items-start gap-4 sm:gap-6 flex-1">
                          <div className="icon-glow w-10 h-10 sm:w-12 sm:h-12 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-accent/15">
                            <position.icon className="text-accent" size={20} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-['Space_Grotesk'] text-lg sm:text-xl font-semibold text-foreground mb-2">
                              {position.title}
                            </h3>

                            <div className="flex flex-wrap gap-2 sm:gap-4 mb-3 text-xs sm:text-sm">
                              <span className="font-['Inter'] text-muted-foreground">
                                {position.department}
                              </span>
                              <span className="font-['Inter'] text-muted-foreground">
                                • {position.location}
                              </span>
                            </div>

                            <div className="font-['Inter'] text-sm sm:text-base text-muted-foreground leading-relaxed space-y-4">
                              {position.summary.map((paragraph, i) => (
                                <p key={i}>{paragraph}</p>
                              ))}

                              {position.sections.map((section) => (
                                <div key={section.heading}>
                                  <h4 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">
                                    {section.heading}
                                  </h4>
                                  <ul className="list-disc pl-5 space-y-1 marker:text-accent">
                                    {section.items.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>

                            <Button className="mt-6 group/apply" onClick={() => apply(position.title)}>
                              Apply Now
                              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/apply:translate-x-1" />
                            </Button>
                            <p className="mt-2 text-xs text-muted-foreground font-['Inter']">
                              {DB_UPDATE_APPLIED ? "Upload your resume in the form" : "Opens your email app"} — or email your resume to{" "}
                              <a href="mailto:info@wolfcrux.com" className="text-accent underline-offset-2 hover:underline">
                                info@wolfcrux.com
                              </a>
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </SpotlightTiltCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APPLICATION PROCESS — signature path */}
      <section className="py-12 md:py-20 bg-muted/30 relative overflow-hidden">
        <AuroraBackground className="opacity-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-bold text-foreground text-center mb-12 reveal">
            Application Process
          </h2>

          <div className="relative max-w-5xl mx-auto">
            {/* connector line behind the steps */}
            <div className="hidden md:block absolute top-6 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { num: 1, title: "Apply", desc: "Submit your application and resume" },
                { num: 2, title: "Screen", desc: "Technical assessment and review" },
                { num: 3, title: "Interview", desc: "Meet with our team" },
                { num: 4, title: "Offer", desc: "Welcome to Wolfcrux!" },
              ].map((step, i) => (
                <div
                  key={step.num}
                  className="text-center reveal group relative"
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  <div className="relative w-12 h-12 mx-auto mb-4">
                    {/* pulsing ring */}
                    <span className="absolute inset-0 rounded-full bg-accent/20 animate-ping opacity-0 group-hover:opacity-100" />
                    <div className="relative w-12 h-12 bg-accent text-accent-foreground rounded-full flex items-center justify-center font-['Space_Grotesk'] font-bold text-lg transition-all duration-300 group-hover:scale-110 shadow-lg shadow-accent/30">
                      {step.num}
                    </div>
                  </div>
                  <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="font-['Inter'] text-sm text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 md:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-primary/5" />
        <FloatingShapes />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6">
            Don't See a Perfect Fit?
          </h2>
          <p className="font-['Inter'] text-lg text-muted-foreground mb-8">
            We're always interested in hearing from talented individuals.
            Send us your resume and we'll keep you in mind for future opportunities.
          </p>

          <Button
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-['Inter'] shadow-lg shadow-accent/20"
            onClick={() => apply("General application")}
          >
            Send Your Resume
            <ArrowRight className="ml-2" size={20} />
          </Button>
        </div>
      </section>

      <ApplyDialog
        open={applyFor !== null}
        onOpenChange={(o) => !o && setApplyFor(null)}
        position={applyFor ?? ""}
      />
      <Footer />
    </div>
  );
};

export default Careers;
