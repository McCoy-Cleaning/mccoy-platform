import { createFileRoute } from "@tanstack/react-router";
import { Users, Shield, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminBits";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

const USERS = [
  { name: "Maria Rekp", email: "maria@rekp.ai", role: "Owner", initials: "MR", tone: "from-[#1e88e5] to-[#7c3aed]" },
  { name: "Admin McCoy", email: "admin@mccoy.nl", role: "Admin", initials: "AM", tone: "from-[#22c55e] to-[#84cc16]" },
  { name: "Sander de Boer", email: "sander@mccoy.nl", role: "Editor", initials: "SB", tone: "from-[#f59e0b] to-[#ef4444]" },
];

function UsersPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Users}
        accent="#a78bfa"
        title="Gebruikers"
        subtitle="Wie mag er in het beheer? Hier staan alle teamleden en hun rol."
        actions={[{ label: "Teamlid uitnodigen", icon: UserPlus }]}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {USERS.map((u) => (
          <div
            key={u.email}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
          >
            <div className="flex items-center gap-4">
              <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br ${u.tone} text-base font-bold text-white shadow-lg`}>
                {u.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold tracking-tight">{u.name}</div>
                <div className="truncate text-sm text-white/50">{u.email}</div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-white/85">
                <Shield className="h-4 w-4" />
                {u.role}
              </span>
              <span className="text-sm font-medium text-emerald-300">● Actief</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}