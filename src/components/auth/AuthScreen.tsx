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

const glowStyle = {
  background:
    "radial-gradient(60% 45% at 50% 0%, color-mix(in oklab, var(--primary) 24%, transparent), transparent 70%)",
} as const;

function Logo() {
  return (
    <div
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border"
      style={{
        background:
          "linear-gradient(145deg, color-mix(in oklab, var(--primary) 30%, var(--surface)), var(--surface))",
        boxShadow: "0 8px 30px color-mix(in oklab, var(--primary) 28%, transparent)",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <g stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M6 4v16M12 7v13M18 3v14" />
        </g>
        <rect x="4" y="8" width="4" height="7" rx="1" fill="var(--primary)" />
        <rect x="10" y="10" width="4" height="6" rx="1" fill="var(--primary)" opacity=".55" />
        <rect x="16" y="6" width="4" height="7" rx="1" fill="var(--primary)" />
      </svg>
    </div>
  );
}

function Frame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60%]" style={glowStyle} />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo />
          <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Replay Lab Pro
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className="space-y-4 rounded-2xl border border-border bg-surface p-5"
          style={{ boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}
        >
          {children}
        </div>
        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Your trades, drawings and journal sync to your account.
        </p>
      </div>
    </div>
  );
}

function Messages({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-lg border px-3 py-2 text-xs"
          style={{
            color: "var(--destructive)",
            borderColor: "color-mix(in oklab, var(--destructive) 45%, transparent)",
            backgroundColor: "color-mix(in oklab, var(--destructive) 10%, transparent)",
          }}
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground"
          style={{ backgroundColor: "color-mix(in oklab, var(--primary) 8%, transparent)" }}
        >
          {notice}
        </p>
      )}
    </>
  );
}

function PasswordInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  name: string;
  id: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className="panel-input w-full pr-16"
        type={show ? "text" : "password"}
        required
        minLength={8}
        name={props.name}
        id={props.id}
        autoComplete={props.autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function Strength({ password }: { password: string }) {
  const score =
    (password.length >= 8 ? 1 : 0) +
    (password.length >= 12 ? 1 : 0) +
    (/[A-Z]/.test(password) && /[a-z]/.test(password) ? 1 : 0) +
    (/\d/.test(password) || /[^A-Za-z0-9]/.test(password) ? 1 : 0);
  if (!password) return null;
  return (
    <div className="flex gap-1" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="h-1 flex-1 rounded-full"
          style={{
            backgroundColor: i < score ? "var(--primary)" : "var(--border)",
            opacity: i < score ? 0.4 + i * 0.2 : 1,
          }}
        />
      ))}
    </div>
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
    mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password";
  const subtitle =
    mode === "forgot"
      ? "We'll email you a link to set a new one"
      : "ICT Trade Terminal · backtest, journal, review";

  return (
    <Frame title={title} subtitle={subtitle}>
      {mode !== "forgot" && (
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border p-1" role="tablist">
          {(["signin", "signup"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchMode(m)}
                className="rounded-lg py-2 text-sm font-medium transition-colors"
                style={active ? primaryStyle : { color: "var(--muted-foreground)" }}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            );
          })}
        </div>
      )}

      {mode !== "forgot" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {SOCIAL.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                className="touch-btn border border-border text-sm disabled:opacity-50"
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
          className="panel-input w-full"
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
          <PasswordInput
            name="password"
            id="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
            value={password}
            onChange={setPassword}
          />
        )}
        {mode === "signup" && <Strength password={password} />}

        <Messages error={error} notice={notice} />

        <button
          type="submit"
          disabled={busy}
          className="touch-btn w-full text-sm font-semibold disabled:opacity-60"
          style={primaryStyle}
        >
          {busy
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"}
        </button>
      </form>

      <div className="flex justify-center text-xs text-muted-foreground">
        {mode === "signin" && (
          <button type="button" className="underline" onClick={() => switchMode("forgot")}>
            Forgot password?
          </button>
        )}
        {mode === "forgot" && (
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
        <PasswordInput
          name="new-password"
          id="new-password"
          autoComplete="new-password"
          placeholder="New password (8+ characters)"
          value={password}
          onChange={setPassword}
        />
        <Strength password={password} />
        <Messages error={error} notice={null} />
        <button
          type="submit"
          disabled={busy}
          className="touch-btn w-full text-sm font-semibold disabled:opacity-60"
          style={primaryStyle}
        >
          {busy ? "Please wait…" : "Save password"}
        </button>
      </form>
    </Frame>
  );
}
