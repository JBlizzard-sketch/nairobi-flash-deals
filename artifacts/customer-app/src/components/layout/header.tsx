import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { User, LayoutDashboard, ShieldCheck } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

export function Header() {
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const role = (user as { role?: string } | undefined)?.role;
  const isVenueManager = role === "venue_manager";
  const isAdmin = role === "admin";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tighter text-primary">NFD.</span>
          {isAdmin && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border rounded px-1 py-0.5 hidden sm:inline">
              Admin
            </span>
          )}
        </Link>
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`text-sm font-medium flex items-center gap-1 ${location.startsWith("/admin") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              )}
              {isVenueManager && (
                <Link
                  href="/venue"
                  className={`text-sm font-medium ${location.startsWith("/venue") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="hidden sm:inline">Venue</span>
                  <LayoutDashboard className="h-5 w-5 sm:hidden" />
                </Link>
              )}
              <NotificationBell />
              <Link href="/profile" className="text-muted-foreground hover:text-foreground">
                <User className="h-5 w-5" />
                <span className="sr-only">Profile</span>
              </Link>
            </>
          ) : (
            <Link href="/auth" className="text-sm font-medium text-primary hover:underline">
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
