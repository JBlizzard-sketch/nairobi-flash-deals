import { useLocation } from "wouter";
import { useListDeals, useGetVenue, useGetVenueAnalytics, useListBookings } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, Ticket, Plus, Clock, BarChart3, ArrowRight } from "lucide-react";
import { differenceInSeconds, format } from "date-fns";
import { useState, useEffect } from "react";

function CountdownBadge({ endsAt }: { endsAt: string }) {
  const [secs, setSecs] = useState(() => Math.max(0, differenceInSeconds(new Date(endsAt), new Date())));
  useEffect(() => {
    const t = setInterval(() => setSecs(Math.max(0, differenceInSeconds(new Date(endsAt), new Date()))), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (secs <= 0) return <Badge variant="destructive">Expired</Badge>;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return (
    <Badge variant="secondary" className="flex items-center gap-1 font-mono">
      <Clock className="h-3 w-3" /> {h > 0 ? `${h}h ${m}m` : `${m}m`} left
    </Badge>
  );
}

export default function VenueDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const venueId = (user as { managedVenueId?: number } | undefined)?.managedVenueId;

  const { data: venueData } = useGetVenue(venueId ?? 0, { query: { enabled: !!venueId } });
  const { data: analyticsData } = useGetVenueAnalytics(venueId ?? 0, { query: { enabled: !!venueId } });
  const { data: dealsData, isLoading: dealsLoading } = useListDeals(
    { venueId: venueId ?? 0, limit: 10 },
    { query: { enabled: !!venueId } }
  );
  const { data: bookingsData } = useListBookings(
    { venueId: venueId ?? 0, limit: 5 } as Parameters<typeof useListBookings>[0],
    { query: { enabled: !!venueId } }
  );

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;
  if (user && (user as { role?: string }).role !== "venue_manager") return <Redirect to="/" />;

  const venue = venueData;
  const analytics = analyticsData as {
    totalDeals?: number; totalBookings?: number; fillRate?: string;
    totalRevenue?: string; avgDiscount?: number;
  } | undefined;

  const statCards = [
    { label: "Total Bookings", value: analytics?.totalBookings ?? venueData?.totalBookings ?? 0, icon: Ticket, color: "text-primary" },
    { label: "Fill Rate", value: analytics?.fillRate ? `${parseFloat(analytics.fillRate).toFixed(0)}%` : `${venueData?.fillRate ?? 0}%`, icon: TrendingUp, color: "text-green-600" },
    { label: "Total Revenue", value: analytics?.totalRevenue ? `KES ${parseInt(analytics.totalRevenue).toLocaleString()}` : "—", icon: BarChart3, color: "text-blue-600" },
    { label: "Active Today", value: dealsData?.data?.length ?? 0, icon: Users, color: "text-orange-500" },
  ];

  return (
    <div className="container py-6 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{venue?.name ?? "My Venue"}</h1>
          <p className="text-muted-foreground text-sm capitalize">{venue?.neighborhood?.replace(/_/g, " ")} · {venue?.category}</p>
        </div>
        <Button onClick={() => setLocation("/venue/post-deal")}>
          <Plus className="h-4 w-4 mr-2" /> Post Deal
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold">{String(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Live Deals Today</h2>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/venue/bookings")}>
            All bookings <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>

        {dealsLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : dealsData?.data && dealsData.data.length > 0 ? (
          <div className="space-y-3">
            {dealsData.data.map((deal) => {
              const booked = deal.bookedSlots;
              const total = deal.totalSlots;
              const pct = total > 0 ? Math.round((booked / total) * 100) : 0;
              return (
                <Card key={deal.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{deal.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{deal.category} · -{deal.discountPercent}%</p>
                      </div>
                      <CountdownBadge endsAt={deal.endsAt} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{booked} of {total} booked</span>
                        <span className="font-medium text-foreground">{pct}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 space-y-3 border rounded-xl">
            <p className="text-muted-foreground text-sm">No live deals right now</p>
            <Button size="sm" onClick={() => setLocation("/venue/post-deal")}>
              <Plus className="h-4 w-4 mr-1" /> Post your first deal
            </Button>
          </div>
        )}
      </div>

      {bookingsData?.data && bookingsData.data.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Recent Bookings</h2>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/venue/bookings")}>
              See all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          <div className="space-y-2">
            {bookingsData.data.slice(0, 3).map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-mono text-sm font-bold">{b.confirmationCode}</p>
                  <p className="text-xs text-muted-foreground">{(b as { deal?: { title?: string } }).deal?.title ?? "Deal"} · {b.slots} slot{b.slots > 1 ? "s" : ""}</p>
                </div>
                <Badge variant={b.status === "confirmed" ? "default" : b.status === "checked_in" ? "secondary" : "outline"} className="text-[10px] uppercase">
                  {b.status.replace(/_/g, " ")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
