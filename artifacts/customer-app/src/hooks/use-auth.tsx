import { useEffect, useState } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useGetAuthMe } from "@workspace/api-client-react";

export const TOKEN_KEY = "nfd_token";

// Initialize the API client with the token getter
setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

export function useAuth() {
  const { data: user, isLoading, error, refetch } = useGetAuthMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && !user && !isLoading && !error) {
      refetch();
    }
    setIsAuthenticated(!!token);
  }, [user, isLoading, error, refetch]);

  const login = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    setIsAuthenticated(true);
    refetch();
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
  };
}
