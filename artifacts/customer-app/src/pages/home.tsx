import { useState } from "react";
import { useListDeals } from "@workspace/api-client-react";
import { DealCard } from "@/components/deal-card";
import { DealCategory } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const CATEGORIES = [
  { id: "all", label: "All Deals" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "brunch", label: "Brunch" },
  { id: "drinks", label: "Drinks" },
  { id: "treatment", label: "Spa & Beauty" },
  { id: "class", label: "Fitness" },
];

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  
  const { data, isLoading, error } = useListDeals({ 
    category: activeCategory === "all" ? undefined : activeCategory as DealCategory,
    status: "live",
    limit: 20 
  });

  return (
    <div className="flex flex-col min-h-screen pb-20 md:pb-0">
      <div className="bg-primary/5 border-b sticky top-14 z-40">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex w-max space-x-2 p-4">
            {CATEGORIES.map((category) => (
              <Badge
                key={category.id}
                variant={activeCategory === category.id ? "default" : "outline"}
                className="cursor-pointer text-sm py-1.5 px-4 rounded-full transition-all active-elevate"
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}
              </Badge>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </div>

      <main className="flex-1 container py-6 space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Happening Today</h2>
          <p className="text-muted-foreground">Premium experiences in Nairobi, available right now.</p>
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
              <DealCard key={deal.id} deal={deal} featured={index === 0 && activeCategory === "all"} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold">No active deals found</h3>
            <p className="text-muted-foreground max-w-md">
              There are no {activeCategory !== 'all' ? activeCategory : ''} deals available at this exact moment. Check back soon.
            </p>
            {activeCategory !== 'all' && (
              <Badge 
                className="cursor-pointer mt-4 py-2 px-6" 
                onClick={() => setActiveCategory("all")}
              >
                View all deals
              </Badge>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
