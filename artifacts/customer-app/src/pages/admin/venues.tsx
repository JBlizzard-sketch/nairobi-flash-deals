import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useListAdminVenues, useUpdateVenueStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, XCircle, Building2, MapPin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAdminVenuesQueryKey } from "@workspace/api-client-react";

const STATUS_FILTERS = [
  { id: undefined, label: "All" },
  { id: "approved", label: "Approved" },
  { id: "pending", label: "Pending" },
  { id: "suspended", label: "Suspended" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-green-100 text-green-800 border-0",
  pending: "bg-amber-100 text-amber-800 border-0",
  suspended: "bg-red-100 text-red-800 border-0",
};

export default function AdminVenues() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "suspended" | undefined>(undefined);

  const { data, isLoading } = useListAdminVenues(
    statusFilter ? { status: statusFilter } : {},
    { query: { enabled: isAuthenticated && (user as { role?: string } | undefined)?.role === "admin" } }
  );
  const updateStatus = useUpdateVenueStatus();

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;
  if ((user as { role?: string } | undefined)?.role !== "admin") return <Redirect to="/" />;

  async function handleStatusChange(
    venueId: number,
    newStatus: "approved" | "suspended" | "pending",
    venueName: string
  ) {
    try {
      await updateStatus.mutateAsync({ id: venueId, data: { status: newStatus } });
      queryClient.invalidateQueries({ queryKey: getListAdminVenuesQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getListAdminVenuesQueryKey({ status: statusFilter }) });
      toast({
        title: `Venue ${newStatus}`,
        description: `${venueName} has been ${newStatus}.`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to update venue status.", variant: "destructive" });
    }
  }

  return (
    <div className="container py-6 pb-24 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Venues</h1>
          <p className="text-muted-foreground text-sm">
            {data ? `${data.pagination.total} venue${data.pagination.total !== 1 ? "s" : ""}` : "Manage all venues"}
          </p>
        </div>
      </div>

      {/* Status filter chips */}
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
      ) : data?.data && data.data.length > 0 ? (
        <div className="space-y-3">
          {(data.data as unknown as Array<{
            id: number; name: string; category: string; neighborhood: string;
            status: string; address: string; averageRating: string | null;
            bookingCount: number; dealCount: number; createdAt: string;
          }>).map((venue) => (
            <Card key={venue.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold">{venue.name}</p>
                      <Badge className={STATUS_BADGE[venue.status] ?? ""}>{venue.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1 capitalize">
                        <Building2 className="h-3 w-3" /> {venue.category}
                      </span>
                      <span className="flex items-center gap-1 capitalize">
                        <MapPin className="h-3 w-3" /> {venue.neighborhood.replace(/_/g, " ")}
                      </span>
                      <span>{venue.dealCount} deal{venue.dealCount !== 1 ? "s" : ""}</span>
                      <span>{venue.bookingCount} booking{venue.bookingCount !== 1 ? "s" : ""}</span>
                      {venue.averageRating && Number(venue.averageRating) > 0 && (
                        <span>★ {Number(venue.averageRating).toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {venue.status !== "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => handleStatusChange(venue.id, "approved", venue.name)}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                      </Button>
                    )}
                    {venue.status !== "suspended" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 text-red-700 border-red-200 hover:bg-red-50"
                        onClick={() => handleStatusChange(venue.id, "suspended", venue.name)}
                        disabled={updateStatus.isPending}
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Suspend
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
          <Building2 className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No venues found</p>
        </div>
      )}
    </div>
  );
}
