import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/logo-mccoy.png";
import { accountLogout } from "@/lib/api/account.functions";

export function AccountShell({
  children,
  companyName,
  userName,
}: {
  children: ReactNode;
  companyName?: string | null;
  userName?: string | null;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="McCoy" className="h-8 w-auto" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Klantenportaal</p>
              {companyName ? (
                <p className="text-xs text-slate-500">{companyName}</p>
              ) : null}
            </div>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/account"
              className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              Dashboard
            </Link>
            <Link
              to="/account/company"
              className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              Bedrijf
            </Link>
            <Link
              to="/account/login"
              className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
              onClick={() => {
                void accountLogout().catch(() => undefined);
              }}
            >
              Uitloggen
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {userName ? (
          <p className="mb-6 text-sm text-slate-600">Welkom, {userName}</p>
        ) : null}
        {children}
      </main>
    </div>
  );
}

export function CustomerStatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-700">
      {label}
    </span>
  );
}
