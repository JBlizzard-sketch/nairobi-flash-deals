import { useState, useDeferredValue } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useListDeals, useGetTrendingDeals } from "@workspace/api-client-react";
import { DealCard } from "@/components/deal-card";
import { DealCategory, VenueNeighborhood } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Search, X, Flame, Navigation, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const NEIGHBORHOOD_CENTROIDS: Record<string, [number, number]> = {
  westlands:  [-1.2668, 36.8029],
  kilimani:   [-1.2921, 36.7878],
  cbd:        [-1.2864, 36.8172],
  karen:      [-1.3332, 36.6833],
  langata:    [-1.3147, 36.7489],
  lavington:  [-1.2841, 36.7771],
  kileleshwa: [-1.2822, 36.7873],
  gigiri:     [-1.2308, 36.8024],
  upper_hill: [-1.2987, 36.8189],
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CATEGORIES = [
  { id: "all", label: "All Deals" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "brunch", label: "Brunch" },
  { id: "drinks", label: "Drinks" },
  { id: "treatment", label: "Spa & Beauty" },
  { id: "class", label: "Fitness" },
  { id: "experience", label: "Experience" },
  { id: "tasting", label: "Tasting" },
];

const NEIGHBORHOODS = [
  { id: "all", label: "All Areas" },
  { id: "westlands", label: "Westlands" },
  { id: "kilimani", label: "Kilimani" },
  { id: "cbd", label: "CBD" },
  { id: "karen", label: "Karen" },
  { id: "langata", label: "Langata" },
  { id: "lavington", label: "Lavington" },
  { id: "kileleshwa", label: "Kileleshwa" },
  { id: "gigiri", label: "Gigiri" },
  { id: "upper_hill", label: "Upper Hill" },
];

const PRICE_RANGES = [
  { id: "any", label: "Any Price", minPrice: undefined, maxPrice: undefined },
  { id: "under2k", label: "Under 2K", minPrice: undefined, maxPrice: 2000 },
  { id: "2k5k", label: "2K – 5K", minPrice: 2000, maxPrice: 5000 },
  { id: "over5k", label: "5K+", minPrice: 5000, maxPrice: undefined },
];

export default function Home() {
  const [searchInput, setSearchInput] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeNeighborhood, setActiveNeighborhood] = useState<string>("all");
  const [activePriceRange, setActivePriceRange] = useState<string>("any");
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [nearMeActive, setNearMeActive] = useState(false);
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { data: trendingData } = useGetTrendingDeals();

  const deferredSearch = useDeferredValue(searchInput);
  const priceRange = PRICE_RANGES.find((p) => p.id === activePriceRange) ?? PRICE_RANGES[0];

  const activeFilterCount = [
    activeCategory !== "all",
    activeNeighborhood !== "all",
    activePriceRange !== "any",
    deferredSearch.length > 0,
  ].filter(Boolean).length;

  function handleNearMe() {
    if (nearMeActive) {
      setNearMeActive(false);
      setActiveNeighborhood("all");
      return;
    }
    if (!navigator.geolocation) return;
    setNearMeLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let closest = "all";
        let minDist = Infinity;
        for (const [hood, [hLat, hLng]] of Object.entries(NEIGHBORHOOD_CENTROIDS)) {
          const d = haversineKm(lat, lng, hLat, hLng);
          if (d < minDist) { minDist = d; closest = hood; }
        }
        setActiveNeighborhood(closest);
        setNearMeActive(true);
        setNearMeLoading(false);
      },
      () => setNearMeLoading(false)
    );
  }

  const { data, isLoading, error } = useListDeals({
    search: deferredSearch || undefined,
    category: activeCategory === "all" ? undefined : (activeCategory as DealCategory),
    neighborhood:
      activeNeighborhood === "all" ? undefined : (activeNeighborhood as VenueNeighborhood),
    minPrice: priceRange.minPrice,
    maxPrice: priceRange.maxPrice,
    status: "live",
    limit: 20,
  });

  function clearAllFilters() {
    setSearchInput("");
    setActiveCategory("all");
    setActiveNeighborhood("all");
    setActivePriceRange("any");
    setNearMeActive(false);
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 md:pb-0">
      <div className="bg-background/95 backdrop-blur border-b sticky top-14 z-40 space-y-0">
        <div className="container py-3">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search deals, venues…"
                className="pl-9 pr-9 rounded-full bg-muted/60 border-0 focus-visible:ring-1"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant={nearMeActive ? "default" : "outline"}
              size="sm"
              className="rounded-full gap-1.5 shrink-0"
              onClick={handleNearMe}
              disabled={nearMeLoading}
            >
              {nearMeLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Navigation className="h-4 w-4" />}
              <span className="hidden sm:inline">Near Me</span>
            </Button>
          </div>
        </div>

        <ScrollArea className="w-full whitespace-nowrap border-t border-border/40">
          <div className="flex w-max space-x-2 px-4 py-2.5">
            {CATEGORIES.map((cat) => (
              <Badge
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "outline"}
                className="cursor-pointer text-sm py-1.5 px-4 rounded-full transition-all"
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </Badge>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <ScrollArea className="w-full whitespace-nowrap border-t border-border/40">
          <div className="flex w-max space-x-2 px-4 py-2.5 items-center">
            <span className="text-xs text-muted-foreground font-medium mr-1 shrink-0">Area</span>
            {NEIGHBORHOODS.map((n) => (
              <Badge
                key={n.id}
                variant={activeNeighborhood === n.id ? "secondary" : "outline"}
                className={`cursor-pointer text-xs py-1 px-3 rounded-full transition-all ${
                  activeNeighborhood === n.id ? "bg-primary/15 text-primary border-primary/30" : ""
                }`}
                onClick={() => setActiveNeighborhood(n.id)}
              >
                {n.label}
              </Badge>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <ScrollArea className="w-full whitespace-nowrap border-t border-border/40">
          <div className="flex w-max space-x-2 px-4 py-2.5 items-center">
            <span className="text-xs text-muted-foreground font-medium mr-1 shrink-0">Price</span>
            {PRICE_RANGES.map((p) => (
              <Badge
                key={p.id}
                variant={activePriceRange === p.id ? "secondary" : "outline"}
                className={`cursor-pointer text-xs py-1 px-3 rounded-full transition-all ${
                  activePriceRange === p.id ? "bg-primary/15 text-primary border-primary/30" : ""
                }`}
                onClick={() => setActivePriceRange(p.id)}
              >
                {p.label}
              </Badge>
            ))}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="ml-2 text-xs h-7 px-3 text-muted-foreground shrink-0"
              >
                <X className="h-3 w-3 mr-1" />
                Clear {activeFilterCount > 1 ? `(${activeFilterCount})` : ""}
              </Button>
            )}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </div>

      <main className="flex-1 container py-6 space-y-8">
        {/* Trending strip — shown when no filters are active */}
        {activeFilterCount === 0 && !deferredSearch && trendingData?.data && trendingData.data.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <h2 className="text-xl font-bold">Trending Now</h2>
              <span className="text-xs text-muted-foreground">hottest right now</span>
            </div>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-4 pb-3">
                {trendingData.data.slice(0, 5).map((deal) => (
                  <div key={deal.id} className="w-64 shrink-0">
                    <DealCard deal={deal} isTrending />
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </section>
        )}

        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-1">
              {deferredSearch
                ? `Results for "${deferredSearch}"`
                : activeNeighborhood !== "all"
                  ? NEIGHBORHOODS.find((n) => n.id === activeNeighborhood)?.label
                  : "Happening Today"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {data
                ? `${data.pagination.total} deal${data.pagination.total !== 1 ? "s" : ""} available right now`
                : "Premium experiences in Nairobi"}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load deals. Please try again later.</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col space-y-3">
                <Skeleton className="h-[250px] w-full rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.data && data.data.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.data.map((deal, index) => (
              <DealCard
                key={deal.id}
                deal={deal}
                featured={index === 0 && activeFilterCount === 0}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold">No deals found</h3>
            <p className="text-muted-foreground max-w-md">
              {deferredSearch
                ? `No deals match "${deferredSearch}". Try a different search term.`
                : "No deals match your current filters. Try broadening your search."}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={clearAllFilters} className="mt-2">
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
