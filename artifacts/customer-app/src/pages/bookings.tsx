import { useState } from "react";
import { useListBookings, useCreateRating, getListBookingsQueryKey, useGetMyWaitlist, useLeaveWaitlist, getGetMyWaitlistQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Ticket, MapPin, Calendar, Clock, Star, Bell, BellOff, ChevronRight, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type RatingTarget = { bookingId: number; dealTitle: string; venueName: string };

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="p-1 focus:outline-none"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
        >
          <Star
            className={`h-8 w-8 transition-colors ${
              n <= (hovered || value)
                ? "fill-primary text-primary"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  checked_in: "secondary",
  completed: "outline",
  cancelled: "destructive",
  refunded: "destructive",
  pending_payment: "outline",
};

export default function Bookings() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"bookings" | "waitlist">("bookings");
  const params = { limit: 50 };
  const { data, isLoading } = useListBookings(params);
  const { data: waitlistData, isLoading: waitlistLoading } = useGetMyWaitlist();
  const createRating = useCreateRating();
  const leaveWaitlist = useLeaveWaitlist();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [ratedIds, setRatedIds] = useState<Set<number>>(new Set());
  const [qrBookingId, setQrBookingId] = useState<number | null>(null);

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;

  const canRate = (status: string, bookingId: number) =>
    ["checked_in", "completed", "confirmed"].includes(status) &&
    !ratedIds.has(bookingId);

  const handleRate = () => {
    if (!ratingTarget) return;
    createRating.mutate(
      { data: { bookingId: ratingTarget.bookingId, score, comment: comment || undefined } },
      {
        onSuccess: () => {
          setRatedIds((prev) => new Set(prev).add(ratingTarget.bookingId));
          setRatingTarget(null);
          setScore(5);
          setComment("");
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey(params) });
          toast({
            title: "Thanks for your review!",
            description: `+50 loyalty points awarded to your account.`,
          });
        },
        onError: (err: Error) => {
          toast({ title: "Rating failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleLeaveWaitlist = (dealId: number) => {
    leaveWaitlist.mutate({ dealId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyWaitlistQueryKey() });
        toast({ title: "Removed from waitlist" });
      },
    });
  };

  const userId = (user as { id?: number } | undefined)?.id;
  const waitlistCount = waitlistData?.count ?? 0;

  return (
    <div className="container py-6 space-y-6 min-h-screen pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Bookings</h1>
        <p className="text-muted-foreground">Show your confirmation code at the venue.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "bookings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("bookings")}
        >
          Bookings
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "waitlist"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("waitlist")}
        >
          Waitlist
          {waitlistCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {waitlistCount}
            </span>
          )}
        </button>
      </div>

      {/* Bookings Tab */}
      {activeTab === "bookings" && (
        isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : data?.data && data.data.length > 0 ? (
          <div className="grid gap-4">
            {data.data
              .filter((b) => !userId || b.userId === userId)
              .map((booking) => (
                <Card key={booking.id} className="overflow-hidden">
                  <div className="bg-primary/10 p-4 border-b flex justify-between items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Ticket className="h-5 w-5 text-primary shrink-0" />
                      <span className="font-mono text-xl font-bold tracking-widest truncate">
                        {booking.confirmationCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                        onClick={() => setQrBookingId(booking.id)}
                        title="Show QR code"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                      <Badge
                        variant={STATUS_VARIANTS[booking.status] ?? "outline"}
                        className="uppercase text-[10px]"
                      >
                        {STATUS_LABELS[booking.status] ?? booking.status}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{booking.deal?.title}</h3>
                      <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5" /> {booking.venue?.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm bg-muted/50 p-3 rounded-md">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(booking.createdAt), "MMM d, yyyy")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(booking.createdAt), "h:mm a")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm font-medium">
                        {booking.slots} slot{booking.slots > 1 ? "s" : ""}
                      </span>
                      <span className="text-sm text-primary font-bold">
                        KES {parseInt(booking.totalAmount).toLocaleString()} paid
                      </span>
                    </div>

                    {ratedIds.has(booking.id) ? (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground pt-1">
                        <Star className="h-4 w-4 fill-primary text-primary" />
                        <span>Review submitted — +50 pts</span>
                      </div>
                    ) : canRate(booking.status, booking.id) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 mt-1"
                        onClick={() =>
                          setRatingTarget({
                            bookingId: booking.id,
                            dealTitle: booking.deal?.title ?? "Deal",
                            venueName: booking.venue?.name ?? "",
                          })
                        }
                      >
                        <Star className="h-4 w-4" /> Rate your experience
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
              <Ticket className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold">No bookings yet</h3>
            <p className="text-muted-foreground">When you book a deal, it will appear here.</p>
          </div>
        )
      )}

      {/* Waitlist Tab */}
      {activeTab === "waitlist" && (
        waitlistLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : waitlistData?.data && waitlistData.data.length > 0 ? (
          <div className="grid gap-4">
            {waitlistData.data.map((entry) => (
              <Card key={entry.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base leading-tight truncate">{entry.deal?.title}</h3>
                      <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {entry.venue?.name}
                        <span className="mx-1">·</span>
                        <span className="capitalize">{entry.venue?.neighborhood?.replace(/_/g, " ")}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-primary shrink-0">
                      <Bell className="h-4 w-4" />
                      <span className="text-xs font-medium">#{entry.position}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Deal price</p>
                      <p className="font-bold text-primary">
                        KES {parseInt(String(entry.deal?.dealPrice ?? 0)).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Joined</p>
                      <p className="text-xs font-medium">
                        {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => setLocation(`/deals/${entry.dealId}`)}
                    >
                      View Deal <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive gap-1.5"
                      onClick={() => handleLeaveWaitlist(entry.dealId)}
                      disabled={leaveWaitlist.isPending}
                    >
                      <BellOff className="h-4 w-4" /> Leave
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold">No waitlist entries</h3>
            <p className="text-muted-foreground">When a deal sells out, join the waitlist to be notified first.</p>
          </div>
        )
      )}

      {/* QR Code Dialog */}
      <Dialog open={qrBookingId !== null} onOpenChange={(open) => !open && setQrBookingId(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Booking QR Code</DialogTitle>
            <DialogDescription>Show this to staff at the venue to check in.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrBookingId !== null && (() => {
              const booking = data?.data.find((b) => b.id === qrBookingId);
              return booking ? (
                <>
                  <div className="rounded-xl border-2 border-primary/20 p-3 bg-white">
                    <QRCodeSVG value={booking.confirmationCode} size={180} includeMargin={false} />
                  </div>
                  <p className="font-mono text-2xl font-bold tracking-widest text-primary">{booking.confirmationCode}</p>
                  <p className="text-xs text-muted-foreground text-center">{booking.deal?.title} · {booking.venue?.name}</p>
                </>
              ) : null;
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ratingTarget} onOpenChange={(open) => !open && setRatingTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate your experience</DialogTitle>
            <DialogDescription>
              {ratingTarget?.dealTitle} · {ratingTarget?.venueName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">How was it?</p>
              <StarSelector value={score} onChange={setScore} />
              <p className="text-xs text-muted-foreground">
                {["", "Poor", "Fair", "Good", "Very good", "Excellent!"][score]}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Leave a comment (optional)</p>
              <Textarea
                placeholder="What did you enjoy? Any suggestions..."
                rows={3}
                maxLength={500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div className="bg-primary/5 rounded-lg px-4 py-2 text-sm text-muted-foreground">
              You'll earn <span className="font-bold text-primary">+50 loyalty points</span> for submitting a review.
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full"
              disabled={createRating.isPending}
              onClick={handleRate}
            >
              {createRating.isPending ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
