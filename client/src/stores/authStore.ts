import { create } from "zustand";
import type { User } from "@/types/chat";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  setAuth: (user: User, token: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setAuth: (user, token) => {
    localStorage.setItem("evo_token", token);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("evo_token");
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem("evo_token");
    if (token) set({ token, isAuthenticated: true });
  },
}));
