import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminPanel from "./pages/AdminPanel";
import AdminSecurityLog from "./pages/AdminSecurityLog";
import AdminEmailLog from "./pages/AdminEmailLog";
import AdminOperations from "./pages/AdminOperations";
import AdminSessions from "./pages/AdminSessions";
import AdminReports from "./pages/AdminReports";
import AdminFiles from "./pages/AdminFiles";
import AdminSettings from "./pages/AdminSettings";
import AccountSecurity from "./pages/AccountSecurity";
import AuthPage from "./pages/AuthPage";
import CreatorDashboard from "./pages/CreatorDashboard";
import CustomerPortal from "./pages/CustomerPortal";
import CustomerCourse from "./pages/CustomerCourse";
import AccountCommunity from "./pages/AccountCommunity";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import PublicStore from "./pages/PublicStore";
import PublicCreatorPage from "./pages/PublicCreatorPage";
import PublicProductPage from "./pages/PublicProductPage";
import PublicBundlePage from "./pages/PublicBundlePage";
import { Route, Switch } from "wouter";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/login" component={AuthPage} /><Route path="/signup" component={AuthPage} /><Route path="/verify-email" component={AuthPage} /><Route path="/forgot-password" component={AuthPage} /><Route path="/reset-password" component={AuthPage} /><Route path="/account/community" component={AccountCommunity} /><Route path="/account/course/:id" component={CustomerCourse} /><Route path="/account/security" component={AccountSecurity} /><Route path="/account" component={CustomerPortal} /><Route path="/app/:section" component={CreatorDashboard} /><Route path="/app" component={CreatorDashboard} /><Route path="/c/:handle/p/:slug" component={PublicProductPage} /><Route path="/c/:handle/b/:slug" component={PublicBundlePage} /><Route path="/c/:handle/:slug" component={PublicCreatorPage} /><Route path="/c/:handle" component={PublicStore} /><Route path="/admin/settings" component={AdminSettings} /><Route path="/admin/files" component={AdminFiles} /><Route path="/admin/reports" component={AdminReports} /><Route path="/admin/sessions" component={AdminSessions} /><Route path="/admin/operations" component={AdminOperations} /><Route path="/admin/email" component={AdminEmailLog} /><Route path="/admin/security" component={AdminSecurityLog} /><Route path="/admin" component={AdminPanel} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
