import { useLocation } from "wouter";
import { useListBookings, useCheckInBooking } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckSquare, Ticket, Clock, Users } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getListBookingsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function VenueBookings() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const venueId = (user as { managedVenueId?: number } | undefined)?.managedVenueId;
  const params = { venueId: venueId ?? 0, limit: 50 } as Parameters<typeof useListBookings>[0];

  const { data, isLoading } = useListBookings(params, { query: { enabled: !!venueId } });
  const checkIn = useCheckInBooking();

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;
  if (user && (user as { role?: string }).role !== "venue_manager") return <Redirect to="/" />;

  const handleCheckIn = (bookingId: number) => {
    checkIn.mutate(
      { id: bookingId },
      {
        onSuccess: () => {
          toast({ title: "Checked in", description: "Guest confirmed at the venue." });
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey(params) });
        },
        onError: (err: Error) => {
          toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const bookings = data?.data ?? [];
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const checkedIn = bookings.filter((b) => b.status === "checked_in");
  const others = bookings.filter((b) => !["confirmed", "checked_in"].includes(b.status));

  const statusColor = (s: string) => {
    if (s === "confirmed") return "default";
    if (s === "checked_in") return "secondary";
    if (s === "cancelled") return "destructive";
    return "outline";
  };

  const BookingCard = ({ b }: { b: typeof bookings[0] }) => (
    <Card key={b.id} className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Ticket className="h-4 w-4 text-primary shrink-0" />
              <span className="font-mono font-bold text-base tracking-widest">{b.confirmationCode}</span>
            </div>
            <p className="text-sm font-medium truncate">{(b as { deal?: { title?: string } }).deal?.title ?? "Deal"}</p>
            <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {b.slots} slot{b.slots > 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {format(new Date(b.createdAt), "h:mm a")}
              </span>
              <span className="font-medium text-foreground">KES {parseInt(b.totalAmount).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge variant={statusColor(b.status)} className="text-[10px] uppercase">{b.status.replace(/_/g, " ")}</Badge>
            {b.status === "confirmed" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={checkIn.isPending}
                onClick={() => handleCheckIn(b.id)}
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1" /> Check In
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container py-6 pb-24 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/venue")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground text-sm">{bookings.length} total today</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto">
            <Ticket className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-medium">No bookings yet</p>
          <p className="text-sm text-muted-foreground">Bookings will appear here once guests reserve slots on your deals.</p>
        </div>
      ) : (
        <>
          {confirmed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Awaiting Check-In ({confirmed.length})</h2>
              {confirmed.map((b) => <BookingCard key={b.id} b={b} />)}
            </div>
          )}
          {checkedIn.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Checked In ({checkedIn.length})</h2>
              {checkedIn.map((b) => <BookingCard key={b.id} b={b} />)}
            </div>
          )}
          {others.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Other ({others.length})</h2>
              {others.map((b) => <BookingCard key={b.id} b={b} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
