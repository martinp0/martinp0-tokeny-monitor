import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/PublicHeader";

const NotFound = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Helmet>
        <title>{`${t("notFound.title")} (404) – Tokeny`}</title>
        <meta name="description" content={t("notFound.desc")} />
        <meta name="robots" content="noindex,follow" />
      </Helmet>
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="text-center max-w-md">
          <p className="text-7xl font-semibold tracking-tight text-muted-foreground/40 tabular-nums mb-6">404</p>
          <h1 className="text-3xl font-semibold tracking-tight mb-3">{t("notFound.title")}</h1>
          <p className="text-muted-foreground text-lg mb-8">{t("notFound.desc")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg">
              <Link to="/">{t("notFound.home")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/llm-cost-calculator">{t("notFound.calculator")}</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
