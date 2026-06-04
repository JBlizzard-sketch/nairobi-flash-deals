import { useParams, useLocation } from "wouter";
import { useListDeals } from "@workspace/api-client-react";
import { DealCard } from "@/components/deal-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Star, Clock, Utensils } from "lucide-react";

export default function VenueProfile() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const venueId = id ? parseInt(id, 10) : 0;

  const { data, isLoading } = useListDeals({ venueId, limit: 20, status: "live" });

  const deals = data?.data ?? [];
  const venue = deals[0]?.venue ?? null;

  if (isLoading) {
    return (
      <div className="container py-6 space-y-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {[1, 2].map((n) => <Skeleton key={n} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Cover image */}
      <div className="relative h-52 w-full bg-muted overflow-hidden">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 z-10 bg-background/80 backdrop-blur"
          onClick={() => history.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {venue?.coverImage ? (
          <img src={venue.coverImage} alt={venue.name ?? ""} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Utensils className="h-16 w-16 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
      </div>

      <div className="container -mt-10 relative z-10 space-y-6">
        {/* Venue info */}
        <div>
          <h1 className="text-2xl font-bold">{venue?.name ?? `Venue #${venueId}`}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            {venue?.neighborhood && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span className="capitalize">{venue.neighborhood.replace(/_/g, " ")}</span>
              </span>
            )}
            {venue?.averageRating && Number(venue.averageRating) > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                {Number(venue.averageRating).toFixed(1)}
              </span>
            )}
            {venue?.category && (
              <Badge variant="secondary" className="capitalize text-xs">{venue.category}</Badge>
            )}
          </div>
          {venue?.description && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{venue.description}</p>
          )}
        </div>

        {/* Active deals */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Live Deals
            </h2>
            {deals.length > 0 && (
              <Badge variant="outline">{deals.length} active</Badge>
            )}
          </div>

          {deals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No live deals right now</p>
              <p className="text-sm">Check back during peak hours for flash deals</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
