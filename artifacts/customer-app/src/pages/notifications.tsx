import { useState } from "react";
import { useGetNotificationLog } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Bell, Megaphone, Zap, Tag } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const LS_KEY = "nfd_notif_last_seen";

function getLastSeen(): Date {
  const stored = localStorage.getItem(LS_KEY);
  return stored ? new Date(stored) : new Date(0);
}

function channelIcon(channel: string) {
  if (channel === "whatsapp") return <Megaphone className="h-4 w-4 text-green-500" />;
  if (channel === "sms") return <Bell className="h-4 w-4 text-blue-500" />;
  return <Zap className="h-4 w-4 text-primary" />;
}

export default function NotificationsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [lastSeen, setLastSeen] = useState<Date>(getLastSeen);

  function markAllRead() {
    const now = new Date();
    localStorage.setItem(LS_KEY, now.toISOString());
    setLastSeen(now);
  }

  const { data, isLoading } = useGetNotificationLog({ limit: 100 }, { query: { enabled: isAuthenticated } });
  const notifications = data?.data ?? [];

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/auth" />;

  return (
    <div className="container max-w-lg py-6 space-y-4 min-h-screen pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
          </p>
        </div>
        {notifications.some((n) => new Date(n.sentAt) > lastSeen) && (
          <button type="button" className="text-xs text-primary font-medium mt-1 hover:underline" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3 p-4 rounded-xl border">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold">All caught up</h3>
          <p className="text-muted-foreground">You'll get notified when deals near you go live.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const isNew = new Date(n.sentAt) > lastSeen;
            return (
              <div
                key={n.id}
                className={`flex gap-3 p-4 rounded-xl border transition-colors ${isNew ? "bg-primary/5 border-primary/20" : "bg-card"}`}
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {channelIcon(n.channel)}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight">{n.title}</p>
                    {isNew && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] text-muted-foreground/60 capitalize">{n.channel}</span>
                    <span className="text-[10px] text-muted-foreground/40">·</span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {formatDistanceToNowStrict(new Date(n.sentAt), { addSuffix: true })}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40">·</span>
                    <Tag className="h-2.5 w-2.5 text-muted-foreground/40" />
                    <span className="text-[10px] text-muted-foreground/60 capitalize">{n.status}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
