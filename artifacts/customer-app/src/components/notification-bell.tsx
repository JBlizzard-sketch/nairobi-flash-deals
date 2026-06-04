import { useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { Link } from "wouter";
import { useGetNotificationLog } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { formatDistanceToNowStrict } from "date-fns";

const LS_KEY = "nfd_notif_last_seen";

function getLastSeen(): Date {
  const stored = localStorage.getItem(LS_KEY);
  return stored ? new Date(stored) : new Date(0);
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date>(getLastSeen);

  const { data } = useGetNotificationLog({ limit: 30 }, { query: { enabled: isAuthenticated } });
  const notifications = data?.data ?? [];
  const unread = notifications.filter((n) => new Date(n.sentAt) > lastSeen).length;

  const handleOpen = useCallback((v: boolean) => {
    setOpen(v);
    if (v) {
      const now = new Date();
      localStorage.setItem(LS_KEY, now.toISOString());
      setLastSeen(now);
    }
  }, []);

  if (!isAuthenticated) return null;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="relative text-muted-foreground hover:text-foreground transition-colors" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <Link href="/notifications">
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-primary">
              See all
            </Button>
          </Link>
        </div>
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 10).map((n) => {
                const isNew = new Date(n.sentAt) > lastSeen;
                return (
                  <div key={n.id} className={`px-4 py-3 space-y-0.5 ${isNew ? "bg-primary/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      {isNew && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {formatDistanceToNowStrict(new Date(n.sentAt), { addSuffix: true })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
