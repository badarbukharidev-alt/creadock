import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminPanel from "./pages/AdminPanel";
import CreatorDashboard from "./pages/CreatorDashboard";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import PublicStore from "./pages/PublicStore";
import { Route, Switch } from "wouter";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/app/:section" component={CreatorDashboard} /><Route path="/app" component={CreatorDashboard} /><Route path="/c/:handle" component={PublicStore} /><Route path="/admin" component={AdminPanel} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
