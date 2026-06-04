import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useListAdminUsers } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowLeft, Users, Phone, Shield, Crown } from "lucide-react";

const ROLE_FILTERS = [
  { id: undefined, label: "All" },
  { id: "customer", label: "Customers" },
  { id: "venue_manager", label: "Managers" },
  { id: "admin", label: "Admins" },
] as const;

const ROLE_BADGE: Record<string, string> = {
  customer:      "bg-blue-100 text-blue-800 border-0",
  venue_manager: "bg-purple-100 text-purple-800 border-0",
  admin:         "bg-red-100 text-red-800 border-0",
};

const TIER_BADGE: Record<string, string> = {
  bronze:   "bg-amber-100 text-amber-800 border-0",
  silver:   "bg-slate-100 text-slate-700 border-0",
  gold:     "bg-yellow-100 text-yellow-800 border-0",
  platinum: "bg-cyan-100 text-cyan-800 border-0",
};

type AdminUser = {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  role: string;
  loyalty_tier: string;
  loyalty_points: number;
  created_at: string;
};

export default function AdminUsers() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [activeRole, setActiveRole] = useState<"customer" | "venue_manager" | "admin" | undefined>(undefined);

  if (!isAuthenticated) return <Redirect to="/auth" />;
  if (user?.role !== "admin") return <Redirect to="/" />;

  const { data, isLoading } = useListAdminUsers(
    { role: activeRole, limit: 50 },
    { query: { enabled: true } }
  );

  const users = (data as { data?: AdminUser[] } | undefined)?.data ?? [];

  return (
    <div className="container py-6 pb-24 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> User Management
          </h1>
          <p className="text-muted-foreground text-sm">Manage platform users and permissions</p>
        </div>
      </div>

      {/* Role filter */}
      <ScrollArea className="w-full whitespace-nowrap mb-5">
        <div className="flex gap-2">
          {ROLE_FILTERS.map((f) => (
            <Button
              key={String(f.id)}
              variant={activeRole === f.id ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setActiveRole(f.id as typeof activeRole)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => <Skeleton key={n} className="h-20 rounded-xl" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No users found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{u.name ?? "—"}</p>
                      <Badge className={ROLE_BADGE[u.role] ?? "border-0"}>
                        {u.role === "admin" ? <><Crown className="h-3 w-3 mr-1" />Admin</> :
                         u.role === "venue_manager" ? <><Shield className="h-3 w-3 mr-1" />Manager</> :
                         u.role}
                      </Badge>
                      <Badge className={TIER_BADGE[u.loyalty_tier] ?? "border-0"}>
                        {u.loyalty_tier}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" /> {u.phone}
                    </p>
                    {u.email && (
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-primary">{u.loyalty_points.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">pts</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(u.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
