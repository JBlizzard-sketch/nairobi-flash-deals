import { Switch, Route, Router as WouterRouter } from "wouter";
import { ThemeProvider } from "next-themes";
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
import VenueDashboard from "@/pages/venue/dashboard";
import PostDeal from "@/pages/venue/post-deal";
import VenueBookings from "@/pages/venue/venue-bookings";
import VenueAnalytics from "@/pages/venue/analytics";
import VenueCheckin from "@/pages/venue/checkin";
import NotificationsPage from "@/pages/notifications";
import VenueProfile from "@/pages/venue-profile";
import AdminDashboard from "@/pages/admin/index";
import AdminVenues from "@/pages/admin/venues";
import AdminBookings from "@/pages/admin/bookings";
import AdminUsers from "@/pages/admin/users";
import AdminRevenue from "@/pages/admin/revenue";
import AdminDeals from "@/pages/admin/deals";
import Saved from "@/pages/saved";
import Reviews from "@/pages/reviews";
import Settings from "@/pages/settings";

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
          <Route path="/venue" component={VenueDashboard} />
          <Route path="/venue/post-deal" component={PostDeal} />
          <Route path="/venue/bookings" component={VenueBookings} />
          <Route path="/venue/analytics" component={VenueAnalytics} />
          <Route path="/venue/checkin" component={VenueCheckin} />
          <Route path="/notifications" component={NotificationsPage} />
          <Route path="/saved" component={Saved} />
          <Route path="/reviews" component={Reviews} />
          <Route path="/settings" component={Settings} />
          <Route path="/venues/:id" component={VenueProfile} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/venues" component={AdminVenues} />
          <Route path="/admin/bookings" component={AdminBookings} />
          <Route path="/admin/users" component={AdminUsers} />
          <Route path="/admin/revenue" component={AdminRevenue} />
          <Route path="/admin/deals" component={AdminDeals} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
