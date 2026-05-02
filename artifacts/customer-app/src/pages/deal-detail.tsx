import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetDeal, useCreateBooking } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Clock, Users, Star, ArrowLeft, Plus, Minus, Ticket } from "lucide-react";
import { differenceInSeconds } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function DealDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  
  const dealId = id ? parseInt(id, 10) : 0;
  const { data: deal, isLoading, error } = useGetDeal(dealId);
  const createBooking = useCreateBooking();

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [slots, setSlots] = useState(1);
  const [phone, setPhone] = useState("");
  const [isBookingOpen, setIsBookingOpen] = useState(false);

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
    return <div className="p-8 text-center">Loading deal details...</div>;
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

    createBooking.mutate({
      data: {
        dealId,
        slots,
        phoneNumber: phone
      }
    }, {
      onSuccess: (data) => {
        setIsBookingOpen(false);
        toast({ title: "Booking Confirmed!", description: "Your code is " + data.confirmationCode });
        setLocation("/bookings");
      },
      onError: (err) => {
        toast({ title: "Booking Failed", description: err.message, variant: "destructive" });
      }
    });
  };

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
            src={deal.imageUrl || deal.venue?.coverImage || ''} 
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
          <Badge variant="secondary" className="text-sm font-semibold flex items-center gap-1">
            <Clock className="h-4 w-4" /> {formatTimeLeft(timeLeft)} left
          </Badge>
        </div>

        <div>
          <div className="flex items-center gap-2 text-primary font-medium mb-1">
            <span>{deal.venue?.name}</span>
            {deal.venue?.averageRating && (
              <span className="flex items-center text-muted-foreground text-sm">
                <Star className="h-3 w-3 fill-primary text-primary mr-1" />
                {deal.venue.averageRating}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{deal.title}</h1>
          <div className="flex items-center text-muted-foreground mt-2">
            <MapPin className="h-4 w-4 mr-1" />
            <span className="capitalize">{deal.venue?.neighborhood?.replace('_', ' ')}</span>
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
                  <Users className="h-4 w-4" /> {deal.availableSlots} slots left
                </p>
                <p className="text-xs text-muted-foreground">Limited availability</p>
              </div>
            </div>

            <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
              <DialogTrigger asChild>
                <Button className="w-full text-lg py-6" size="lg" disabled={deal.availableSlots === 0 || timeLeft <= 0}>
                  {deal.availableSlots === 0 ? "Sold Out" : timeLeft <= 0 ? "Expired" : "Book Now"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Complete Booking</DialogTitle>
                  <DialogDescription>
                    {deal.title} at {deal.venue?.name}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleBook} className="space-y-6 my-4">
                  <div className="space-y-2">
                    <Label>Number of Slots</Label>
                    <div className="flex items-center gap-4">
                      <Button type="button" variant="outline" size="icon" onClick={() => setSlots(Math.max(1, slots - 1))}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-xl font-bold w-8 text-center">{slots}</span>
                      <Button type="button" variant="outline" size="icon" onClick={() => setSlots(Math.min(deal.availableSlots, slots + 1))}>
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
                    <p className="text-xs text-muted-foreground">You will receive an Mpesa prompt to pay KES {(parseInt(deal.dealPrice) * slots).toLocaleString()}</p>
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
      </div>
    </div>
  );
}
