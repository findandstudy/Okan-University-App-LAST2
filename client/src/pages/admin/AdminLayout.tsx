import { useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  Building,
  Palette,
  LayoutList,
  Image,
  GraduationCap,
  FileText,
  Settings,
  Mail,
  Activity,
  LogOut,
  ExternalLink,
  FormInput,
  MessageSquareQuote,
  HelpCircle,
  Sparkles,
  BadgeCheck,
  Phone,
  PanelBottom,
} from 'lucide-react';
import type { Tenant } from '@shared/schema';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Tenant', url: '/admin/tenant', icon: Building },
  { title: 'Theme', url: '/admin/theme', icon: Palette },
  { title: 'Hero Content', url: '/admin/hero', icon: Sparkles },
  { title: 'Why Choose Us', url: '/admin/why-choose-us', icon: BadgeCheck },
  { title: 'Programs', url: '/admin/programs', icon: GraduationCap },
  { title: 'Testimonials', url: '/admin/testimonials', icon: MessageSquareQuote },
  { title: 'FAQ', url: '/admin/faq', icon: HelpCircle },
  { title: 'Sections', url: '/admin/sections', icon: LayoutList },
  { title: 'Contact Form', url: '/admin/contact-form', icon: FormInput },
  { title: 'Contact Info', url: '/admin/contact-info', icon: Phone },
  { title: 'Footer', url: '/admin/footer', icon: PanelBottom },
  { title: 'Applications', url: '/admin/applications', icon: FileText },
  { title: 'Integrations', url: '/admin/integrations', icon: Settings },
  { title: 'Email', url: '/admin/email', icon: Mail },
  { title: 'Logs', url: '/admin/logs', icon: Activity },
  { title: 'Media', url: '/admin/media', icon: Image },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  useEffect(() => {
    const isAuth = localStorage.getItem('adminAuth');
    if (!isAuth && location !== '/admin/login') {
      navigate('/admin/login');
    }
  }, [location, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    navigate('/admin/login');
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              {tenant?.logoUrl ? (
                <img 
                  src={tenant.logoUrl} 
                  alt={tenant?.universityName || 'Logo'} 
                  className="h-8 w-auto max-w-[120px] object-contain"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">Admin Panel</p>
                <p className="text-xs text-muted-foreground truncate" data-testid="text-sidebar-university-name">
                  {tenant?.universityName || 'University'}
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location === item.url}>
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t p-4">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">AD</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Admin User</p>
                <p className="text-xs text-muted-foreground truncate">admin@okanuniversity.app</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href="/" className="flex-1">
                <Button variant="outline" size="sm" className="w-full gap-1">
                  <ExternalLink className="h-3 w-3" />
                  View Site
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="h-14 border-b flex items-center px-4 gap-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex-1" />
          </header>

          <main className="flex-1 overflow-auto bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
