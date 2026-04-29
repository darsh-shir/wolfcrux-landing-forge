import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

import AuroraBackground from "@/components/landing/AuroraBackground";

import SpotlightTiltCard from "@/components/landing/SpotlightTiltCard";
import ScrollProgress from "@/components/landing/ScrollProgress";


import purviPhoto from "@/assets/purvi_photo.jpg";
import labdhiPhoto from "@/assets/labdhi_photo.jpg";
import darshitPhoto from "@/assets/darshit_photo.jpeg";
import jinalPhoto from "@/assets/jinal-photo.jpeg";

const Testimonials = () => {
  useReveal();
  const testimonials = [
    { quote: "What sets Wolfcrux apart is how the seniors break down complex ideas into simple, actionable steps. I’ve never felt this confident placing trades backed by real logic and risk control.", author: "Purvi", position: "Equity Trader", image: purviPhoto },
    { quote: "The trust here is real — from day one I felt like I was part of something bigger. Knowing the team has your back during tough market days makes all the difference.", author: "Labdhi", position: "Equity Trader", image: labdhiPhoto },
    { quote: "Wolfcrux’s technology and data-driven approach completely changed the way I analyze price action. Tools here are built for traders who want speed, precision, and real edge.", author: "Darshit", position: "Equity Analyst", image: darshitPhoto },
    { quote: "Working here has shown me what professional trading truly feels like — clear communication, teamwork, and consistent results. The environment makes you better without even realizing it.", author: "Jinal", position: "Equity Trader", image: jinalPhoto },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <Navigation />

      <main className="relative pt-24 md:pt-32 pb-12 md:pb-20 px-4 sm:px-6 overflow-hidden">
        <AuroraBackground />

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16 animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-3xl sm:text-4xl md:text-6xl font-bold text-foreground mb-6">
              Traders
              <span className="text-gradient-accent">Testimonials</span>
            </h1>
            <p className="font-['Inter'] text-xl text-muted-foreground max-w-3xl mx-auto">
              Hear what our Traders say about working with Wolfcrux Global Markets.
            </p>

            {/* Signature strip */}
            <div className="mt-8 inline-flex items-baseline">
              <span className="text-sm uppercase tracking-widest text-muted-foreground">
                Stories from the desk
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((test, index) => (
              <div
                key={index}
                className="reveal"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <SpotlightTiltCard className="gradient-border h-full">
                  <Card className="group border-0 bg-transparent flex flex-col h-full">
                    <CardContent className="p-5 sm:p-8 flex flex-col flex-grow">
                      <Quote
                        className="text-accent mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]"
                        size={32}
                      />
                      <p className="font-['Inter'] text-lg text-foreground mb-6 leading-relaxed flex-grow">
                        "{test.quote}"
                      </p>

                      <div className="flex items-center gap-4 mt-auto">
                        <img
                          src={test.image}
                          alt={test.author}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-transparent transition-all duration-300 group-hover:ring-accent/40 group-hover:scale-105"
                        />
                        <div>
                          <h4 className="font-['Space_Grotesk'] font-semibold text-foreground">
                            {test.author}
                          </h4>
                          <p className="font-['Inter'] text-sm text-muted-foreground">
                            {test.position}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </SpotlightTiltCard>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Testimonials;
