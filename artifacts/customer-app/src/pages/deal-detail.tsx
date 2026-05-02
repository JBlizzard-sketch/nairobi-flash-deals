import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetDeal, useCreateBooking, useListVenueRatings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Clock, Users, Star, ArrowLeft, Plus, Minus, Ticket, CheckCircle2, Share2 } from "lucide-react";
import { differenceInSeconds } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";

type BookingResult = {
  confirmationCode: string;
  slots: number;
  totalAmount: string;
  venueName: string;
  dealTitle: string;
  paymentStatus?: string;
  message?: string;
};

export default function DealDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();

  const dealId = id ? parseInt(id, 10) : 0;
  const { data: deal, isLoading, error } = useGetDeal(dealId);
  const createBooking = useCreateBooking();
  const venueId = deal?.venueId ?? 0;
  const { data: ratingsData } = useListVenueRatings(venueId, { limit: 5 }, { query: { enabled: !!venueId } });

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [slots, setSlots] = useState(1);
  const [phone, setPhone] = useState("");
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingResult | null>(null);

  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
  }, [user]);

  useEffect(() => {
    if (!deal) return;
    const endsAt = new Date(deal.endsAt);
    const calculateTimeLeft = () => {
      const seconds = differenceInSeconds(endsAt, new Date());
      setTimeLeft(Math.max(0, seconds));
    };
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [deal]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6 animate-pulse">
        <div className="h-64 bg-muted rounded-xl" />
        <div className="h-8 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-32 bg-muted rounded-xl" />
      </div>
    );
  }

  if (error || !deal) {
    return <div className="p-8 text-center text-destructive">Deal not found.</div>;
  }

  const formatTimeLeft = (seconds: number) => {
    if (seconds <= 0) return "Expired";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const isUrgent = timeLeft > 0 && timeLeft < 30 * 60;

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setLocation("/auth");
      return;
    }
    if (!phone) {
      toast({ title: "Required", description: "Phone number is required", variant: "destructive" });
      return;
    }
    createBooking.mutate(
      { data: { dealId, slots, phoneNumber: phone } },
      {
        onSuccess: (data) => {
          setIsBookingOpen(false);
          setConfirmedBooking({
            confirmationCode: data.confirmationCode,
            slots,
            totalAmount: data.totalAmount,
            venueName: deal.venue?.name ?? "",
            dealTitle: deal.title,
            paymentStatus: (data as { paymentStatus?: string }).paymentStatus,
            message: (data as { message?: string }).message,
          });
        },
        onError: (err: Error & { response?: { data?: { message?: string } } }) => {
          const msg = err.response?.data?.message ?? err.message;
          toast({ title: "Booking Failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  if (confirmedBooking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-24 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-1">You're in.</h1>
          <p className="text-muted-foreground text-sm">{confirmedBooking.dealTitle} · {confirmedBooking.venueName}</p>
        </div>

        <div className="w-full max-w-sm bg-card border rounded-2xl p-6 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Confirmation Code</p>
            <p className="font-mono text-3xl font-bold tracking-widest text-primary">{confirmedBooking.confirmationCode}</p>
            <p className="text-xs text-muted-foreground mt-2">Show this at the door</p>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Slots booked</span>
            <span className="font-medium">{confirmedBooking.slots}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount paid</span>
            <span className="font-medium text-primary">KES {parseInt(confirmedBooking.totalAmount).toLocaleString()}</span>
          </div>
          {confirmedBooking.message && (
            <p className="text-xs text-muted-foreground italic">{confirmedBooking.message}</p>
          )}
        </div>

        <div className="flex gap-3 w-full max-w-sm">
          <Button className="flex-1" onClick={() => setLocation("/bookings")}>
            <Ticket className="w-4 h-4 mr-2" /> My Bookings
          </Button>
          <Button variant="outline" size="icon" onClick={() => {
            if (navigator.share) {
              navigator.share({ title: "NFD Deal", text: `My code: ${confirmedBooking.confirmationCode}` });
            }
          }}>
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="ghost" onClick={() => setLocation("/")}>Back to deals</Button>
      </div>
    );
  }

  const availableSlots = deal.availableSlots ?? (deal.totalSlots - deal.bookedSlots);

  return (
    <div className="pb-24">
      <div className="relative h-64 md:h-96 w-full">
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-4 left-4 z-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {deal.imageUrl || deal.venue?.coverImage ? (
          <img
            src={deal.imageUrl || deal.venue?.coverImage || ""}
            alt={deal.title}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">No Image</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="container relative -mt-16 z-20 space-y-6">
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="destructive" className="text-lg px-3 py-1">-{deal.discountPercent}%</Badge>
          <Badge
            variant="secondary"
            className={`text-sm font-semibold flex items-center gap-1 ${isUrgent ? "animate-pulse text-destructive border-destructive" : ""}`}
          >
            <Clock className="h-4 w-4" /> {formatTimeLeft(timeLeft)} left
          </Badge>
        </div>

        <div>
          <div className="flex items-center gap-2 text-primary font-medium mb-1">
            <span>{deal.venue?.name}</span>
            {deal.venue?.averageRating && Number(deal.venue.averageRating) > 0 && (
              <span className="flex items-center text-muted-foreground text-sm">
                <Star className="h-3 w-3 fill-primary text-primary mr-1" />
                {Number(deal.venue.averageRating).toFixed(1)}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{deal.title}</h1>
          <div className="flex items-center text-muted-foreground mt-2">
            <MapPin className="h-4 w-4 mr-1" />
            <span className="capitalize">{deal.venue?.neighborhood?.replace(/_/g, " ")}</span>
            <span className="mx-2">•</span>
            <span className="capitalize">{deal.category}</span>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-sm text-muted-foreground line-through">KES {parseInt(deal.originalPrice).toLocaleString()}</p>
                <p className="text-3xl font-bold text-primary">KES {parseInt(deal.dealPrice).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium flex items-center justify-end gap-1">
                  <Users className="h-4 w-4" /> {availableSlots} slots left
                </p>
                <p className="text-xs text-muted-foreground">of {deal.totalSlots} total</p>
              </div>
            </div>

            <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
              <DialogTrigger asChild>
                <Button
                  className="w-full text-lg py-6"
                  size="lg"
                  disabled={availableSlots === 0 || timeLeft <= 0}
                >
                  {availableSlots === 0 ? "Sold Out" : timeLeft <= 0 ? "Expired" : "Book Now"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Complete Booking</DialogTitle>
                  <DialogDescription>{deal.title} at {deal.venue?.name}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleBook} className="space-y-6 my-4">
                  <div className="space-y-2">
                    <Label>Number of Slots</Label>
                    <div className="flex items-center gap-4">
                      <Button type="button" variant="outline" size="icon" onClick={() => setSlots(Math.max(1, slots - 1))}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-xl font-bold w-8 text-center">{slots}</span>
                      <Button type="button" variant="outline" size="icon" onClick={() => setSlots(Math.min(availableSlots, slots + 1))}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Mpesa Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="+254700000000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      You will receive an Mpesa prompt to pay KES {(parseInt(deal.dealPrice) * slots).toLocaleString()}
                    </p>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full" disabled={createBooking.isPending}>
                      {createBooking.isPending ? "Processing..." : `Pay KES ${(parseInt(deal.dealPrice) * slots).toLocaleString()}`}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="text-xl font-bold">About this deal</h3>
          <p className="text-muted-foreground whitespace-pre-wrap">{deal.description}</p>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-xl font-bold">Venue Information</h3>
          <p className="text-muted-foreground whitespace-pre-wrap">{deal.venue?.description}</p>
          <div className="flex items-start gap-2 mt-2">
            <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <span className="text-sm">{deal.venue?.address}</span>
          </div>
        </div>

        {ratingsData && ratingsData.data.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4 pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Guest Reviews</h3>
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  <span className="font-bold">
                    {Number(deal.venue?.averageRating ?? 0).toFixed(1)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    ({ratingsData.pagination.total})
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {ratingsData.data.map((r) => (
                  <div key={r.id} className="border rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-4 w-4 ${n <= r.score ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{r.comment}</p>
                    )}
                    {r.response && (
                      <div className="bg-muted/60 rounded-lg px-3 py-2 text-xs text-muted-foreground border-l-2 border-primary/40">
                        <span className="font-semibold text-foreground">Venue reply: </span>
                        {r.response}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
