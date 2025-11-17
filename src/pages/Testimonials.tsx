import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

// ✅ Import all photos correctly
import krishaPhoto from "@/assets/krisha_photo.jpeg";
import jenishPhoto from "@/assets/jenish_photo.jpeg";
import purviPhoto from "@/assets/purvi_photo.jpg";      // NEW correct import
import labdhiPhoto from "@/assets/labdhi_photo.jpg";
import darshitPhoto from "@/assets/darshit_photo.jpeg";
import jinalPhoto from "@/assets/jinal-photo.jpeg";

const Testimonials = () => {
  const testimonials = [
    {
      quote:
        "Joining Wolfcrux Global pushed me to think faster and trade smarter — the team energy is unmatched. Every day I feel like I’m leveling up with people who genuinely want me to win.",
      author: "Krisha Gandhi",
      position: "Equity Trader",
      image: krishaPhoto,
    },
    {
      quote:
        "Wolfcrux taught me discipline and gave me a structure that actually works in live markets. The support during volatile sessions has been the biggest game-changer for my trading career.",
      author: "Jenish Pansuriya",
      position: "Senior Trader",
      image: jenishPhoto,
    },
    {
      quote:
        "What sets Wolfcrux apart is how the seniors break down complex ideas into simple, actionable steps. I’ve never felt this confident placing trades backed by real logic and risk control.",
      author: "Purvi Doshi",
      position: "Equity Trader",
      image: purviPhoto,       // ✅ Correct image
    },
    {
      quote:
        "The trust here is real — from day one I felt like I was part of something bigger. Knowing the team has your back during tough market days makes all the difference.",
      author: "Labdhi Gada",
      position: "Equity Trader",
      image: labdhiPhoto,
    },
    {
      quote:
        "Wolfcrux’s technology and data-driven approach completely changed the way I analyze price action. Tools here are built for traders who want speed, precision, and real edge.",
      author: "Darshit Shiroiya",
      position: "Equity Analyst",
      image: darshitPhoto,
    },
    {
      quote:
        "Working here has shown me what professional trading truly feels like — clear communication, teamwork, and consistent results. The environment makes you better without even realizing it.",
      author: "Jinal Ranka",
      position: "Equity Trader",
      image: jinalPhoto,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-5xl md:text-6xl font-bold text-foreground mb-6">
              Traders Testimonials
            </h1>
            <p className="font-['Inter'] text-xl text-muted-foreground max-w-3xl mx-auto">
              Hear what our Traders say about working with Wolfcrux Global Markets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((test, index) => (
              <Card
                key={index}
                className="group hover:shadow-xl transition-all duration-300 animate-fade-in border-border bg-card"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-8">
                  <Quote className="text-accent mb-4" size={32} />
                  <p className="font-['Inter'] text-lg text-foreground mb-6 leading-relaxed">
                    "{test.quote}"
                  </p>

                  <div className="flex items-center gap-4">
                    <img
                      src={test.image}
                      alt={test.author}
                      className="w-12 h-12 rounded-full object-cover"
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
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Testimonials;
