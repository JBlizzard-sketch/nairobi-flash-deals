import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LogOut, Phone, Star, Settings, Trophy, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

const TIER_CONFIG: Record<LoyaltyTier, { next: LoyaltyTier | null; cap: number; start: number; color: string; emoji: string }> = {
  bronze:   { next: "silver",   cap: 500,  start: 0,    color: "text-amber-700",  emoji: "🥉" },
  silver:   { next: "gold",     cap: 1000, start: 500,  color: "text-slate-400",  emoji: "🥈" },
  gold:     { next: "platinum", cap: 2000, start: 1000, color: "text-yellow-500", emoji: "🥇" },
  platinum: { next: null,       cap: 2000, start: 2000, color: "text-cyan-400",   emoji: "💎" },
};

function LoyaltyCard({ points, tier }: { points: number; tier: LoyaltyTier }) {
  const config = TIER_CONFIG[tier];
  const isPlatinum = tier === "platinum";
  const progress = isPlatinum
    ? 100
    : Math.min(100, Math.round(((points - config.start) / (config.cap - config.start)) * 100));
  const pointsToNext = isPlatinum ? 0 : config.cap - points;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Trophy className="h-4 w-4" /> Loyalty Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <div className={`text-3xl font-bold capitalize flex items-center gap-2 ${config.color}`}>
              <span>{config.emoji}</span>
              <span>{tier}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isPlatinum ? "Maximum tier reached" : `${pointsToNext} pts to ${config.next}`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{points.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Points</p>
          </div>
        </div>

        {!isPlatinum && (
          <div className="space-y-1.5">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="capitalize">{tier}</span>
              <span className="capitalize">{config.next}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: "Per booking", pts: "+100" },
            { label: "Check-in",    pts: "+25" },
            { label: "Review",      pts: "+50" },
          ].map((item) => (
            <div key={item.label} className="bg-muted/60 rounded-lg p-2 text-center">
              <p className="text-primary font-bold text-sm">{item.pts}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const { user, isAuthenticated, isLoading, logout: clearAuth } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const logoutMutation = useLogout();

  if (isLoading) return null;
  if (!isAuthenticated || !user) return <Redirect to="/auth" />;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuth();
        toast({ title: "Logged out" });
        setLocation("/");
      },
    });
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "U";

  const tier = (user.loyaltyTier ?? "bronze") as LoyaltyTier;
  const points = user.loyaltyPoints ?? 0;

  return (
    <div className="container py-6 space-y-6 min-h-screen pb-24">
      <div className="flex items-center gap-4 mb-2">
        <Avatar className="h-20 w-20 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
            <Phone className="h-3.5 w-3.5" /> {user.phone || "No phone"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Member since {new Date(user.createdAt).getFullYear()}
          </p>
        </div>
      </div>

      <LoyaltyCard points={points} tier={tier} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Settings className="h-4 w-4" /> Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Subscribed Categories</p>
            <div className="flex flex-wrap gap-2">
              {user.subscriptionCategories?.length > 0 ? (
                user.subscriptionCategories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="capitalize">
                    {cat}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No preferences set</span>
              )}
            </div>
          </div>
          {user.neighborhoodPref && (
            <div>
              <p className="text-sm font-medium mb-1">Preferred Area</p>
              <p className="text-sm text-muted-foreground capitalize">
                {user.neighborhoodPref.replace(/_/g, " ")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Earn more points</p>
              <p className="text-xs text-muted-foreground">Book deals, check in, and leave reviews to climb the tiers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        className="w-full"
        onClick={handleLogout}
        disabled={logoutMutation.isPending}
      >
        <LogOut className="h-4 w-4 mr-2" />
        {logoutMutation.isPending ? "Logging out..." : "Log Out"}
      </Button>
    </div>
  );
}
