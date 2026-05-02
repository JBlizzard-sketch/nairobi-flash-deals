import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { User, Bell, LogIn } from "lucide-react";

export function Header() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tighter text-primary">NFD.</span>
        </Link>
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
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
