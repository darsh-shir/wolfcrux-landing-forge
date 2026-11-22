const FloatingShapes = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Floating geometric shapes — kept to the edges so they never sit over text,
          and hidden on small screens where there is no free space for them. */}
      <div className="hidden md:block">
        <div
          className="absolute top-20 right-10 w-32 h-32 border-2 border-accent/20 rounded-full animate-float-slow"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="absolute top-28 -left-12 w-24 h-24 border-2 border-accent/25 rotate-45 animate-float"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute bottom-40 right-16 w-40 h-40 border-2 border-accent/20 rounded-lg animate-float-slow"
          style={{ animationDelay: "2s", animationDuration: "11s" }}
        />
        <div
          className="absolute -bottom-12 -left-8 w-28 h-28 border-2 border-accent/25 rounded-full animate-float"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute top-2/3 -left-6 w-16 h-16 border-2 border-accent/20 rounded-md animate-float-slow"
          style={{ animationDelay: "2.5s", animationDuration: "10s" }}
        />
      </div>

      {/* Subtle gradient orbs */}
      <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "3s" }}
      />
    </div>
  );
};

export default FloatingShapes;
