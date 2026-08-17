import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FileText,
  Image,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Package,
  Settings2,
  Store,
  Users,
  WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation } from "wouter";

type NavItem = { label: string; path: string; icon: LucideIcon; badge?: string };

const groups: Array<{ label?: string; items: NavItem[] }> = [
  { items: [{ label: "Overview", path: "/app/dashboard", icon: LayoutDashboard }] },
  {
    label: "Create",
    items: [
      { label: "Storefront", path: "/app/store", icon: Store },
      { label: "Pages", path: "/app/pages", icon: FileText },
      { label: "Links", path: "/app/links", icon: Link2 },
      { label: "Media", path: "/app/media", icon: Image },
      { label: "Appearance", path: "/app/appearance", icon: WandSparkles },
    ],
  },
  {
    label: "Sell",
    items: [
      { label: "Products", path: "/app/products", icon: Package },
      { label: "Courses", path: "/app/courses", icon: BookOpen },
      { label: "Bookings", path: "/app/bookings", icon: CalendarDays },
      { label: "Memberships", path: "/app/memberships", icon: CreditCard },
    ],
  },
  {
    label: "Audience",
    items: [
      { label: "Customers", path: "/app/customers", icon: Users },
      { label: "Email", path: "/app/email", icon: Mail },
      { label: "Analytics", path: "/app/analytics", icon: BarChart3 },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  if (loading) return <div className="min-h-screen bg-[#f7f7f3]" />;
  if (!user) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#f7f7f3] px-6">
        <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-10 shadow-[0_25px_70px_-35px_rgba(15,23,42,.28)]">
          <div className="mb-8 flex items-center gap-3 text-slate-950"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 font-semibold text-white">C</span><span className="text-xl font-semibold tracking-[-.04em]">CreaDock</span></div>
          <h1 className="text-3xl font-semibold tracking-[-.055em] text-slate-950">Your business, in one calm workspace.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-500">Sign in to manage your storefront, offers, audience, and sales.</p>
          <Button className="mt-8 h-11 w-full bg-slate-950 text-white hover:bg-slate-800" onClick={() => startLogin()}>Sign in to CreaDock</Button>
        </section>
      </main>
    );
  }

  const activeLabel = groups.flatMap((group) => group.items).find((item) => item.path === location)?.label ?? "CreaDock";
  return (
    <SidebarProvider>
      <Sidebar className="border-r border-slate-200 bg-[#fbfbf9]">
        <SidebarHeader className="px-3 py-5">
          <button className="flex w-full items-center gap-3 px-2 text-left" onClick={() => setLocation("/app/dashboard")}>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-semibold text-white">C</span>
            <span className="text-[17px] font-semibold tracking-[-.045em] text-slate-950">CreaDock</span>
          </button>
        </SidebarHeader>
        <SidebarContent className="px-3 pb-5">
          {groups.map((group) => (
            <div className="mb-5" key={group.label ?? "home"}>
              {group.label ? <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[.13em] text-slate-400">{group.label}</p> : null}
              <SidebarMenu>
                {group.items.map((item) => {
                  const selected = location === item.path;
                  return <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton isActive={selected} onClick={() => setLocation(item.path)} className={`h-9.5 rounded-lg px-2.5 text-[13px] ${selected ? "bg-slate-950 font-medium text-white hover:bg-slate-900 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
                      <item.icon className="h-4 w-4" /> <span>{item.label}</span>{item.badge ? <span className="ml-auto text-[10px]">{item.badge}</span> : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>;
                })}
              </SidebarMenu>
            </div>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-slate-200 px-3 pb-4 pt-3">
          <button onClick={() => setLocation("/app/settings")} className={`mb-2 flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] ${location === "/app/settings" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}><Settings2 className="h-4 w-4" />Settings</button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-slate-100"><Avatar className="h-7 w-7 border border-slate-200"><AvatarFallback className="bg-slate-100 text-[10px] font-semibold text-slate-700">{user.name?.slice(0, 2).toUpperCase() || "CD"}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-800">{user.name || "Creator"}</span><span className="block truncate text-[11px] text-slate-400">Creator account</span></span><ChevronDown className="h-3.5 w-3.5 text-slate-400" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={() => setLocation("/app/help")}><CircleHelp className="mr-2 h-4 w-4" />Help center</DropdownMenuItem><DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-[#f7f7f3]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-[#f7f7f3]/90 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3"><SidebarTrigger className="md:hidden" /><span className="text-sm font-medium text-slate-700">{activeLabel}</span></div>
          <button className="hidden text-xs text-slate-500 transition-colors hover:text-slate-950 sm:block" onClick={() => setLocation("/app/help")}>Need help?</button>
        </header>
        <main className="min-h-[calc(100vh-4rem)] px-4 py-6 md:px-8 md:py-9">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
