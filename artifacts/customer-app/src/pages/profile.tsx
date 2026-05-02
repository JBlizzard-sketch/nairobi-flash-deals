import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, User as UserIcon, Phone, Star, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user, isAuthenticated, isLoading, logout: clearAuth } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const logoutMutation = useLogout();

  if (isLoading) return null;
  if (!isAuthenticated || !user) return <Redirect to="/auth" />;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuth();
        toast({ title: "Logged out" });
        setLocation("/");
      }
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="container py-6 space-y-6 min-h-screen pb-24">
      <div className="flex items-center gap-4 mb-8">
        <Avatar className="h-20 w-20 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
            <Phone className="h-3.5 w-3.5" /> {user.phone || 'No phone'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Star className="h-4 w-4" /> Loyalty Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-3xl font-bold capitalize">{user.loyaltyTier}</div>
              <p className="text-sm text-muted-foreground mt-1">Member since {new Date(user.createdAt).getFullYear()}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{user.loyaltyPoints}</div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Points</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Settings className="h-4 w-4" /> Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Subscribed Categories</p>
            <div className="flex flex-wrap gap-2">
              {user.subscriptionCategories?.length > 0 ? (
                user.subscriptionCategories.map(cat => (
                  <Badge key={cat} variant="secondary" className="capitalize">{cat}</Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No preferences set</span>
              )}
            </div>
          </div>
          {user.neighborhoodPref && (
            <div>
              <p className="text-sm font-medium mb-1">Preferred Area</p>
              <p className="text-sm text-muted-foreground capitalize">{user.neighborhoodPref.replace('_', ' ')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button 
        variant="destructive" 
        className="w-full" 
        onClick={handleLogout}
        disabled={logoutMutation.isPending}
      >
        <LogOut className="h-4 w-4 mr-2" /> 
        {logoutMutation.isPending ? "Logging out..." : "Log Out"}
      </Button>
    </div>
  );
}
