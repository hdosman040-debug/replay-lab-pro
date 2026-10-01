import type { Provider } from "@supabase/supabase-js";
import { useState, type FormEvent, type ReactNode } from "react";

import { useAuthStore } from "@/lib/auth/authStore";
import { supabase } from "@/lib/supabaseClient";

type Mode = "signin" | "signup" | "forgot";

const SOCIAL: ReadonlyArray<{ id: string; label: string }> = [
  { id: "github", label: "GitHub" },
  { id: "google", label: "Google" },
];

const primaryStyle = {
  backgroundColor: "var(--primary)",
  color: "var(--primary-foreground)",
} as const;

function Frame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function Messages({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && (
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs" style={{ color: "var(--destructive)" }}>
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </p>
      )}
    </>
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
      } else if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (!data.session) {
          setNotice("Check your email and open the confirmation link, then sign in.");
        }
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (authError) throw authError;
        setNotice("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onSocial(id: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: id as unknown as Provider,
      options: { redirectTo: window.location.origin },
    });
    if (authError) {
      setError(authError.message);
      setBusy(false);
    }
  }

  const title =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset password";

  return (
    <Frame title={title} subtitle="ICT Trade Terminal · your trades and charts, synced">
      {mode !== "forgot" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {SOCIAL.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                className="touch-btn border border-border bg-surface text-sm"
                onClick={() => void onSocial(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or use email
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <input
          className="panel-input"
          type="email"
          required
          name="email"
          id="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode !== "forgot" && (
          <input
            className="panel-input"
            type="password"
            required
            minLength={8}
            name="password"
            id="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        <Messages error={error} notice={notice} />

        <button
          type="submit"
          disabled={busy}
          className="touch-btn w-full text-sm font-medium"
          style={primaryStyle}
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
      </form>

      <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
        {mode === "signin" && (
          <>
            <button type="button" className="underline" onClick={() => switchMode("forgot")}>
              Forgot password?
            </button>
            <button type="button" className="underline" onClick={() => switchMode("signup")}>
              New here? Create an account
            </button>
          </>
        )}
        {mode !== "signin" && (
          <button type="button" className="underline" onClick={() => switchMode("signin")}>
            Back to sign in
          </button>
        )}
      </div>
    </Frame>
  );
}

export function NewPasswordScreen() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      useAuthStore.setState({ recovery: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame title="Choose a new password" subtitle="You opened a password reset link">
      <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <input
          className="panel-input"
          type="password"
          required
          minLength={8}
          name="new-password"
          id="new-password"
          autoComplete="new-password"
          placeholder="New password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Messages error={error} notice={null} />
        <button type="submit" disabled={busy} className="touch-btn w-full text-sm font-medium" style={primaryStyle}>
          {busy ? "Please wait…" : "Save password"}
        </button>
      </form>
    </Frame>
  );
}
