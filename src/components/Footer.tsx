import { Link } from "react-router-dom";
import logo from "@/assets/wolfcrux-logo.png";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src={logo} alt="WOLFCRUX" className="h-10 w-10 object-contain" />
              <span className="font-['Space_Grotesk'] text-lg font-bold text-foreground">
                Wolfcrux Global Markets LLP
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4 max-w-md font-['Inter']">
              Premier high-frequency trading firm specializing in US markets. 
              Established in February 2025, based in Mumbai, India. 
              <br>
                LLP Identification Number : ACQ-1837
              </br>
              
            </p>
            <p className="text-xs text-muted-foreground font-['Inter']">
              © 2025 Wolfcrux Global Markets LLP. All rights reserved.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-['Inter']">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/technology" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-['Inter']">
                  Technology
                </Link>
              </li>
              <li>
                <Link to="/careers" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-['Inter']">
                  Careers
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-['Space_Grotesk'] font-semibold text-foreground mb-4">Connect</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-['Inter']">
                  Contact Us
                </Link>
              </li>
              <li>
                <p className="text-sm text-muted-foreground font-['Inter']">Mumbai, India</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
