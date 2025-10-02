const FloatingShapes = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating geometric shapes */}
      <div className="absolute top-20 right-10 w-32 h-32 border-2 border-accent/20 rounded-full animate-float" 
           style={{ animationDelay: "0s" }} />
      <div className="absolute top-40 left-20 w-24 h-24 border-2 border-accent/30 rotate-45 animate-float"
           style={{ animationDelay: "1s" }} />
      <div className="absolute bottom-40 right-40 w-40 h-40 border-2 border-accent/20 rounded-lg animate-float"
           style={{ animationDelay: "2s" }} />
      <div className="absolute bottom-20 left-1/4 w-28 h-28 border-2 border-accent/30 rounded-full animate-float"
           style={{ animationDelay: "1.5s" }} />
      
      {/* Subtle gradient orbs */}
      <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" 
           style={{ animationDelay: "3s" }} />
    </div>
  );
};

export default FloatingShapes;
