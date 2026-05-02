import { Link, useLocation } from "wouter";
import { Home, Ticket, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full border-t bg-background md:hidden">
      <div className="grid h-16 grid-cols-3 items-center justify-center">
        <Link href="/" className={cn("flex flex-col items-center justify-center gap-1", location === "/" ? "text-primary" : "text-muted-foreground")}>
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-medium">Deals</span>
        </Link>
        <Link href="/bookings" className={cn("flex flex-col items-center justify-center gap-1", location.startsWith("/bookings") ? "text-primary" : "text-muted-foreground")}>
          <Ticket className="h-5 w-5" />
          <span className="text-[10px] font-medium">Bookings</span>
        </Link>
        <Link href="/profile" className={cn("flex flex-col items-center justify-center gap-1", location.startsWith("/profile") ? "text-primary" : "text-muted-foreground")}>
          <User className="h-5 w-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </div>
    </div>
  );
}
