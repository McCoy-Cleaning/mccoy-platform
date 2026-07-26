import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { Sparkles, Lock, User, ArrowRight } from "lucide-react";
import { signInAdmin, useAdminSession, ADMIN_DEMO_CREDENTIALS } from "@/lib/admin-auth";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Inloggen — McCoy Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const { session, ready } = useAdminSession();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (ready && session) navigate({ to: "/admin", replace: true });
  }, [ready, session, navigate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setTimeout(() => {
      const ok = signInAdmin(username, password);
      if (!ok) {
        setError("Onjuiste gebruikersnaam of wachtwoord.");
        setBusy(false);
        return;
      }
      navigate({ to: "/admin", replace: true });
    }, 400);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[#1e88e5]/25 blur-[160px]" />
        <div className="absolute bottom-0 right-0 h-[30rem] w-[30rem] rounded-full bg-[#7c3aed]/20 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:32px_32px] opacity-30" />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#1e88e5] to-[#7c3aed] shadow-2xl shadow-[#1e88e5]/40">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">McCoy Admin</h1>
          <p className="mt-1 text-sm text-white/60">Log in om het control center te openen</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl"
        >
          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-medium text-white/70">Gebruikersnaam</span>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-black/30 px-10 py-2.5 text-sm text-white outline-none transition focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
                placeholder="admin"
              />
            </div>
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-medium text-white/70">Wachtwoord</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-black/30 px-10 py-2.5 text-sm text-white outline-none transition focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
                placeholder="••••••••"
              />
            </div>
          </label>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e88e5] to-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1e88e5]/30 transition hover:shadow-[#1e88e5]/50 disabled:opacity-60"
          >
            {busy ? "Bezig..." : "Inloggen"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <div className="mt-5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-white/50">
            <span className="font-semibold text-white/70">Demo credentials:</span>{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-white/80">{ADMIN_DEMO_CREDENTIALS.username}</code>
            {" / "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-white/80">{ADMIN_DEMO_CREDENTIALS.password}</code>
          </div>
        </form>
      </div>
    </div>
  );
}