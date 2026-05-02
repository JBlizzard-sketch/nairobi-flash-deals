import { Link, useLocation } from "wouter";
import { Home, Ticket, User, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isVenueManager = user && (user as { role?: string }).role === "venue_manager";

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full border-t bg-background md:hidden">
      <div className={cn("grid h-16 items-center justify-center", isVenueManager ? "grid-cols-4" : "grid-cols-3")}>
        <Link href="/" className={cn("flex flex-col items-center justify-center gap-1", location === "/" ? "text-primary" : "text-muted-foreground")}>
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-medium">Deals</span>
        </Link>
        <Link href="/bookings" className={cn("flex flex-col items-center justify-center gap-1", location.startsWith("/bookings") ? "text-primary" : "text-muted-foreground")}>
          <Ticket className="h-5 w-5" />
          <span className="text-[10px] font-medium">Bookings</span>
        </Link>
        {isVenueManager && (
          <Link href="/venue" className={cn("flex flex-col items-center justify-center gap-1", location.startsWith("/venue") ? "text-primary" : "text-muted-foreground")}>
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px] font-medium">Venue</span>
          </Link>
        )}
        <Link href="/profile" className={cn("flex flex-col items-center justify-center gap-1", location.startsWith("/profile") ? "text-primary" : "text-muted-foreground")}>
          <User className="h-5 w-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </div>
    </div>
  );
}
