import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

const Testimonials = () => {
  const testimonials = [
    {
      quote: "Add your testimonial text here. This is a great place to showcase client feedback and success stories.",
      author: "Client Name",
      position: "Position, Company Name",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop"
    },
    {
      quote: "Add your testimonial text here. Share experiences and results achieved through partnership with Wolfcrux.",
      author: "Client Name",
      position: "Position, Company Name",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"
    },
    {
      quote: "Add your testimonial text here. Highlight the unique value and expertise that sets Wolfcrux apart.",
      author: "Client Name",
      position: "Position, Company Name",
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop"
    },
    {
      quote: "Add your testimonial text here. Demonstrate the trust and reliability of your trading operations.",
      author: "Client Name",
      position: "Position, Company Name",
      image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop"
    },
    {
      quote: "Add your testimonial text here. Share insights about the technology and innovation at Wolfcrux.",
      author: "Client Name",
      position: "Position, Company Name",
      image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop"
    },
    {
      quote: "Add your testimonial text here. Emphasize the professional relationships and results delivered.",
      author: "Client Name",
      position: "Position, Company Name",
      image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16 animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-5xl md:text-6xl font-bold text-foreground mb-6">
              Traders Testimonials
            </h1>
            <p className="font-['Inter'] text-xl text-muted-foreground max-w-3xl mx-auto">
              Hear what our partners and Traders say about working with Wolfcrux Global Markets.
            </p>
          </div>

          {/* Testimonials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index}
                className="group hover:shadow-xl transition-all duration-300 animate-fade-in border-border bg-card"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-8">
                  <Quote className="text-accent mb-4" size={32} />
                  <p className="font-['Inter'] text-lg text-foreground mb-6 leading-relaxed">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-4">
                    <img 
                      src={testimonial.image}
                      alt={testimonial.author}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <h4 className="font-['Space_Grotesk'] font-semibold text-foreground">
                        {testimonial.author}
                      </h4>
                      <p className="font-['Inter'] text-sm text-muted-foreground">
                        {testimonial.position}
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
