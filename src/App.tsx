import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { useAuth } from "@/hooks/useAuth";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import Landing from "./pages/Landing.tsx";

const Auth = lazy(() => import("./pages/Auth.tsx"));
const AuthCallback = lazy(() => import("./pages/AuthCallback.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Fun = lazy(() => import("./pages/Fun.tsx"));
const Index = lazy(() => import("./pages/Index.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const SharedDashboard = lazy(() => import("./pages/SharedDashboard.tsx"));
const LlmCostCalculator = lazy(() => import("./pages/LlmCostCalculator.tsx"));
const ClaudeApiCost = lazy(() => import("./pages/ClaudeApiCost.tsx"));
const HowToCalculateLlmCost = lazy(() => import("./pages/HowToCalculateLlmCost.tsx"));
const GptApiCost = lazy(() => import("./pages/GptApiCost.tsx"));
const Blog = lazy(() => import("./pages/Blog.tsx"));
const BlogAiCostSaving = lazy(() => import("./pages/BlogAiCostSaving.tsx"));
const BlogPromptOptimization = lazy(() => import("./pages/BlogPromptOptimization.tsx"));
const BlogTokenWindow = lazy(() => import("./pages/BlogTokenWindow.tsx"));
const BlogModelComparison = lazy(() => import("./pages/BlogModelComparison.tsx"));
const BlogMonitoringAiCosts = lazy(() => import("./pages/BlogMonitoringAiCosts.tsx"));
const BlogMultiProvider = lazy(() => import("./pages/BlogMultiProvider.tsx"));
const BlogGrokTokens = lazy(() => import("./pages/BlogGrokTokens.tsx"));

const Toaster = lazy(() => import("@/components/ui/toaster").then((m) => ({ default: m.Toaster })));
const Sonner = lazy(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })));

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" role="status" aria-label="Načítání" />
    </div>
  );
}

function ClientToasters() {
  const location = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (location.pathname !== "/") {
      setReady(true);
      return;
    }
    // Homepage toasts are unused during first paint. Load after the critical window.
    const id = window.setTimeout(() => setReady(true), 8000);
    return () => window.clearTimeout(id);
  }, [location.pathname]);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <Toaster />
      <Sonner />
    </Suspense>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <RouteFallback />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

export function AuthRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <RouteFallback />;
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/fun" element={<Fun />} />
      <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/llm-cost-calculator" element={<LlmCostCalculator />} />
      <Route path="/claude-api-cost" element={<ClaudeApiCost />} />
      <Route path="/gpt-api-cost" element={<GptApiCost />} />
      <Route path="/how-to-calculate-llm-cost" element={<HowToCalculateLlmCost />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/ai-cost-saving" element={<BlogAiCostSaving />} />
      <Route path="/blog/prompt-optimization" element={<BlogPromptOptimization />} />
      <Route path="/blog/token-window" element={<BlogTokenWindow />} />
      <Route path="/blog/gpt-vs-claude-vs-gemini" element={<BlogModelComparison />} />
      <Route path="/blog/monitoring-ai-costs" element={<BlogMonitoringAiCosts />} />
      <Route path="/blog/multi-provider-monitoring" element={<BlogMultiProvider />} />
      <Route path="/blog/grok-token-optimization" element={<BlogGrokTokens />} />
      <Route path="/shared/:token" element={<SharedDashboard />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/** Providers that must sit inside the router (currency reads the location). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="tokeny_theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <CurrencyProvider>
            <ClientToasters />
            <Suspense fallback={<RouteFallback />}>{children}</Suspense>
          </CurrencyProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

const App = () => (
  <HelmetProvider>
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  </HelmetProvider>
);

export default App;
