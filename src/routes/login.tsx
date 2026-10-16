
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabaseAuth } from "../lib/auth/client";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    const result = signup
      ? await supabaseAuth.auth.signUp({ email, password })
      : await supabaseAuth.auth.signInWithPassword({
          email, password
        });

    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
    } else if (result.data.session) {
      window.location.replace("/");
    } else {
      setMessage("Check your email to confirm your account.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-5 text-white">
      <form onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl bg-slate-900 p-6 border border-slate-700">
        <h1 className="text-2xl font-bold text-center">
          Replay Lab Pro
        </h1>
        <p className="text-center text-slate-400">
          {signup ? "Create your account" : "Welcome back"}
        </p>
        <input type="email" required value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="email"
          className="w-full rounded-lg bg-slate-800 p-3" />
        <input type="password" required minLength={6}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete={signup ? "new-password" : "current-password"}
          className="w-full rounded-lg bg-slate-800 p-3" />
        {message && <p role="status" className="text-sm text-amber-300">{message}</p>}
        <button disabled={busy}
          className="w-full rounded-lg bg-blue-600 p-3 font-bold disabled:opacity-50">
          {busy ? "Please wait..." : signup ? "Sign Up" : "Log In"}
        </button>
        <button type="button"
          onClick={() => { setSignup(!signup); setMessage(""); }}
          className="w-full text-blue-400 text-sm">
          {signup ? "Already registered? Log In" : "Create new account"}
        </button>
      </form>
    </main>
  );
}
