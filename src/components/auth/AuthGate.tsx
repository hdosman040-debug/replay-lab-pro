import { useEffect, type ReactNode } from "react";

import "@/lib/auth/resetStores";
import { useAuthStore } from "@/lib/auth/authStore";

import { AuthScreen, NewPasswordScreen } from "./AuthScreen";

/** Shows sign in / sign up until a user is signed in, then the app. */
export function AuthGate({ children }: { children: ReactNode }) {
  const init = useAuthStore((s) => s.init);
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const recovery = useAuthStore((s) => s.recovery);

  useEffect(() => init(), [init]);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (user && recovery) return <NewPasswordScreen />;
  if (!user) return <AuthScreen />;
  return <>{children}</>;
}
