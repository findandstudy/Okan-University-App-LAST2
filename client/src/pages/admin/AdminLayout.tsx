import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  LayoutDashboard,
  Building,
  Palette,
  LayoutList,
  Image,
  Settings,
  LogOut,
  ExternalLink,
  FormInput,
  MessageSquareQuote,
  HelpCircle,
  Sparkles,
  BadgeCheck,
  PanelBottom,
  Search,
  ChevronDown,
  Globe,
  Wrench,
  GraduationCap,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import type { Tenant } from '@shared/schema';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

const menuGroups: NavGroup[] = [
  {
    title: 'Website Content',
    icon: Globe,
    items: [
      { title: 'Hero Content', url: '/admin/hero', icon: Sparkles },
      { title: 'Why Choose Us', url: '/admin/why-choose-us', icon: BadgeCheck },
      { title: 'Testimonials', url: '/admin/testimonials', icon: MessageSquareQuote },
      { title: 'FAQ', url: '/admin/faq', icon: HelpCircle },
      { title: 'Page Sections', url: '/admin/sections', icon: LayoutList },
      { title: 'Footer', url: '/admin/footer', icon: PanelBottom },
    ],
  },
  {
    title: 'Settings',
    icon: Settings,
    items: [
      { title: 'Tenant', url: '/admin/tenant', icon: Building },
      { title: 'Theme', url: '/admin/theme', icon: Palette },
      { title: 'SEO Settings', url: '/admin/seo', icon: Search },
      { title: 'Contact Form', url: '/admin/contact-form', icon: FormInput },
    ],
  },
  {
    title: 'System',
    icon: Wrench,
    items: [
      { title: 'Sites Hub', url: '/admin/sites', icon: LayoutGrid },
      { title: 'Media', url: '/admin/media', icon: Image },
    ],
  },
];

const STORAGE_KEY = 'admin-sidebar-expanded-groups';

function getInitialExpandedState(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return menuGroups.reduce((acc, group) => {
    acc[group.title] = true;
    return acc;
  }, {} as Record<string, boolean>);
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(getInitialExpandedState);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['/api/tenant'],
  });

  useEffect(() => {
    const isAuth = localStorage.getItem('adminAuth');
    if (!isAuth && location !== '/admin/login') {
      navigate('/admin/login');
    }
  }, [location, navigate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedGroups));
  }, [expandedGroups]);

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    navigate('/admin/login');
  };

  const toggleGroup = (groupTitle: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle],
    }));
  };

  const isItemActive = (url: string) => location === url;

  const isGroupActive = (group: NavGroup) => {
    return group.items.some(item => location === item.url);
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
                  className="h-[3.125rem] w-auto max-w-[175px] object-contain"
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

          <SidebarContent className="overflow-y-auto">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === '/admin'}>
                      <Link href="/admin">
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {menuGroups.map((group) => (
              <Collapsible
                key={group.title}
                open={expandedGroups[group.title]}
                onOpenChange={() => toggleGroup(group.title)}
              >
                <SidebarGroup>
                  <CollapsibleTrigger asChild>
                    <button
                      className={`flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                        isGroupActive(group) ? 'text-foreground' : ''
                      }`}
                      data-testid={`button-group-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-center gap-2">
                        <group.icon className="h-4 w-4" />
                        <span>{group.title}</span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          expandedGroups[group.title] ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((item) => (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={isItemActive(item.url)}>
                              <Link href={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            ))}
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
              <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
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
