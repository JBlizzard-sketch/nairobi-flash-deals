import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { useListBookings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

type BookingWithRating = {
  id: number;
  confirmationCode: string;
  createdAt: string;
  deal?: { id?: number; title?: string; venue?: { name?: string } };
  rating?: { id: number; score: number; comment?: string | null; createdAt: string };
};

export default function MyReviews() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data, isLoading } = useListBookings(
    { status: "checked_in", limit: 100 },
    { query: { enabled: isAuthenticated } }
  );

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;

  const bookings = (data?.data ?? []) as BookingWithRating[];
  const rated = bookings.filter((b) => !!b.rating);
  const unrated = bookings.filter((b) => !b.rating);

  return (
    <div className="container max-w-lg py-6 space-y-5 min-h-screen pb-24">
      <div>
        <h1 className="text-2xl font-bold">My Reviews</h1>
        <p className="text-muted-foreground text-sm">
          {rated.length} review{rated.length !== 1 ? "s" : ""} submitted
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          {unrated.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Awaiting your review</h2>
              {unrated.slice(0, 5).map((b) => (
                <Card key={b.id} className="border-primary/20">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{b.deal?.title ?? "Deal"}</p>
                      <p className="text-xs text-muted-foreground">{b.deal?.venue?.name}</p>
                    </div>
                    <Link href={`/deals/${b.deal?.id ?? ""}`}>
                      <Button size="sm" variant="outline" className="shrink-0 text-xs gap-1">
                        <Star className="h-3 w-3" /> Rate
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {rated.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Submitted reviews</h2>
              {rated.map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{b.deal?.title ?? "Deal"}</p>
                        <p className="text-xs text-muted-foreground">{b.deal?.venue?.name}</p>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-4 w-4 ${n <= (b.rating?.score ?? 0) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                    </div>
                    {b.rating?.comment && (
                      <p className="text-sm text-muted-foreground italic leading-relaxed">"{b.rating.comment}"</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                      {new Date(b.rating?.createdAt ?? b.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {rated.length === 0 && unrated.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold">No reviews yet</h3>
              <p className="text-muted-foreground">Reviews appear here after you check in at a venue.</p>
              <Link href="/">
                <Button variant="outline">Browse deals</Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
