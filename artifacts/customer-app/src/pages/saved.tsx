import { useState, useEffect } from "react";
import { useListDeals } from "@workspace/api-client-react";
import { DealCard } from "@/components/deal-card";
import { Heart } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function getWishlistIds(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem("nfd_wishlist") ?? "[]")); } catch { return new Set(); }
}

export default function Saved() {
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(getWishlistIds);

  useEffect(() => {
    const onStorage = () => setWishlistIds(getWishlistIds());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const { data, isLoading } = useListDeals({ limit: 200 });

  const savedDeals = (data?.data ?? []).filter((d) => wishlistIds.has(d.id));

  return (
    <div className="container py-6 pb-24 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Heart className="h-7 w-7 text-rose-500 fill-rose-500" /> Saved Deals
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Deals you've bookmarked for later</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : savedDeals.length === 0 ? (
        <div className="text-center py-24 space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <Heart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold">No saved deals yet</h3>
          <p className="text-muted-foreground text-sm">Tap the heart icon on any deal to save it here.</p>
          <Button asChild>
            <Link href="/">Browse deals</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {savedDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
