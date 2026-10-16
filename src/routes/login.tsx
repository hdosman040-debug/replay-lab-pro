import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabaseAuth } from "../lib/auth/client";

export const Route = createFileRoute("/login")({
  component: Login,
});

type Mode = "signin" | "signup" | "forgot" | "reset";

function Login() {
  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "reset"
      ? "reset"
      : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: listener } = supabaseAuth.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY") {
          setMode("reset");
          setRecoveryReady(true);
          setError("");
        }
        if (
          event === "INITIAL_SESSION" &&
          session &&
          new URLSearchParams(window.location.search).get("mode") === "reset"
        ) {
          setRecoveryReady(true);
        }
      }
    );

    // A recovery link establishes a temporary authenticated session.
    // Check it as well in case the auth event arrived before this page mounted.
    if (new URLSearchParams(window.location.search).get("mode") === "reset") {
      void supabaseAuth.auth.getSession().then(({ data }) => {
        if (active && data.session) setRecoveryReady(true);
      });
    }

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    setMessage("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "forgot") {
        const redirectTo =
          `${window.location.origin}/login?mode=reset`;

        const { error: authError } =
          await supabaseAuth.auth.resetPasswordForEmail(
            email.trim(),
            { redirectTo }
          );

        if (authError) throw authError;

        setMessage(
          "If an account exists for this email, a password reset link will be sent. Check your inbox and spam folder."
        );
      } else if (mode === "reset") {
        if (!recoveryReady) {
          throw new Error(
            "Your recovery session is not ready. Open the latest password reset link from your email."
          );
        }

        if (password.length < 8) {
          throw new Error("Use at least 8 characters.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const { error: authError } =
          await supabaseAuth.auth.updateUser({ password });

        if (authError) throw authError;

        setMessage("Password updated. Opening your workspace...");
        window.location.replace("/");
      } else if (mode === "signup") {
        const { data, error: authError } =
          await supabaseAuth.auth.signUp({
            email: email.trim(),
            password,
          });

        if (authError) throw authError;

        if (data.session) {
          window.location.replace("/");
        } else {
          setMessage(
            "Account created. Check your email for a confirmation link."
          );
        }
      } else {
        const { error: authError } =
          await supabaseAuth.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (authError) throw authError;
        window.location.replace("/");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = {
    signin: "Welcome back",
    signup: "Create your account",
    forgot: "Reset your password",
    reset: "Choose a new password",
  };

  const descriptions: Record<Mode, string> = {
    signin: "Sign in to continue your trading research.",
    signup: "Start building your personal replay workspace.",
    forgot: "We'll email you a secure password reset link.",
    reset: "Secure your account with a new password.",
  };

  const buttonLabels: Record<Mode, string> = {
    signin: "Sign in to workspace",
    signup: "Create account",
    forgot: "Send reset link",
    reset: "Update password",
  };

  const fieldClass =
    "w-full rounded-xl border border-white/10 bg-[#151a22] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/10";

  return (
    <main className="min-h-screen bg-[#090d13] text-white lg:grid lg:grid-cols-2">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-white/10 bg-[#101720] p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 top-24 h-[540px] w-[540px] rounded-full bg-amber-500/[0.07] blur-[110px]"
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-xl font-bold text-amber-400">
            R
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">
              Replay Lab <span className="text-amber-400">Pro</span>
            </div>
            <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-slate-500">
              Trading research terminal
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Your trading edge starts here
          </div>

          <h1 className="text-5xl font-bold leading-[1.12] tracking-tight xl:text-6xl">
            Replay the market.
            <br />
            <span className="text-amber-400">Refine your edge.</span>
          </h1>

          <p className="mt-7 max-w-md text-base leading-8 text-slate-400">
            Study historical price action, review every decision,
            and build consistency through structured trading research.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-3">
            {[
              ["01", "Market replay"],
              ["02", "Trade journal"],
              ["03", "Performance insights"],
            ].map(([number, label]) => (
              <div
                key={number}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
              >
                <div className="mb-3 font-mono text-sm text-amber-400">
                  {number}
                </div>
                <div className="text-sm font-medium text-slate-200">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs tracking-wide text-slate-500">
          REPLAY LAB PRO · YOUR PRIVATE TRADING WORKSPACE
        </p>
      </section>

      <section className="flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:px-16">
        <div className="flex items-center gap-3 lg:justify-end">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 font-bold text-slate-950 lg:hidden">
            R
          </div>
          <span className="text-base font-bold lg:hidden">
            Replay Lab <span className="text-amber-400">Pro</span>
          </span>
          <span className="ml-auto rounded-full border border-white/10 px-3 py-1.5 text-[11px] uppercase tracking-widest text-slate-400 lg:ml-0">
            Secure access
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12">
          <div className="mb-9">
            <div className="mb-5 h-1 w-10 rounded-full bg-amber-400" />
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
              Your workspace
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {titles[mode]}
            </h2>
            <p className="mt-3 leading-6 text-slate-400">
              {descriptions[mode]}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            {mode !== "reset" && (
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Email address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={fieldClass}
                />
              </div>
            )}

            {mode !== "forgot" && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="auth-password"
                    className="text-sm font-medium text-slate-200"
                  >
                    {mode === "reset" ? "New password" : "Password"}
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={mode === "reset" ? 8 : 6}
                    autoComplete={
                      mode === "signin"
                        ? "current-password"
                        : "new-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`${fieldClass} pr-20`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}

            {mode === "reset" && (
              <div>
                <label
                  htmlFor="auth-confirm"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Confirm new password
                </label>
                <input
                  id="auth-confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  className={fieldClass}
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm leading-6 text-rose-300"
              >
                {error}
              </div>
            )}

            {message && (
              <div
                role="status"
                className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-300"
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || (mode === "reset" && !recoveryReady)}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-bold text-[#121820] transition hover:bg-amber-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? "Please wait..."
                : mode === "reset" && !recoveryReady
                  ? "Verifying recovery link..."
                  : buttonLabels[mode]}
              {!busy && <span className="ml-2" aria-hidden="true">→</span>}
            </button>

            <div className="pt-3 text-center text-sm text-slate-400">
              {mode === "signin" ? (
                <>
                  New to Replay Lab Pro?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="font-semibold text-amber-400 hover:text-amber-300"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (mode === "reset") {
                      window.location.replace("/login");
                    } else {
                      switchMode("signin");
                    }
                  }}
                  className="font-semibold text-amber-400 hover:text-amber-300"
                >
                  ← Back to sign in
                </button>
              )}
            </div>
          </form>

          <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs leading-6 text-slate-500">
            Secure authentication powered by Supabase
            <br />
            Your journal and replay sessions stay account-specific.
          </div>
        </div>
      </section>
    </main>
  );
}
