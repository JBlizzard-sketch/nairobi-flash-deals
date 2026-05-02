import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateDeal, usePublishDeal } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addHours, format } from "date-fns";

const CATEGORIES = [
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "brunch", label: "Brunch" },
  { value: "treatment", label: "Spa Treatment" },
  { value: "class", label: "Fitness Class" },
  { value: "experience", label: "Experience" },
  { value: "drinks", label: "Drinks" },
  { value: "tasting", label: "Tasting" },
];

export default function PostDeal() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const venueId = (user as { managedVenueId?: number } | undefined)?.managedVenueId;

  const createDeal = useCreateDeal();
  const publishDeal = usePublishDeal();

  const now = new Date();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "dinner",
    originalPrice: "",
    discountPercent: "30",
    totalSlots: "8",
    hoursFromNow: "2",
    durationHours: "4",
  });

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;
  if (user && (user as { role?: string }).role !== "venue_manager") return <Redirect to="/" />;

  const dealPrice = form.originalPrice
    ? Math.round(parseFloat(form.originalPrice) * (1 - parseInt(form.discountPercent) / 100))
    : 0;

  const handleSubmit = async (e: React.FormEvent, publishNow: boolean) => {
    e.preventDefault();
    if (!venueId) {
      toast({ title: "Error", description: "No managed venue found", variant: "destructive" });
      return;
    }

    const startsAt = addHours(now, parseFloat(form.hoursFromNow));
    const endsAt = addHours(startsAt, parseFloat(form.durationHours));

    createDeal.mutate(
      {
        data: {
          venueId,
          title: form.title,
          description: form.description,
          category: form.category as "lunch" | "dinner" | "brunch" | "treatment" | "class" | "experience" | "drinks" | "tasting",
          originalPrice: form.originalPrice,
          dealPrice: String(dealPrice),
          discountPercent: parseInt(form.discountPercent),
          totalSlots: parseInt(form.totalSlots),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
      },
      {
        onSuccess: (deal) => {
          if (publishNow) {
            publishDeal.mutate(
              { id: deal.id },
              {
                onSuccess: () => {
                  toast({ title: "Deal is live!", description: `${deal.title} is now live.` });
                  setLocation("/venue");
                },
                onError: (err: Error) => {
                  toast({ title: "Publish failed", description: err.message, variant: "destructive" });
                },
              }
            );
          } else {
            toast({ title: "Deal saved", description: "Draft saved. Go live when ready." });
            setLocation("/venue");
          }
        },
        onError: (err: Error) => {
          toast({ title: "Failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const isLoading = createDeal.isPending || publishDeal.isPending;

  return (
    <div className="container py-6 pb-24 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/venue")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Post a Flash Deal</h1>
          <p className="text-muted-foreground text-sm">Fill your dead hours with instant bookings</p>
        </div>
      </div>

      <form className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Signature Tasting Menu for Two"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="What's included? Make it enticing..."
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pricing & Slots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Original Price (KES)</Label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={form.originalPrice}
                  onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Discount %</Label>
                <Select value={form.discountPercent} onValueChange={(v) => setForm({ ...form, discountPercent: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[20, 25, 30, 35, 40, 45, 50].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d}% off</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {dealPrice > 0 && (
              <div className="bg-primary/5 rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">Deal price: </span>
                <span className="font-bold text-primary">KES {dealPrice.toLocaleString()}</span>
                <span className="text-muted-foreground ml-2">per slot</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Available Slots</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={form.totalSlots}
                onChange={(e) => setForm({ ...form, totalSlots: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Starts in (hours)</Label>
                <Select value={form.hoursFromNow} onValueChange={(v) => setForm({ ...form, hoursFromNow: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0.5, 1, 1.5, 2, 3, 4].map((h) => (
                      <SelectItem key={h} value={String(h)}>{h === 0.5 ? "30 min" : `${h}h from now`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (hours)</Label>
                <Select value={form.durationHours} onValueChange={(v) => setForm({ ...form, durationHours: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 8].map((h) => (
                      <SelectItem key={h} value={String(h)}>{h}h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.originalPrice && (
              <p className="text-xs text-muted-foreground">
                Runs {format(addHours(now, parseFloat(form.hoursFromNow)), "h:mm a")} — {format(addHours(addHours(now, parseFloat(form.hoursFromNow)), parseFloat(form.durationHours)), "h:mm a")} today
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isLoading || !form.title || !form.originalPrice}
            onClick={(e) => handleSubmit(e, false)}
          >
            Save Draft
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={isLoading || !form.title || !form.originalPrice}
            onClick={(e) => handleSubmit(e, true)}
          >
            <Zap className="h-4 w-4 mr-2" />
            {isLoading ? "Publishing..." : "Go Live Now"}
          </Button>
        </div>
      </form>
    </div>
  );
}
