import { useLocation } from "wouter";
import { useListDeals, useGetVenue, useGetVenueAnalytics, useListBookings, useCancelDeal, useCreateDeal, usePublishDeal, getListDealsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, Ticket, Plus, Clock, BarChart3, ArrowRight, ScanLine, Copy, XCircle } from "lucide-react";
import { differenceInSeconds, format } from "date-fns";
import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
  const qc = useQueryClient();
  const cancelDeal = useCancelDeal();
  const createDeal = useCreateDeal();

  const publishDeal = usePublishDeal();

  const handlePublishDeal = useCallback((dealId: number) => {
    publishDeal.mutate({ id: dealId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListDealsQueryKey() }),
    });
  }, [publishDeal, qc]);

  const handleCancelDeal = useCallback((dealId: number) => {
    if (!confirm("Cancel this deal? Active bookings will be notified.")) return;
    cancelDeal.mutate({ id: dealId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListDealsQueryKey() }),
    });
  }, [cancelDeal, qc]);

  const handleDuplicateDeal = useCallback((deal: { title: string; description?: string | null; category: string; originalPrice: string; dealPrice: string; discountPercent: number; totalSlots: number }) => {
    if (!venueId) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);
    const end = new Date(tomorrow);
    end.setHours(17, 0, 0, 0);
    createDeal.mutate({
      data: {
        venueId,
        title: `${deal.title} (copy)`,
        description: deal.description ?? "",
        category: deal.category as import("@workspace/api-client-react").DealCategory,
        originalPrice: deal.originalPrice,
        dealPrice: deal.dealPrice,
        discountPercent: deal.discountPercent,
        totalSlots: deal.totalSlots,
        startsAt: tomorrow.toISOString(),
        endsAt: end.toISOString(),
        isStanding: false,
      }
    }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListDealsQueryKey() }),
    });
  }, [createDeal, venueId, qc]);

  const { data: venueData } = useGetVenue(venueId ?? 0, { query: { enabled: !!venueId } });
  const { data: analyticsData } = useGetVenueAnalytics(venueId ?? 0, { query: { enabled: !!venueId } });
  const { data: dealsData, isLoading: dealsLoading } = useListDeals(
    { venueId: venueId ?? 0, limit: 10 },
    { query: { enabled: !!venueId } }
  );
  const { data: draftDealsData } = useListDeals(
    { venueId: venueId ?? 0, status: "draft" as import("@workspace/api-client-react").DealStatus, limit: 5 },
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

  const venueStatus = (venue as { status?: string } | undefined)?.status;

  return (
    <div className="container py-6 pb-24 space-y-6">
      {/* Pending approval banner */}
      {venueStatus === "pending_approval" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <p className="font-semibold text-amber-900 dark:text-amber-400">Pending approval</p>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-500">Your venue is under review. You can prepare while you wait:</p>
          <ul className="space-y-1.5 text-sm">
            {[
              { done: !!venue?.name, label: "Venue name set" },
              { done: !!venue?.description, label: "Description added" },
              { done: !!venue?.coverImage, label: "Cover image uploaded" },
              { done: !!venue?.address, label: "Address filled in" },
            ].map((item) => (
              <li key={item.label} className={`flex items-center gap-2 ${item.done ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-500"}`}>
                <span>{item.done ? "✓" : "○"}</span> {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{venue?.name ?? "My Venue"}</h1>
          <p className="text-muted-foreground text-sm capitalize">{venue?.neighborhood?.replace(/_/g, " ")} · {venue?.category}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation("/venue/checkin")}>
            <ScanLine className="h-4 w-4 mr-1.5" /> Check In
          </Button>
          <Button onClick={() => setLocation("/venue/post-deal")}>
            <Plus className="h-4 w-4 mr-2" /> Post Deal
          </Button>
        </div>
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
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{deal.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{deal.category} · -{deal.discountPercent}%</p>
                      </div>
                      <CountdownBadge endsAt={deal.endsAt} />
                    </div>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => handleDuplicateDeal(deal)}
                        disabled={createDeal.isPending}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                        title="Duplicate deal for tomorrow"
                      >
                        <Copy className="h-3 w-3" /> Duplicate
                      </button>
                      {deal.status === "live" && (
                        <button
                          type="button"
                          onClick={() => handleCancelDeal(deal.id)}
                          disabled={cancelDeal.isPending}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                          title="Cancel this deal"
                        >
                          <XCircle className="h-3 w-3" /> Cancel
                        </button>
                      )}
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
          {(() => {
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const todayBookings = bookingsData.data.filter((b) => new Date(b.createdAt) >= todayStart);
            return todayBookings.length > 0 ? (
              <div className="mb-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <p className="text-sm"><strong className="text-primary">{todayBookings.length}</strong> new booking{todayBookings.length !== 1 ? "s" : ""} today</p>
              </div>
            ) : null;
          })()}
          <div className="space-y-2">
            {bookingsData.data.slice(0, 3).map((b) => {
              const isToday = new Date(b.createdAt) >= (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
              return (
              <div key={b.id} className={`flex items-center justify-between p-3 border rounded-lg ${isToday ? "border-primary/30 bg-primary/3" : ""}`}>
                <div>
                  <p className="font-mono text-sm font-bold">{b.confirmationCode}</p>
                  <p className="text-xs text-muted-foreground">{(b as { deal?: { title?: string } }).deal?.title ?? "Deal"} · {b.slots} slot{b.slots > 1 ? "s" : ""}</p>
                  {isToday && <span className="text-[10px] text-primary font-semibold uppercase tracking-wide">Today</span>}
                </div>
                <Badge variant={b.status === "confirmed" ? "default" : b.status === "checked_in" ? "secondary" : "outline"} className="text-[10px] uppercase">
                  {b.status.replace(/_/g, " ")}
                </Badge>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
