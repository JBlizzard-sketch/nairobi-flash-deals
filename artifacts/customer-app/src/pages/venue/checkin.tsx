import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ScanLine, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface CheckedInBooking {
  id: number;
  confirmationCode: string;
  guestName: string | null;
  guestPhone: string;
  partySize: number;
  dealTitle: string;
  venueName: string;
  status: string;
}

type Result =
  | { ok: true; booking: CheckedInBooking }
  | { ok: false; message: string };

export default function VenueCheckin() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const role = (user as { role?: string } | undefined)?.role;

  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;
  if (role !== "venue_manager" && role !== "admin") return <Redirect to="/" />;

  const handleCheckin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/bookings/checkin-by-code`.replace(/\/+/g, "/").replace(":/", "://"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("nfd_token")}` },
          body: JSON.stringify({ confirmationCode: trimmed }),
        },
      );
      const json = await res.json();
      if (res.ok) {
        setResult({ ok: true, booking: json.booking });
        setCode("");
      } else {
        setResult({ ok: false, message: json.message ?? "Check-in failed" });
      }
    } catch {
      setResult({ ok: false, message: "Network error — please try again" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-md py-8 space-y-6 min-h-screen pb-24">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ScanLine className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Guest Check-In</h1>
        </div>
        <p className="text-muted-foreground text-sm">Enter or scan the customer's confirmation code.</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Confirmation Code</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                placeholder="e.g. NFD-3A7X2"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono text-lg tracking-widest uppercase"
                onKeyDown={(e) => e.key === "Enter" && handleCheckin()}
                maxLength={12}
                autoFocus
              />
              <Button onClick={handleCheckin} disabled={loading || !code.trim()} className="shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check In"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className={result.ok ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "border-destructive/50 bg-destructive/5"}>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className={`flex items-center gap-2 text-base ${result.ok ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
              {result.ok
                ? <><CheckCircle2 className="h-5 w-5" /> Checked In Successfully</>
                : <><XCircle className="h-5 w-5" /> Check-In Failed</>
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {result.ok ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Guest</p>
                    <p className="font-semibold">{result.booking.guestName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-semibold">{result.booking.guestPhone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Deal</p>
                    <p className="font-semibold truncate">{result.booking.dealTitle}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Party Size</p>
                    <p className="font-semibold">{result.booking.partySize}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                    ✓ Checked In
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(), "h:mm a")}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{result.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Confirmation codes are displayed on the customer's bookings page.
        </p>
      </div>
    </div>
  );
}
