import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useListAdminBookings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowLeft, Ticket } from "lucide-react";

const STATUS_FILTERS = [
  { id: undefined, label: "All" },
  { id: "confirmed", label: "Confirmed" },
  { id: "checked_in", label: "Checked In" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  confirmed:    "bg-blue-100 text-blue-800 border-0",
  checked_in:   "bg-primary/10 text-primary border-0",
  completed:    "bg-green-100 text-green-800 border-0",
  cancelled:    "bg-red-100 text-red-800 border-0",
  pending_payment: "bg-amber-100 text-amber-800 border-0",
  refunded:     "bg-muted text-muted-foreground border-0",
};

type AdminBooking = {
  id: number;
  confirmation_code: string;
  status: string;
  slots: number;
  total_amount: string;
  commission_amount: string;
  deal_title: string;
  deal_category: string;
  venue_name: string;
  neighborhood: string;
  user_name: string;
  user_phone: string;
  created_at: string;
};

export default function AdminBookings() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]["id"]>(undefined);

  const { data, isLoading } = useListAdminBookings(
    statusFilter ? { status: statusFilter as string } : {},
    { query: { enabled: isAuthenticated && (user as { role?: string } | undefined)?.role === "admin" } }
  );

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;
  if ((user as { role?: string } | undefined)?.role !== "admin") return <Redirect to="/" />;

  return (
    <div className="container py-6 pb-24 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground text-sm">
            {data ? `${data.pagination.total} booking${data.pagination.total !== 1 ? "s" : ""}` : "All platform bookings"}
          </p>
        </div>
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex w-max space-x-2 pb-1">
          {STATUS_FILTERS.map((f) => (
            <Badge
              key={String(f.id)}
              variant={statusFilter === f.id ? "default" : "outline"}
              className="cursor-pointer py-1.5 px-4 rounded-full text-sm"
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </Badge>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i=><Skeleton key={i} className="h-28 rounded-xl"/>)}</div>
      ) : data?.data && (data.data as unknown as AdminBooking[]).length > 0 ? (
        <div className="space-y-3">
          {(data.data as unknown as AdminBooking[]).map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-mono text-sm font-bold">{b.confirmation_code}</span>
                      <Badge className={STATUS_BADGE[b.status] ?? ""}>{b.status.replace(/_/g," ")}</Badge>
                    </div>
                    <p className="text-sm font-medium truncate">{b.deal_title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {b.venue_name} · {b.neighborhood?.replace(/_/g," ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">KES {Number(b.total_amount).toLocaleString()}</p>
                    <p className="text-xs text-green-700">+KES {Number(b.commission_amount).toLocaleString()} fee</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                  <span>{b.user_name} · {b.user_phone}</span>
                  <span>{b.slots} slot{b.slots !== 1 ? "s" : ""} · {new Date(b.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
          <Ticket className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No bookings found</p>
        </div>
      )}
    </div>
  );
}
