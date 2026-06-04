import { useState, useEffect } from "react";
import { differenceInSeconds, formatDistanceToNowStrict } from "date-fns";
import { Deal } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Users, Flame, Share2, Heart, Star } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

function useWishlist() {
  const KEY = "nfd_wishlist";
  const [ids, setIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { return new Set(); }
  });
  const toggle = (id: number) => setIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    localStorage.setItem(KEY, JSON.stringify([...next]));
    return next;
  });
  return { ids, toggle };
}

interface DealCardProps {
  deal: Deal;
  featured?: boolean;
  isTrending?: boolean;
}

export function DealCard({ deal, featured = false, isTrending = false }: DealCardProps) {
  const { ids: wishlistIds, toggle: toggleWishlist } = useWishlist();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const endsAt = new Date(deal.endsAt);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const seconds = differenceInSeconds(endsAt, new Date());
      setTimeLeft(Math.max(0, seconds));
    };
    
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [deal.endsAt]);

  const isEndingSoon = timeLeft > 0 && timeLeft < 3600; // less than 1 hour
  const isCritical = timeLeft > 0 && timeLeft < 300; // less than 5 min

  const formatTimeLeft = (seconds: number) => {
    if (seconds <= 0) return "Expired";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m ${s}s left`;
  };

  return (
    <Link href={`/deals/${deal.id}`}>
      <Card className={cn("group overflow-hidden transition-all hover:border-primary/50 cursor-pointer active-elevate-2", featured ? "md:col-span-2 md:row-span-2" : "")}>
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {deal.imageUrl || deal.venue?.coverImage ? (
            <img 
              src={deal.imageUrl || deal.venue?.coverImage || ''} 
              alt={deal.title}
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary text-secondary-foreground">
              No image
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge variant="destructive" className="font-bold">
              -{deal.discountPercent}%
            </Badge>
            {isTrending && (
              <Badge className="bg-orange-500 text-white border-none font-bold flex items-center gap-1">
                <Flame className="h-3 w-3" /> Trending
              </Badge>
            )}
            {!isTrending && deal.status === 'filling_fast' && (
              <Badge variant="secondary" className="bg-orange-500 text-white border-none">
                Filling Fast
              </Badge>
            )}
          </div>
          
          <div className={cn(
            "absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur-md",
            isCritical ? "bg-red-600 text-white animate-bounce ring-2 ring-red-400 ring-offset-1" :
            isEndingSoon ? "bg-red-500/90 text-white animate-pulse" : "bg-black/50 text-white"
          )}>
            <Clock className="h-3.5 w-3.5" />
            {formatTimeLeft(timeLeft)}
          </div>

          <div className="absolute bottom-0 w-full p-4 text-white">
            <div className="flex items-center gap-1 text-sm text-gray-300 mb-1">
              <span className="font-medium text-white">{deal.venue?.name}</span>
              {deal.venue?.averageRating && Number(deal.venue.averageRating) > 0 && (
                <span className="flex items-center text-yellow-400 text-xs">
                  <Star className="h-2.5 w-2.5 fill-yellow-400 mr-0.5" />{Number(deal.venue.averageRating).toFixed(1)}
                </span>
              )}
              <span>•</span>
              <span className="flex items-center capitalize"><MapPin className="h-3 w-3 mr-0.5" /> {deal.venue?.neighborhood?.replace('_', ' ')}</span>
            </div>
            <h3 className="font-bold text-xl leading-tight line-clamp-2">{deal.title}</h3>
          </div>
        </div>
        
        <CardContent className="p-4 flex items-center justify-between bg-card">
          <div>
            <div className="text-2xl font-bold text-primary">KES {parseInt(deal.dealPrice).toLocaleString()}</div>
            <div className="text-sm text-muted-foreground line-through">KES {parseInt(deal.originalPrice).toLocaleString()}</div>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 text-sm font-medium">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className={deal.availableSlots <= 2 ? "text-destructive font-bold" : ""}>
                {deal.availableSlots} left
              </span>
            </div>
            <div className="text-xs text-muted-foreground">of {deal.totalSlots} total</div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = `${window.location.origin}/deals/${deal.id}`;
                if (navigator.share) {
                  navigator.share({ title: deal.title, text: `${deal.title} — KES ${parseInt(deal.dealPrice).toLocaleString()} (${deal.discountPercent}% off) at ${deal.venue?.name ?? ""}`, url }).catch(() => {});
                } else {
                  const msg = encodeURIComponent(`${deal.title} — KES ${parseInt(deal.dealPrice).toLocaleString()} (${deal.discountPercent}% off) at ${deal.venue?.name ?? ""}. Book now: ${url}`);
                  window.open(`https://wa.me/?text=${msg}`, "_blank");
                }
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
              title="Share deal"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(deal.id); }}
              className={cn("flex items-center gap-1 text-xs transition-colors mt-1", wishlistIds.has(deal.id) ? "text-rose-500" : "text-muted-foreground hover:text-rose-400")}
              title={wishlistIds.has(deal.id) ? "Remove from saved" : "Save deal"}
            >
              <Heart className={cn("h-3.5 w-3.5", wishlistIds.has(deal.id) && "fill-rose-500")} />
              {wishlistIds.has(deal.id) ? "Saved" : "Save"}
            </button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
