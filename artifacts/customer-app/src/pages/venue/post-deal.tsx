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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, Check, Zap, Utensils, Dumbbell, Wine, Sparkles, Coffee, UtensilsCrossed, Leaf, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addHours, format } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "lunch",      label: "Lunch",       icon: Utensils },
  { value: "dinner",     label: "Dinner",      icon: UtensilsCrossed },
  { value: "brunch",     label: "Brunch",      icon: Coffee },
  { value: "treatment",  label: "Spa",         icon: Leaf },
  { value: "class",      label: "Fitness",     icon: Dumbbell },
  { value: "experience", label: "Experience",  icon: Sparkles },
  { value: "drinks",     label: "Drinks",      icon: Wine },
  { value: "tasting",    label: "Tasting",     icon: Music },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STEPS = [
  { label: "Type" },
  { label: "Pricing" },
  { label: "Schedule" },
];

export default function PostDeal() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const venueId = (user as { managedVenueId?: number } | undefined)?.managedVenueId;

  const createDeal = useCreateDeal();
  const publishDeal = usePublishDeal();

  const now = new Date();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "dinner",
    originalPrice: "",
    discountPercent: "30",
    totalSlots: "8",
    hoursFromNow: "2",
    durationHours: "4",
    isStanding: false,
    standingDays: [] as number[],
    standingStartHour: "14",
    standingEndHour: "17",
  });

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;
  if (user && (user as { role?: string }).role !== "venue_manager") return <Redirect to="/" />;

  const dealPrice = form.originalPrice
    ? Math.round(parseFloat(form.originalPrice) * (1 - parseInt(form.discountPercent) / 100))
    : 0;

  const isLoading = createDeal.isPending || publishDeal.isPending;
  const step1Valid = form.category && form.title.trim().length >= 3;
  const step2Valid = form.originalPrice && parseInt(form.totalSlots) >= 1;
  const step3Valid = true;

  const handlePublish = (publishNow: boolean) => {
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
          ...(form.isStanding && {
            isStanding: true,
            standingDaysOfWeek: form.standingDays,
            standingStartHour: parseInt(form.standingStartHour),
            standingEndHour: parseInt(form.standingEndHour),
          }),
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
                onError: (err: Error) => toast({ title: "Publish failed", description: err.message, variant: "destructive" }),
              }
            );
          } else {
            toast({ title: "Deal saved", description: "Draft saved. Go live when ready." });
            setLocation("/venue");
          }
        },
        onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
      }
    );
  };

  const cat = CATEGORIES.find((c) => c.value === form.category);
  const startsAt = addHours(now, parseFloat(form.hoursFromNow));
  const endsAt = addHours(startsAt, parseFloat(form.durationHours));

  return (
    <div className="container py-6 pb-24 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : setLocation("/venue"))}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Post a Flash Deal</h1>
          <p className="text-muted-foreground text-sm">Fill dead hours with instant bookings</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 px-2">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = step > n;
          const active = step === n;
          return (
            <div key={s.label} className="flex items-center gap-1 flex-1">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                done ? "bg-primary text-primary-foreground" : active ? "bg-primary/20 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              <span className={cn("text-xs font-medium", active ? "text-primary" : "text-muted-foreground")}>{s.label}</span>
              {i < STEPS.length - 1 && <div className={cn("flex-1 h-px mx-1", done ? "bg-primary" : "bg-border")} />}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Type ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold mb-3">What kind of deal?</p>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, category: c.value })}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all",
                    form.category === c.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  <c.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-tight">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Deal Title</Label>
            <Input
              placeholder={`e.g. Signature ${cat?.label ?? "Deal"} for Two`}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">{form.title.length}/80</p>
          </div>
          <div className="space-y-2">
            <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="What's included? Make it irresistible..."
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={300}
            />
          </div>
          <Button
            className="w-full"
            disabled={!step1Valid}
            onClick={() => setStep(2)}
          >
            Next: Pricing <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Pricing ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Original Price (KES)</Label>
              <Input
                type="number"
                placeholder="5000"
                value={form.originalPrice}
                onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Discount</Label>
              <Select value={form.discountPercent} onValueChange={(v) => setForm({ ...form, discountPercent: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[20, 25, 30, 35, 40, 45, 50].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d}% off</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {dealPrice > 0 && (
            <div className="flex items-center gap-3 bg-primary/5 rounded-xl p-4">
              <div>
                <p className="text-xs text-muted-foreground">Customer pays</p>
                <p className="text-2xl font-bold text-primary">KES {dealPrice.toLocaleString()}</p>
              </div>
              <Badge variant="destructive" className="ml-auto text-sm font-bold">-{form.discountPercent}%</Badge>
            </div>
          )}
          <div className="space-y-2">
            <Label>Available Slots</Label>
            <div className="flex gap-2">
              {[4, 6, 8, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, totalSlots: String(n) })}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors",
                    form.totalSlots === String(n) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/40"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Standing deal toggle */}
          <Card className="border-dashed">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Repeat Weekly</p>
                  <p className="text-xs text-muted-foreground">Auto-activates on a fixed schedule</p>
                </div>
                <Switch
                  checked={form.isStanding}
                  onCheckedChange={(v) => setForm({ ...form, isStanding: v })}
                />
              </div>
              {form.isStanding && (
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Days of week</p>
                    <div className="flex gap-1.5">
                      {DAYS.map((day, i) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setForm({ ...form, standingDays: form.standingDays.includes(i) ? form.standingDays.filter((d) => d !== i) : [...form.standingDays, i] })}
                          className={cn(
                            "flex-1 py-1.5 rounded text-[11px] font-semibold transition-colors",
                            form.standingDays.includes(i) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Start hour</p>
                      <Select value={form.standingStartHour} onValueChange={(v) => setForm({ ...form, standingStartHour: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 16 }, (_, i) => i + 7).map((h) => (
                            <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">End hour</p>
                      <Select value={form.standingEndHour} onValueChange={(v) => setForm({ ...form, standingEndHour: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 16 }, (_, i) => i + 8).map((h) => (
                            <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
            <Button className="flex-1" disabled={!step2Valid} onClick={() => setStep(3)}>
              Next: Schedule <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Schedule ── */}
      {step === 3 && (
        <div className="space-y-5">
          {!form.isStanding && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Starts in</Label>
                <Select value={form.hoursFromNow} onValueChange={(v) => setForm({ ...form, hoursFromNow: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0.5, 1, 1.5, 2, 3, 4].map((h) => (
                      <SelectItem key={h} value={String(h)}>{h === 0.5 ? "30 min" : `${h}h from now`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={form.durationHours} onValueChange={(v) => setForm({ ...form, durationHours: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 8].map((h) => (
                      <SelectItem key={h} value={String(h)}>{h}h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Preview card */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant="destructive" className="mb-2">-{form.discountPercent}%</Badge>
                  {form.isStanding && <Badge className="ml-2 mb-2 bg-purple-500 text-white border-none">Repeating</Badge>}
                  <h3 className="font-bold text-lg leading-tight">{form.title || "Your deal title"}</h3>
                  <p className="text-muted-foreground text-sm capitalize mt-0.5">{cat?.label ?? form.category}</p>
                </div>
                <cat.icon className="h-8 w-8 text-primary/60 shrink-0 mt-1" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-primary">
                  KES {dealPrice > 0 ? dealPrice.toLocaleString() : "—"}
                </span>
                {form.originalPrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    KES {parseInt(form.originalPrice).toLocaleString()}
                  </span>
                )}
              </div>
              {!form.isStanding && form.originalPrice && (
                <p className="text-xs text-muted-foreground">
                  {format(startsAt, "h:mm a")} — {format(endsAt, "h:mm a")} today · {form.totalSlots} slots
                </p>
              )}
              {form.isStanding && form.standingDays.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Every {form.standingDays.map((d) => DAYS[d]).join(", ")} · {form.standingStartHour}:00–{form.standingEndHour}:00 · {form.totalSlots} slots
                </p>
              )}
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={isLoading || !step3Valid}
              onClick={() => handlePublish(false)}
            >
              Save Draft
            </Button>
            <Button
              className="flex-1"
              disabled={isLoading || !step3Valid}
              onClick={() => handlePublish(true)}
            >
              <Zap className="h-4 w-4 mr-1.5" />
              {isLoading ? "Publishing..." : "Go Live"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

      {/* ── DEAD BLOCK — kept for reference only, never reached ── */}
      {false && (
        <form className="space-y-5">
          <Card>
            <CardContent className="space-y-4">
              {/* ── Step 1 original form REMOVED — replaced by wizard ── */}
            </CardContent>
          </Card>
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
