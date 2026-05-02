import { useListBookings } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, MapPin, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

export default function Bookings() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data, isLoading } = useListBookings({ limit: 50 });

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;

  return (
    <div className="container py-6 space-y-6 min-h-screen pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Bookings</h1>
        <p className="text-muted-foreground">Show your confirmation code at the venue.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32 bg-muted rounded-lg" />
            </Card>
          ))}
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <div className="grid gap-4">
          {data.data.map((booking) => (
            <Card key={booking.id} className="overflow-hidden">
              <div className="bg-primary/10 p-4 border-b flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-primary" />
                  <span className="font-mono text-xl font-bold tracking-widest">{booking.confirmationCode}</span>
                </div>
                <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                  {booking.status.replace('_', ' ')}
                </Badge>
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-lg">{booking.deal?.title}</h3>
                  <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5" /> {booking.venue?.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm bg-muted/50 p-3 rounded-md">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(booking.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(booking.createdAt), 'h:mm a')}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t text-sm font-medium">
                  <span>{booking.slots} slot{booking.slots > 1 ? 's' : ''}</span>
                  <span className="text-primary">KES {parseInt(booking.totalAmount).toLocaleString()} paid</span>
                </div>
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
      )}
    </div>
  );
}
