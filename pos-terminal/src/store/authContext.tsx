import { useState, ReactNode } from "react";
import { DbUser, authenticatePin } from "../lib/authService";
import { AuthContext } from "./AuthContextObject";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DbUser | null>(null);

  const login = async (pin: string): Promise<boolean> => {
    const authenticatedUser = await authenticatePin(pin);

    if (authenticatedUser) {
      setUser(authenticatedUser);
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
  };

  const switchUser = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        switchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
