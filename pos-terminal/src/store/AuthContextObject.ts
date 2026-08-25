import { createContext } from "react";
import { DbUser } from "../lib/authService";

export interface AuthContextType {
  user: DbUser | null;
  isAuthenticated: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  switchUser: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
