import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { useI18n, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import type { Tenant as TenantType } from "@shared/schema";
import Landing from "@/pages/Landing";
import AdminLogin from "@/pages/admin/AdminLogin";
import ChangePassword from "@/pages/admin/ChangePassword";
import Dashboard from "@/pages/admin/Dashboard";
import Tenant from "@/pages/admin/Tenant";
import Theme from "@/pages/admin/Theme";
import Sections from "@/pages/admin/Sections";
import ContactForm from "@/pages/admin/ContactForm";
import Media from "@/pages/admin/Media";
import Testimonials from "@/pages/admin/Testimonials";
import FAQ from "@/pages/admin/FAQ";
import HeroContent from "@/pages/admin/HeroContent";
import WhyChooseUs from "@/pages/admin/WhyChooseUs";
import ContactInfo from "@/pages/admin/ContactInfo";
import FooterContent from "@/pages/admin/FooterContent";
import SEOSettings from "@/pages/admin/SEOSettings";
import Sites from "@/pages/admin/Sites";
import SiteEditor from "@/pages/admin/SiteEditor";
import AISettings from "@/pages/admin/AISettings";
import ContentGenerator from "@/pages/admin/ContentGenerator";
import BlogAdmin from "@/pages/admin/Blog";
import BlogIndex from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import NotFound from "@/pages/not-found";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: admin, isLoading, isError } = useQuery({
    queryKey: ['/api/admin/me'],
    retry: false,
    staleTime: 30_000,
  });
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && (isError || !admin)) {
      navigate('/admin/login');
    }
  }, [isLoading, isError, admin, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !admin) return null;
  return <>{children}</>;
}

function LanguageSync() {
  const [location] = useLocation();
  const { setLanguage } = useI18n();

  useEffect(() => {
    const seg = location.split('/')[1] as SupportedLanguage;
    if (SUPPORTED_LANGUAGES.includes(seg)) {
      setLanguage(seg);
    }
  }, [location, setLanguage]);

  return null;
}

function Router() {
  return (
    <>
      <LanguageSync />
      <Switch>
      <Route path="/" component={Landing} />

      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/change-password" component={() => {
        const params = new URLSearchParams(window.location.search);
        return <ChangePassword forced={params.has('forced')} />;
      }} />
      <Route path="/admin" component={() => { window.location.replace('/admin/sites'); return null; }} />
      <Route path="/admin/tenant" component={() => <RequireAuth><Tenant /></RequireAuth>} />
      <Route path="/admin/theme" component={() => <RequireAuth><Theme /></RequireAuth>} />
      <Route path="/admin/sections" component={() => <RequireAuth><Sections /></RequireAuth>} />
      <Route path="/admin/contact-form" component={() => <RequireAuth><ContactForm /></RequireAuth>} />
      <Route path="/admin/media" component={() => <RequireAuth><Media /></RequireAuth>} />
      <Route path="/admin/testimonials" component={() => <RequireAuth><Testimonials /></RequireAuth>} />
      <Route path="/admin/faq" component={() => <RequireAuth><FAQ /></RequireAuth>} />
      <Route path="/admin/hero" component={() => <RequireAuth><HeroContent /></RequireAuth>} />
      <Route path="/admin/why-choose-us" component={() => <RequireAuth><WhyChooseUs /></RequireAuth>} />
      <Route path="/admin/contact-info" component={() => <RequireAuth><ContactInfo /></RequireAuth>} />
      <Route path="/admin/footer" component={() => <RequireAuth><FooterContent /></RequireAuth>} />
      <Route path="/admin/seo" component={() => <RequireAuth><SEOSettings /></RequireAuth>} />
      <Route path="/admin/ai-settings" component={() => <RequireAuth><AISettings /></RequireAuth>} />
      <Route path="/admin/content-generator" component={() => <RequireAuth><ContentGenerator /></RequireAuth>} />
      <Route path="/admin/blog" component={() => <RequireAuth><BlogAdmin /></RequireAuth>} />
      <Route path="/admin/sites" component={() => <RequireAuth><Sites /></RequireAuth>} />
      <Route path="/admin/sites/:tenantId" component={SiteEditor} />

      {/* Blog public routes — language-prefixed */}
      <Route path="/blog" component={BlogIndex} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/:lang/blog" component={BlogIndex} />
      <Route path="/:lang/blog/:slug" component={BlogPost} />

      <Route path="/:lang" component={Landing} />

      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function TenantMetadata() {
  const { data: tenant } = useQuery<TenantType>({
    queryKey: ['/api/tenant'],
  });

  useEffect(() => {
    if (tenant) {
      if (tenant.universityName) {
        document.title = tenant.universityName;
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
          ogTitle.setAttribute('content', tenant.universityName);
        }
      }

      if (tenant.faviconUrl) {
        const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (link) {
          link.href = tenant.faviconUrl;
        }
      }
    }
  }, [tenant]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <I18nProvider>
          <TenantMetadata />
          <Toaster />
          <Router />
        </I18nProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
