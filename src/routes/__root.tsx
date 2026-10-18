import { supabaseAuth } from "../lib/auth/client";
import { createContext } from "react";
import {
  setStorageUser,
  getStorageUser,
  flushAndVerifySaves,
} from "../lib/store/supabaseStorage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useSettingsStore } from "../lib/store/settingsStore";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Replay Lab Pro" },
      { name: "description", content: "Professional historical trading replay, backtesting and journaling." },
      { name: "author", content: "Replay Lab Pro" },
      { property: "og:title", content: "Replay Lab Pro" },
      { property: "og:description", content: "Professional historical trading replay, backtesting and journaling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/replay-lab-icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/replay-lab-icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


export const LogoutContext = createContext<{
  logOut: () => Promise<void>;
  loggingOut: boolean;
  logoutError: string | null;
} | null>(null);

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let initialized = false;

    const { data: listener } = supabaseAuth.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;

        const nextUserId = session?.user.id ?? null;
        const previousUserId = getStorageUser();

        if (initialized && previousUserId !== nextUserId) {
          // A full reload clears account-specific Zustand state.
          setStorageUser(null);
          window.location.reload();
          return;
        }

        if (event === "INITIAL_SESSION") {
          initialized = true;
        }

        setStorageUser(nextUserId);
        setSignedIn(!!session);
        setAuthReady(true);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authReady && !signedIn &&
        !window.location.pathname.startsWith("/login")) {
      router.navigate({ to: "/login" });
    }
  }, [authReady, signedIn, router]);

  const logOut = async () => {
                if (loggingOut) return;
                setLoggingOut(true);
                setLogoutError(null);

                try {
                  await flushAndVerifySaves();

                  const { error } = await supabaseAuth.auth.signOut();
                  if (error) throw error;

                  window.location.replace("/login");
                } catch (error) {
                  console.error("[auth] Logout blocked:", error);
                  setLogoutError(
                    error instanceof Error
                      ? error.message
                      : "Unable to log out safely. Please retry.",
                  );
                  setLoggingOut(false);
                }
  };

  const theme = useSettingsStore((s) => s.settings.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      {!authReady ? (
        <div className="p-6">Loading...</div>
      ) : signedIn || window.location.pathname.startsWith("/login") ? (
        <>
          {loggingOut ? (
            <div
              className="flex min-h-screen items-center justify-center p-6"
              role="status"
            >
              Saving changes before logout...
            </div>
          ) : (
            <LogoutContext.Provider value={{ logOut, loggingOut, logoutError }}>
              <Outlet />
            </LogoutContext.Provider>
          )}
        </>
      ) : null}
    </QueryClientProvider>
  );
}
