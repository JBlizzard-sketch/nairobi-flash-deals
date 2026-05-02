import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import DealDetail from "@/pages/deal-detail";
import Bookings from "@/pages/bookings";
import Profile from "@/pages/profile";
import Auth from "@/pages/auth";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans">
      <Header />
      <main className="flex-1 w-full relative">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/deals/:id" component={DealDetail} />
          <Route path="/bookings" component={Bookings} />
          <Route path="/profile" component={Profile} />
          <Route path="/auth" component={Auth} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
