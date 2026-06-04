import { Link, useLocation } from "wouter";
import { Home, Ticket, User, LayoutDashboard, BarChart3, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useGetNotificationLog } from "@workspace/api-client-react";

function useUnreadNotifCount() {
  const { isAuthenticated } = useAuth();
  const { data } = useGetNotificationLog({ limit: 20 }, { query: { enabled: isAuthenticated, staleTime: 60_000 } });
  const lastSeen = (() => {
    try { return new Date(localStorage.getItem("nfd_notif_last_seen") ?? 0); } catch { return new Date(0); }
  })();
  return (data?.data ?? []).filter((n) => new Date(n.sentAt) > lastSeen).length;
}

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isVenueManager = user && (user as { role?: string }).role === "venue_manager";
  const unreadCount = useUnreadNotifCount();

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full border-t bg-background md:hidden">
      <div className={cn("grid h-16 items-center justify-center", isVenueManager ? "grid-cols-5" : "grid-cols-4")}>
        <Link href="/" className={cn("flex flex-col items-center justify-center gap-1", location === "/" ? "text-primary" : "text-muted-foreground")}>
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-medium">Deals</span>
        </Link>
        <Link href="/bookings" className={cn("flex flex-col items-center justify-center gap-1", location.startsWith("/bookings") ? "text-primary" : "text-muted-foreground")}>
          <Ticket className="h-5 w-5" />
          <span className="text-[10px] font-medium">Bookings</span>
        </Link>
        {isVenueManager && (
          <Link href="/venue" className={cn("flex flex-col items-center justify-center gap-1", location === "/venue" || location.startsWith("/venue/post-deal") || location.startsWith("/venue/bookings") ? "text-primary" : "text-muted-foreground")}>
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px] font-medium">Venue</span>
          </Link>
        )}
        {isVenueManager && (
          <Link href="/venue/analytics" className={cn("flex flex-col items-center justify-center gap-1", location.startsWith("/venue/analytics") ? "text-primary" : "text-muted-foreground")}>
            <BarChart3 className="h-5 w-5" />
            <span className="text-[10px] font-medium">Analytics</span>
          </Link>
        )}
        {!isVenueManager && (
          <Link href="/saved" className={cn("flex flex-col items-center justify-center gap-1", location.startsWith("/saved") ? "text-rose-500" : "text-muted-foreground")}>
            <Heart className={cn("h-5 w-5", location.startsWith("/saved") && "fill-rose-500")} />
            <span className="text-[10px] font-medium">Saved</span>
          </Link>
        )}
        <Link href="/profile" className={cn("flex flex-col items-center justify-center gap-1 relative", location.startsWith("/profile") ? "text-primary" : "text-muted-foreground")}>
          <div className="relative">
            <User className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </div>
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </div>
    </div>
  );
}
