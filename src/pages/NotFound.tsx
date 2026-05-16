import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Helmet>
        <title>Stránka nenalezena (404) – OpenRouter Monitor</title>
        <meta
          name="description"
          content="Tato stránka neexistuje nebo byla přesunuta. Vraťte se na hlavní stránku OpenRouter Monitoru."
        />
        <meta name="robots" content="noindex,follow" />
        <meta property="og:title" content="Stránka nenalezena (404) – OpenRouter Monitor" />
        <meta property="og:description" content="Tato stránka neexistuje nebo byla přesunuta." />
      </Helmet>
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
