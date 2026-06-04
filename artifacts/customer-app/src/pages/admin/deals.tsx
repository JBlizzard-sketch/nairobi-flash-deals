import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useListDeals, usePublishDeal, useCancelDeal, getListDealsQueryKey, DealStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowLeft, CheckCircle2, XCircle, Flame } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "live", label: "Live" },
  { id: "expired", label: "Expired" },
  { id: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  live: "bg-green-100 text-green-800",
  expired: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminDeals() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useListDeals({
    status: statusFilter === "all" ? undefined : (statusFilter as DealStatus),
    limit: 100,
  });

  const publishDeal = usePublishDeal();
  const cancelDeal = useCancelDeal();

  if (authLoading) return null;
  if (!isAuthenticated || (user as { role?: string })?.role !== "admin") {
    return <Redirect to="/" />;
  }

  const deals = data?.data ?? [];

  function handlePublish(id: number) {
    publishDeal.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListDealsQueryKey() }),
    });
  }

  function handleCancel(id: number) {
    if (!confirm("Cancel this deal? Customers with active bookings will be notified.")) return;
    cancelDeal.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListDealsQueryKey() }),
    });
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Deal Management</h1>
          <p className="text-xs text-muted-foreground">{deals.length} deal{deals.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  statusFilter === f.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : deals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Flame className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No deals found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {deals.map((deal) => (
              <Card key={deal.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold truncate">{deal.title}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${STATUS_BADGE[deal.status] ?? "bg-muted text-muted-foreground"}`}>
                          {deal.status}
                        </span>
                        {(deal as { hotScore?: number }).hotScore !== undefined && (deal as { hotScore?: number }).hotScore! > 0.5 && (
                          <span className="text-[10px] text-orange-500 font-bold flex items-center gap-0.5">
                            <Flame className="h-3 w-3" /> Hot
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{deal.venue?.name} · {deal.category} · -{deal.discountPercent}%</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        KES {parseInt(deal.dealPrice).toLocaleString()} · {deal.bookedSlots}/{deal.totalSlots} booked
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {deal.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => handlePublish(deal.id)}
                          disabled={publishDeal.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Publish
                        </Button>
                      )}
                      {deal.status === "live" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/20 hover:bg-destructive/5"
                          onClick={() => handleCancel(deal.id)}
                          disabled={cancelDeal.isPending}
                        >
                          <XCircle className="h-3 w-3" /> Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
