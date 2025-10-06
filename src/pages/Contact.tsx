import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";
import { MapPin, Mail, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const Contact = () => {
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message Sent",
      description: "Thank you for reaching out. We'll get back to you soon.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <FloatingShapes />
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl animate-fade-in">
            <h1 className="font-['Space_Grotesk'] text-5xl md:text-6xl font-bold text-foreground mb-6">
              Get in Touch
            </h1>
            <p className="font-['Inter'] text-xl text-muted-foreground leading-relaxed">
              Have questions about Wolfcrux? Interested in partnering with us? 
              We'd love to hear from you.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Info */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-border animate-fade-in">
              <CardContent className="p-8 text-center">
                <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="text-accent" size={28} />
                </div>
                <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">
                  Company
                </h3>
                <p className="font-['Inter'] text-muted-foreground text-sm">
                  Wolfcrux Global Markets LLP
                </p>
              </CardContent>
            </Card>

            <Card className="border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardContent className="p-8 text-center">
                <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="text-accent" size={28} />
                </div>
                <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">
                  Location
                </h3>
                <p className="font-['Inter'] text-muted-foreground text-sm">
                  Mumbai, India
                </p>
              </CardContent>
            </Card>

            <Card className="border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
  <CardContent className="p-8 text-center">
    <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
      <Mail className="text-accent" size={28} />
    </div>
    <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-2">
      Email
    </h3>
    <p className="font-['Inter'] text-muted-foreground text-sm">
      <a href="mailto:info@wolfcrux.com" className="text-accent hover:underline">
        info@wolfcrux.com
      </a>
    </p>
  </CardContent>
</Card>

          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold text-foreground mb-4">
              Send us a Message
            </h2>
            <p className="font-['Inter'] text-muted-foreground">
              Fill out the form below and we'll get back to you as soon as possible.
            </p>
          </div>

          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-['Inter'] text-sm font-medium text-foreground mb-2">
                      First Name
                    </label>
                    <Input 
                      type="text" 
                      required 
                      className="font-['Inter']"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block font-['Inter'] text-sm font-medium text-foreground mb-2">
                      Last Name
                    </label>
                    <Input 
                      type="text" 
                      required 
                      className="font-['Inter']"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-['Inter'] text-sm font-medium text-foreground mb-2">
                    Email
                  </label>
                  <Input 
                    type="email" 
                    required 
                    className="font-['Inter']"
                    placeholder="john.doe@example.com"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] text-sm font-medium text-foreground mb-2">
                    Subject
                  </label>
                  <Input 
                    type="text" 
                    required 
                    className="font-['Inter']"
                    placeholder="How can we help you?"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] text-sm font-medium text-foreground mb-2">
                    Message
                  </label>
                  <Textarea 
                    required 
                    className="min-h-[150px] font-['Inter']"
                    placeholder="Your message..."
                  />
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-['Inter']"
                >
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
