import { useState, useEffect } from "react";
import { differenceInSeconds, formatDistanceToNowStrict } from "date-fns";
import { Deal } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Users, Flame } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface DealCardProps {
  deal: Deal;
  featured?: boolean;
  isTrending?: boolean;
}

export function DealCard({ deal, featured = false, isTrending = false }: DealCardProps) {
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
            isEndingSoon ? "bg-red-500/90 text-white animate-pulse" : "bg-black/50 text-white"
          )}>
            <Clock className="h-3.5 w-3.5" />
            {formatTimeLeft(timeLeft)}
          </div>

          <div className="absolute bottom-0 w-full p-4 text-white">
            <div className="flex items-center gap-1 text-sm text-gray-300 mb-1">
              <span className="font-medium text-white">{deal.venue?.name}</span>
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
          
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 text-sm font-medium">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className={deal.availableSlots <= 2 ? "text-destructive font-bold" : ""}>
                {deal.availableSlots} left
              </span>
            </div>
            <div className="text-xs text-muted-foreground">of {deal.totalSlots} total</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
