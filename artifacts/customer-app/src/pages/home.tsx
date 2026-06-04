import { useState, useDeferredValue, useRef, useEffect } from "react";
import { differenceInSeconds } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useListDeals, useGetTrendingDeals } from "@workspace/api-client-react";
import { DealCard } from "@/components/deal-card";
import { DealCategory, VenueNeighborhood } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Search, X, Flame, Navigation, Loader2, Clock, Utensils, Zap, Smile, Gift } from "lucide-react";
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
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("nfd_recent_searches") ?? "[]"); } catch { return []; }
  });
  const searchRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeNeighborhood, setActiveNeighborhood] = useState<string>("all");
  const [activePriceRange, setActivePriceRange] = useState<string>("any");
  const [sortBy, setSortBy] = useState<"default" | "price_asc" | "price_desc" | "discount">("default");
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [nearMeActive, setNearMeActive] = useState(false);

  const saveRecentSearch = (term: string) => {
    if (!term.trim() || term.length < 2) return;
    setRecentSearches((prev) => {
      const next = [term, ...prev.filter((s) => s !== term)].slice(0, 5);
      localStorage.setItem("nfd_recent_searches", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
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
            <div className="relative flex-1" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(e) => { if (e.key === "Enter" && searchInput.trim()) { saveRecentSearch(searchInput.trim()); setSearchFocused(false); } }}
                placeholder="Search deals, venues…"
                className="pl-9 pr-9 rounded-full bg-muted/60 border-0 focus-visible:ring-1"
              />
              {searchFocused && !searchInput && recentSearches.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-background border rounded-xl shadow-lg overflow-hidden">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-2 pb-1">Recent</p>
                  {recentSearches.map((s) => (
                    <button
                      key={s}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                      onClick={() => { setSearchInput(s); setSearchFocused(false); }}
                    >
                      <Search className="h-3 w-3 text-muted-foreground" /> {s}
                    </button>
                  ))}
                </div>
              )}
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
            <span className="text-xs text-muted-foreground font-medium ml-2 shrink-0 border-l pl-3">Sort</span>
            {(["default", "discount", "price_asc", "price_desc"] as const).map((s) => (
              <Badge
                key={s}
                variant={sortBy === s ? "secondary" : "outline"}
                className={`cursor-pointer text-xs py-1 px-3 rounded-full transition-all shrink-0 ${sortBy === s ? "bg-primary/15 text-primary border-primary/30" : ""}`}
                onClick={() => setSortBy(s)}
              >
                {s === "default" ? "Trending" : s === "discount" ? "Best Deal" : s === "price_asc" ? "Price ↑" : "Price ↓"}
              </Badge>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </div>

      <main className="flex-1 container py-6 space-y-8">
        {/* Hero banner — guests only */}
        {!isAuthenticated && activeFilterCount === 0 && !deferredSearch && (
          <section className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-background border border-primary/20 p-6 md:p-8">
            <div className="relative z-10 max-w-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Nairobi's #1 Flash Deals</p>
              <h2 className="text-2xl md:text-3xl font-extrabold leading-tight mb-3">
                Dead-hour deals at the city's best spots
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                Premium restaurants, spas &amp; wellness venues post limited offers during quiet hours. Book in under 60 seconds.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Button onClick={() => setLocation("/auth")} size="sm" className="rounded-full">
                  Sign up free
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => {
                  document.getElementById("deals-grid")?.scrollIntoView({ behavior: "smooth" });
                }}>
                  Browse deals
                </Button>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 text-[120px] opacity-[0.06] select-none pointer-events-none">🍽️</div>
          </section>
        )}
        {/* Flash Deal of the Day — most discounted live deal */}
        {activeFilterCount === 0 && !deferredSearch && (() => {
          type DealItem = NonNullable<typeof data>["data"][0];
          const featured = (data?.data ?? []).reduce<DealItem | null>((best, d) => {
            if (!best) return d;
            return d.discountPercent > best.discountPercent ? d : best;
          }, null);
          if (!featured || featured.discountPercent < 40) return null;
          return (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Deal of the Day</h2>
                <span className="text-xs text-muted-foreground ml-auto">Best discount</span>
              </div>
              <div className="w-full">
                <DealCard deal={featured} featured />
              </div>
            </section>
          );
        })()}

        {/* Referral CTA — authenticated users, no active filters */}
        {isAuthenticated && activeFilterCount === 0 && !deferredSearch && (
          <div className="flex items-center gap-3 bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
            <Gift className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Earn 150 pts per referral</p>
              <p className="text-xs text-muted-foreground">Share your code and earn when friends book</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => setLocation("/profile")}>
              Share code
            </Button>
          </div>
        )}

        {/* For You — personalized deals based on recently viewed categories */}
        {isAuthenticated && activeFilterCount === 0 && !deferredSearch && (() => {
          let recentIds: number[] = [];
          try { recentIds = JSON.parse(localStorage.getItem("nfd_recently_viewed") ?? "[]"); } catch { /* noop */ }
          if (recentIds.length === 0) return null;
          const allDeals = data?.data ?? [];
          const viewedCategories = [...new Set(recentIds.map((id) => allDeals.find((d) => d.id === id)?.category).filter(Boolean))];
          if (viewedCategories.length === 0) return null;
          const forYouDeals = allDeals
            .filter((d) => !recentIds.includes(d.id) && viewedCategories.includes(d.category))
            .slice(0, 5);
          if (forYouDeals.length === 0) return null;
          return (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">For You</h2>
                <span className="text-xs text-muted-foreground">based on what you've browsed</span>
              </div>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 pb-3">
                  {forYouDeals.map((deal) => (
                    <div key={deal.id} className="w-64 shrink-0">
                      <DealCard deal={deal} />
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          );
        })()}

        {/* Recently Viewed — read from localStorage, filter live deals */}
        {activeFilterCount === 0 && !deferredSearch && (() => {
          let recentIds: number[] = [];
          try { recentIds = JSON.parse(localStorage.getItem("nfd_recently_viewed") ?? "[]"); } catch { /* noop */ }
          if (recentIds.length === 0) return null;
          const recentDeals = recentIds
            .map((id) => (data?.data ?? []).find((d) => d.id === id))
            .filter(Boolean) as NonNullable<typeof data>["data"];
          if (recentDeals.length === 0) return null;
          return (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-bold">Recently Viewed</h2>
              </div>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 pb-3">
                  {recentDeals.slice(0, 5).map((deal) => (
                    <div key={deal.id} className="w-64 shrink-0">
                      <DealCard deal={deal} />
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          );
        })()}

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

        {/* Ending Soon strip — live deals with < 60 min left */}
        {activeFilterCount === 0 && !deferredSearch && (() => {
          const endingSoon = (data?.data ?? []).filter((d) => {
            const s = differenceInSeconds(new Date(d.endsAt), new Date());
            return s > 0 && s < 3600;
          });
          if (endingSoon.length === 0) return null;
          return (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-destructive animate-pulse" />
                <h2 className="text-xl font-bold text-destructive">Ending Soon</h2>
                <span className="text-xs text-muted-foreground">grab these before they're gone</span>
              </div>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 pb-3">
                  {endingSoon.slice(0, 5).map((deal) => (
                    <div key={deal.id} className="w-64 shrink-0">
                      <DealCard deal={deal} />
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          );
        })()}

        {/* How it works — guests only, no filters active */}
        {!isAuthenticated && activeFilterCount === 0 && !deferredSearch && (
          <section className="grid grid-cols-3 gap-4 py-2">
            {[
              { icon: Utensils, label: "Browse", desc: "Top venues post deals during quiet hours" },
              { icon: Zap, label: "Book in 60s", desc: "Pay via Mpesa, get a confirmation instantly" },
              { icon: Smile, label: "Show up & enjoy", desc: "Just arrive and present your code" },
            ].map((step, i) => (
              <div key={step.label} className="flex flex-col items-center text-center gap-2 p-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center relative">
                  <step.icon className="h-5 w-5 text-primary" />
                  <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">{i + 1}</span>
                </div>
                <p className="text-xs font-bold">{step.label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{step.desc}</p>
              </div>
            ))}
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
            {[...data.data].sort((a, b) => {
              if (sortBy === "discount") return b.discountPercent - a.discountPercent;
              if (sortBy === "price_asc") return parseInt(a.dealPrice) - parseInt(b.dealPrice);
              if (sortBy === "price_desc") return parseInt(b.dealPrice) - parseInt(a.dealPrice);
              return 0;
            }).map((deal, index) => (
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
