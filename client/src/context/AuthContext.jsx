import { useState } from "react";
import { apiFetch, getStoredUser, setSession, clearSession } from "../lib/apiClient";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [isLoading, setIsLoading] = useState(false);

  const login = async (idToken) => {
    setIsLoading(true);
    try {
      const { token, user: loggedInUser } = await apiFetch("/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken }),
      });
      setSession(token, loggedInUser);
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
