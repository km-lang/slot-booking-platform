import { useState } from "react";
import { apiFetch, getStoredUser, getToken, setSession, clearSession } from "../lib/apiClient";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [isLoading, setIsLoading] = useState(false);

  // credentialPayload: { idToken } in production, { email } in dev mode
  const login = async (credentialPayload) => {
    setIsLoading(true);
    try {
      const { token, user: loggedInUser } = await apiFetch("/auth/google", {
        method: "POST",
        body: JSON.stringify(credentialPayload),
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

  const updateUser = (patch) => {
    const updated = { ...user, ...patch };
    setSession(getToken(), updated);
    setUser(updated);
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
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
