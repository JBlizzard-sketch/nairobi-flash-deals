import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useLogout, useGetMyReferralStats } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Phone, Star, Settings, Trophy, Zap, Gift, Copy, Share2, Users, CheckCircle2, Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function PushNotificationCard() {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const handleRequest = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      toast({ title: "Notifications enabled!", description: "You'll get alerts for deals near you." });
    }
  };

  if (permission === "granted") {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Push notifications on</p>
            <p className="text-xs text-muted-foreground">You'll be notified when new deals drop</p>
          </div>
          <Badge variant="secondary" className="ml-auto text-green-700 bg-green-100 border-0">Active</Badge>
        </CardContent>
      </Card>
    );
  }

  if (permission === "denied") return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 flex items-center gap-3">
        <BellOff className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Enable deal alerts</p>
          <p className="text-xs text-muted-foreground">Get notified the moment a deal drops near you</p>
        </div>
        <Button size="sm" onClick={handleRequest} className="shrink-0">Enable</Button>
      </CardContent>
    </Card>
  );
}

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

        <div className="grid grid-cols-4 gap-2 pt-1">
          {[
            { label: "Per booking", pts: "+100" },
            { label: "Check-in",    pts: "+25" },
            { label: "Review",      pts: "+50" },
            { label: "Referral",    pts: "+500" },
          ].map((item) => (
            <div key={item.label} className="bg-muted/60 rounded-lg p-2 text-center">
              <p className="text-primary font-bold text-sm">{item.pts}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ReferralCard({ referralCode, isAuthenticated }: { referralCode?: string | null; isAuthenticated: boolean }) {
  const { toast } = useToast();
  const { data: stats, isLoading } = useGetMyReferralStats({ query: { enabled: isAuthenticated } });

  const shareLink = referralCode
    ? `${window.location.origin}/auth?ref=${referralCode}`
    : null;

  function copyCode() {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode).then(() =>
      toast({ title: "Copied!", description: `Code ${referralCode} copied to clipboard` })
    );
  }

  function shareWhatsApp() {
    if (!shareLink) return;
    const text = encodeURIComponent(
      `Join me on Nairobi Flash Deals — the best last-minute deals at top restaurants, spas & more in Nairobi! 🍽️✨\n\nUse my referral code *${referralCode}* when you sign up and get 150 bonus loyalty points on your first booking:\n${shareLink}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Gift className="h-4 w-4" /> Refer &amp; Earn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Share your code with friends. You get <strong className="text-foreground">500 pts</strong> and they get <strong className="text-foreground">150 pts</strong> on their first booking.
        </p>

        {referralCode ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-lg px-3 py-2.5 font-mono text-lg font-bold tracking-widest text-center text-primary">
              {referralCode}
            </div>
            <Button size="icon" variant="outline" onClick={copyCode} title="Copy code">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Skeleton className="h-12 w-full rounded-lg" />
        )}

        <Button
          className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
          onClick={shareWhatsApp}
          disabled={!shareLink}
        >
          <Share2 className="h-4 w-4" />
          Share via WhatsApp
        </Button>

        {isLoading ? (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40">
            {[
              { label: "Referred",  value: stats.referredCount,   icon: Users },
              { label: "Converted", value: stats.bonusesPaid,     icon: CheckCircle2 },
              { label: "Pts Earned",value: stats.pointsEarned,    icon: Star },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-muted/60 rounded-lg p-2 text-center space-y-1">
                <Icon className="h-4 w-4 text-primary mx-auto" />
                <p className="text-base font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        ) : null}
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
  const referralCode = (user as { referralCode?: string | null }).referralCode;

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

      <ReferralCard referralCode={referralCode} isAuthenticated={isAuthenticated} />

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

      {/* Push notification opt-in */}
      {"Notification" in window && (
        <PushNotificationCard />
      )}

      {/* Quick links */}
      <Card>
        <CardContent className="p-0">
          {[
            { label: "My Reviews", icon: Star, href: "/reviews" },
            { label: "Notifications", icon: Bell, href: "/notifications" },
            { label: "Settings", icon: Settings, href: "/settings" },
          ].map(({ label, icon: Icon, href }) => (
            <button
              key={href}
              type="button"
              onClick={() => setLocation(href)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors border-b last:border-b-0"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{label}</span>
              <span className="ml-auto text-muted-foreground text-xs">›</span>
            </button>
          ))}
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
