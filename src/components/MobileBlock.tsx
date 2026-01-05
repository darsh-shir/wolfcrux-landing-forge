import { useIsMobile } from "@/hooks/use-mobile";
import { Monitor, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/wolfcrux-logo.png";

interface MobileBlockProps {
  children: React.ReactNode;
}

const MobileBlock = ({ children }: MobileBlockProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <img src={logo} alt="Wolfcrux" className="h-16 w-16 object-contain" />
            </div>
            <CardTitle className="text-xl font-['Space_Grotesk'] flex items-center justify-center gap-2">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              Mobile Not Supported
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground font-['Inter']">
              Login is not supported on mobile devices. Please use a desktop or tablet to access your account.
            </p>
            <div className="flex items-center justify-center gap-2 text-primary">
              <Monitor className="h-5 w-5" />
              <span className="font-medium">Use Desktop or Tablet</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default MobileBlock;
