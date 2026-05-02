import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useGetAdminStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Building2,
  Ticket,
  Users,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Star,
  ArrowRight,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  suspended: "bg-red-100 text-red-800",
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight">{String(value)}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = useGetAdminStats({ query: { enabled: isAuthenticated && (user as { role?: string } | undefined)?.role === "admin" } });

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;
  if ((user as { role?: string } | undefined)?.role !== "admin") return <Redirect to="/" />;

  return (
    <div className="container py-6 pb-24 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground text-sm">Nairobi Flash Deals · Admin</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i=><Skeleton key={i} className="h-24 rounded-xl"/>)}</div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : stats ? (
        <>
          {/* KPI cards — row 1: revenue */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Month Revenue" value={`KES ${stats.bookings.monthRevenue.toLocaleString()}`} sub={`KES ${stats.bookings.monthCommission.toLocaleString()} commission`} icon={DollarSign} iconColor="text-green-600" />
            <StatCard label="All-time Revenue" value={`KES ${stats.bookings.totalRevenue.toLocaleString()}`} sub={`KES ${stats.bookings.totalCommission.toLocaleString()} commission`} icon={TrendingUp} iconColor="text-primary" />
            <StatCard label="Bookings This Month" value={stats.bookings.monthBookings} sub={`${stats.bookings.total} total all-time`} icon={Ticket} iconColor="text-blue-600" onClick={() => setLocation("/admin/bookings")} />
            <StatCard label="Registered Users" value={stats.users.total} sub={`${stats.users.customers} customers · ${stats.users.managers} managers`} icon={Users} iconColor="text-orange-500" />
          </div>

          {/* Venue status summary */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Venues:</span>
            {[
              { label: `${stats.venues.approved} approved`, color: "bg-green-100 text-green-800" },
              { label: `${stats.venues.pending} pending`, color: "bg-amber-100 text-amber-800" },
              { label: `${stats.venues.suspended} suspended`, color: "bg-red-100 text-red-800" },
            ].map((b) => (
              <Badge key={b.label} className={`${b.color} border-0 cursor-pointer`} onClick={() => setLocation("/admin/venues")}>
                {b.label}
              </Badge>
            ))}
            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setLocation("/admin/venues")}>
              Manage venues <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {/* Deal status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Live deals:</span>
            <Badge className="bg-primary/10 text-primary border-0">{stats.deals.live} live</Badge>
            <Badge className="bg-orange-100 text-orange-800 border-0">{stats.deals.fillingFast} filling fast</Badge>
            <Badge className="bg-red-100 text-red-800 border-0">{stats.deals.soldOut} sold out</Badge>
            <span className="text-xs text-muted-foreground ml-auto">{stats.deals.total} total deals</span>
          </div>

          {/* 7-day revenue area chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Platform Revenue — Last 7 Days
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={stats.dailyRevenue} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="adminComm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-3 text-sm space-y-1">
                          <p className="font-semibold">{label}</p>
                          {payload.map((p: { name: string; value: number }) => (
                            <p key={p.name} className="text-muted-foreground">
                              {p.name}: <span className="font-medium text-foreground">KES {p.value.toLocaleString()}</span>
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#adminRev)" />
                  <Area type="monotone" dataKey="commission" name="Commission" stroke="#22c55e" strokeWidth={2} fill="url(#adminComm)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top venues by revenue */}
          {stats.topVenues.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  Top Venues by Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {stats.topVenues.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono w-4 shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{v.category} · {v.neighborhood.replace(/_/g," ")}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">KES {v.revenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{v.bookings} booking{v.bookings !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
