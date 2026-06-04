import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, Monitor, Bell, BellOff, Trash2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function getThemePref(): "light" | "dark" | "system" {
  return (localStorage.getItem("nfd_theme") ?? "system") as "light" | "dark" | "system";
}

function applyTheme(pref: "light" | "dark" | "system") {
  const root = document.documentElement;
  if (pref === "dark") { root.classList.add("dark"); root.classList.remove("light"); }
  else if (pref === "light") { root.classList.remove("dark"); root.classList.add("light"); }
  else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
    root.classList.remove("light");
  }
  localStorage.setItem("nfd_theme", pref);
}

export default function Settings() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [theme, setTheme] = useState<"light" | "dark" | "system">(getThemePref);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) setNotifPerm(Notification.permission);
  }, []);

  function handleTheme(t: "light" | "dark" | "system") {
    setTheme(t);
    applyTheme(t);
  }

  async function requestNotifs() {
    if (!("Notification" in window)) { toast({ title: "Not supported", description: "Push notifications aren't available in this browser." }); return; }
    const result = await Notification.requestPermission();
    setNotifPerm(result);
    if (result === "granted") toast({ title: "Notifications enabled!", description: "You'll get alerts for deals near you." });
  }

  function clearSearchHistory() {
    localStorage.removeItem("nfd_recent_searches");
    localStorage.removeItem("nfd_recently_viewed");
    toast({ title: "History cleared", description: "Search history and recently viewed deals removed." });
  }

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;

  const THEMES = [
    { id: "light" as const, label: "Light", Icon: Sun },
    { id: "dark" as const, label: "Dark", Icon: Moon },
    { id: "system" as const, label: "System", Icon: Monitor },
  ];

  return (
    <div className="container max-w-lg py-6 space-y-5 min-h-screen pb-24">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">App preferences</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTheme(id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${
                  theme === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <Icon className={`h-5 w-5 ${theme === id ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-xs font-medium ${theme === id ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {notifPerm === "granted" ? (
                <Bell className="h-5 w-5 text-primary" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Deal alerts</p>
                <p className="text-xs text-muted-foreground">Get notified when new deals go live</p>
              </div>
            </div>
            {notifPerm === "granted" ? (
              <Badge variant="secondary" className="text-green-700 bg-green-100 border-0">On</Badge>
            ) : notifPerm === "denied" ? (
              <Badge variant="outline" className="text-red-700">Blocked</Badge>
            ) : (
              <Button size="sm" onClick={requestNotifs}>Enable</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <button
            type="button"
            onClick={clearSearchHistory}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Clear search & browsing history</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
