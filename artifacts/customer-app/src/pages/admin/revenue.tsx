import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useListAdminBookings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, DollarSign, Percent, Building2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

export default function AdminRevenue() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data, isLoading } = useListAdminBookings({ limit: 500, status: "confirmed" });
  const { data: checkedIn } = useListAdminBookings({ limit: 500, status: "checked_in" });

  if (authLoading) return null;
  if (!isAuthenticated || (user as { role?: string })?.role !== "admin") {
    return <Redirect to="/" />;
  }

  const allBookings = [
    ...(data?.data ?? []),
    ...(checkedIn?.data ?? []),
  ];

  const totalRevenue = allBookings.reduce((s, b) => s + parseFloat(b.totalAmount ?? "0"), 0);
  const DEFAULT_COMMISSION = 0.12;
  const totalCommission = allBookings.reduce((s, b) => {
    const rate = (b.venue as { commissionRate?: string | null } | undefined)?.commissionRate;
    const r = rate ? parseFloat(rate) : DEFAULT_COMMISSION;
    return s + parseFloat(b.totalAmount ?? "0") * r;
  }, 0);

  const byVenue: Record<string, { name: string; revenue: number; commission: number; count: number }> = {};
  for (const b of allBookings) {
    const venueName = b.venue?.name ?? "Unknown";
    const venueId = String(b.venueId ?? venueName);
    if (!byVenue[venueId]) byVenue[venueId] = { name: venueName, revenue: 0, commission: 0, count: 0 };
    const rate = (b.venue as { commissionRate?: string | null } | undefined)?.commissionRate;
    const r = rate ? parseFloat(rate) : DEFAULT_COMMISSION;
    const amt = parseFloat(b.totalAmount ?? "0");
    byVenue[venueId].revenue += amt;
    byVenue[venueId].commission += amt * r;
    byVenue[venueId].count += 1;
  }
  const venueRows = Object.values(byVenue).sort((a, b) => b.commission - a.commission);

  const today = startOfDay(new Date());
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(today, 6 - i);
    const dayStart = day.getTime();
    const dayEnd = dayStart + 86_400_000;
    const dayBookings = allBookings.filter((b) => {
      const t = new Date(b.createdAt).getTime();
      return t >= dayStart && t < dayEnd;
    });
    const rev = dayBookings.reduce((s, b) => s + parseFloat(b.totalAmount ?? "0"), 0);
    const comm = dayBookings.reduce((s, b) => {
      const rate = (b.venue as { commissionRate?: string | null } | undefined)?.commissionRate;
      const r = rate ? parseFloat(rate) : DEFAULT_COMMISSION;
      return s + parseFloat(b.totalAmount ?? "0") * r;
    }, 0);
    return { date: format(day, "MMM d"), revenue: Math.round(rev), commission: Math.round(comm) };
  });

  return (
    <div className="container py-6 pb-24 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue & Commissions</h1>
          <p className="text-muted-foreground text-sm">Platform earnings overview</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: DollarSign, label: "Total GMV", value: `KES ${Math.round(totalRevenue).toLocaleString()}`, color: "text-blue-600" },
              { icon: Percent, label: "Commission Earned", value: `KES ${Math.round(totalCommission).toLocaleString()}`, color: "text-green-600" },
              { icon: TrendingUp, label: "Avg Booking Value", value: allBookings.length ? `KES ${Math.round(totalRevenue / allBookings.length).toLocaleString()}` : "—", color: "text-purple-600" },
              { icon: Building2, label: "Active Venues", value: Object.keys(byVenue).length, color: "text-orange-500" },
            ].map(({ icon: Icon, label, value, color }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <Icon className={`h-5 w-5 ${color} mb-2`} />
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">7-Day Commission Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`KES ${v.toLocaleString()}`, ""]} />
                  <Bar dataKey="commission" name="Commission" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">By Venue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {venueRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No revenue data yet.</p>
                ) : venueRows.map((row) => (
                  <div key={row.name} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-sm">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.count} booking{row.count !== 1 ? "s" : ""} · GMV KES {Math.round(row.revenue).toLocaleString()}</p>
                    </div>
                    <Badge variant="secondary" className="text-green-700 bg-green-100 border-0 shrink-0">
                      KES {Math.round(row.commission).toLocaleString()}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
