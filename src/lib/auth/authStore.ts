import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabaseClient";

interface AuthState {
  session: Session | null;
  user: User | null;
  /** true once the saved session (if any) has been checked */
  ready: boolean;
  /** true while the user is setting a new password from a reset email */
  recovery: boolean;
  /** Start listening to auth changes; returns an unsubscribe function. */
  init: () => () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  ready: false,
  recovery: false,
  init: () => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      set({
        session: data.session,
        user: data.session?.user ?? null,
        ready: true,
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      set({
        session,
        user: session?.user ?? null,
        ready: true,
        ...(event === "PASSWORD_RECOVERY" ? { recovery: true } : {}),
      });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  },
}));
