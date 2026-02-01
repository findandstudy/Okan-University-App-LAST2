import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import type { Tenant as TenantType } from "@shared/schema";
import Landing from "@/pages/Landing";
import Apply from "@/pages/Apply";
import AdminLogin from "@/pages/admin/AdminLogin";
import Dashboard from "@/pages/admin/Dashboard";
import Tenant from "@/pages/admin/Tenant";
import Theme from "@/pages/admin/Theme";
import Sections from "@/pages/admin/Sections";
import ContactForm from "@/pages/admin/ContactForm";
import Media from "@/pages/admin/Media";
import Programs from "@/pages/admin/Programs";
import Applications from "@/pages/admin/Applications";
import Integrations from "@/pages/admin/Integrations";
import Email from "@/pages/admin/Email";
import Logs from "@/pages/admin/Logs";
import Testimonials from "@/pages/admin/Testimonials";
import FAQ from "@/pages/admin/FAQ";
import HeroContent from "@/pages/admin/HeroContent";
import WhyChooseUs from "@/pages/admin/WhyChooseUs";
import ContactInfo from "@/pages/admin/ContactInfo";
import FooterContent from "@/pages/admin/FooterContent";
import ProgramFilters from "@/pages/admin/ProgramFilters";
import EmbedPrograms from "@/pages/EmbedPrograms";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/apply" component={Apply} />
      
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={Dashboard} />
      <Route path="/admin/tenant" component={Tenant} />
      <Route path="/admin/theme" component={Theme} />
      <Route path="/admin/sections" component={Sections} />
      <Route path="/admin/contact-form" component={ContactForm} />
      <Route path="/admin/media" component={Media} />
      <Route path="/admin/programs" component={Programs} />
      <Route path="/admin/applications" component={Applications} />
      <Route path="/admin/integrations" component={Integrations} />
      <Route path="/admin/email" component={Email} />
      <Route path="/admin/logs" component={Logs} />
      <Route path="/admin/testimonials" component={Testimonials} />
      <Route path="/admin/faq" component={FAQ} />
      <Route path="/admin/hero" component={HeroContent} />
      <Route path="/admin/why-choose-us" component={WhyChooseUs} />
      <Route path="/admin/contact-info" component={ContactInfo} />
      <Route path="/admin/footer" component={FooterContent} />
      <Route path="/admin/program-filters" component={ProgramFilters} />
      
      <Route path="/embed/programs" component={EmbedPrograms} />
      <Route path="/embed/programs/:lang" component={EmbedPrograms} />

      <Route path="/:lang" component={Landing} />
      <Route path="/:lang/apply" component={Apply} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function TenantMetadata() {
  const { data: tenant } = useQuery<TenantType>({
    queryKey: ['/api/tenant'],
  });

  useEffect(() => {
    if (tenant) {
      // Update page title
      if (tenant.universityName) {
        document.title = tenant.universityName;
        // Update OG title meta tag
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
          ogTitle.setAttribute('content', tenant.universityName);
        }
      }
      
      // Update favicon
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
