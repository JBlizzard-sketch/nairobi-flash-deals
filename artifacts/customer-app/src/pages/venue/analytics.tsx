import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useGetVenueAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  Star,
  Ticket,
  DollarSign,
  ArrowLeft,
  BarChart3,
  Users,
} from "lucide-react";

const TIER_COLOR = "hsl(var(--primary))";

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  prefix = "",
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  prefix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}:{" "}
          <span className="font-medium text-foreground">
            {prefix}
            {typeof p.value === "number" && prefix
              ? p.value.toLocaleString()
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function VenueAnalytics() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const venueId = (user as { managedVenueId?: number } | undefined)?.managedVenueId;
  const { data: analytics, isLoading } = useGetVenueAnalytics(venueId ?? 0, {
    query: { enabled: !!venueId },
  });

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;
  if (user && (user as { role?: string }).role !== "venue_manager")
    return <Redirect to="/" />;

  const ratingDist = analytics?.ratingDistribution
    ? [5, 4, 3, 2, 1].map((score) => ({
        score: `${score}★`,
        count: (analytics.ratingDistribution as Record<number, number>)[score] ?? 0,
      }))
    : [];

  const totalRatingCount = ratingDist.reduce((s, r) => s + r.count, 0);

  return (
    <div className="container py-6 pb-24 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/venue")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">This month's performance</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : analytics ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Revenue This Month"
              value={`KES ${analytics.totalRevenue.toLocaleString()}`}
              sub={`KES ${analytics.commissionEarned.toLocaleString()} platform fee`}
              icon={DollarSign}
              color="text-green-600"
            />
            <KpiCard
              label="Bookings This Month"
              value={String(analytics.totalBookings)}
              sub="confirmed + completed"
              icon={Ticket}
              color="text-primary"
            />
            <KpiCard
              label="Average Fill Rate"
              value={`${Number(analytics.fillRate).toFixed(0)}%`}
              sub="across all deals"
              icon={TrendingUp}
              color="text-blue-600"
            />
            <KpiCard
              label="Guest Rating"
              value={`${analytics.averageRating.toFixed(1)} ★`}
              sub={`${analytics.totalReviews} review${analytics.totalReviews !== 1 ? "s" : ""}`}
              icon={Star}
              color="text-amber-500"
            />
          </div>

          {/* 7-day bookings bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Daily Bookings — Last 7 Days
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {analytics.dailyBookings.every((d) => d.bookings === 0) ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  No bookings in this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={analytics.dailyBookings} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="bookings" name="Bookings" fill={TIER_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* 7-day revenue area chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Revenue Trend — Last 7 Days
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {analytics.dailyBookings.every((d) => d.revenue === 0) ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  No revenue in this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={analytics.dailyBookings} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                      }
                    />
                    <Tooltip
                      content={<CustomTooltip prefix="KES " />}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke={TIER_COLOR}
                      strokeWidth={2}
                      fill="url(#revenueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Rating distribution */}
          {totalRatingCount > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  Rating Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {ratingDist.map((r) => (
                  <div key={r.score} className="flex items-center gap-3">
                    <span className="text-xs font-mono w-6 text-right shrink-0">{r.score}</span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-amber-400 transition-all"
                        style={{
                          width: totalRatingCount > 0 ? `${(r.count / totalRatingCount) * 100}%` : "0%",
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-4 shrink-0">{r.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Deal performance table */}
          {analytics.dealPerformance.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  Deal Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {analytics.dealPerformance.map((deal) => (
                  <div key={deal.id} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{deal.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {deal.category} · {deal.bookingCount} booking{deal.bookingCount !== 1 ? "s" : ""} · {deal.viewCount} views
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-xs shrink-0 ${
                          deal.fillRate >= 75
                            ? "bg-green-100 text-green-800"
                            : deal.fillRate >= 40
                              ? "bg-amber-100 text-amber-800"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {deal.fillRate.toFixed(0)}% filled
                      </Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(deal.fillRate, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs font-medium">
                      KES {deal.revenue.toLocaleString()} revenue · {deal.bookedSlots}/{deal.totalSlots} slots
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          No analytics data available
        </div>
      )}
    </div>
  );
}
