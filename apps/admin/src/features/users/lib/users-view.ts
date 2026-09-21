export type PortalUserStatusId = "active" | "invited" | "reminder_scheduled" | "blocked";
export type PortalUserAccountType = "account_admin" | "account_user";

export type PortalUserRow = {
  id: string;
  kind: "member" | "invite";
  userId: string | null;
  invitationId: string | null;
  companyId: string;
  companyName: string;
  fullName: string;
  email: string;
  phone: string | null;
  accountType: PortalUserAccountType;
  accountTypeLabel: "Accountbeheerder" | "Besteller";
  status: {
    id: PortalUserStatusId;
    label: "Actief" | "Uitnodiging verzonden" | "Herinnering ingepland" | "Geblokkeerd";
    tone: "active" | "invited" | "reminder" | "blocked";
  };
  lastLoginAt: string | null;
  lastLoginSource: "dummy" | "none";
  lastOrderAt: string | null;
  lastOrderSource: "company" | "none";
  invitedByName: string | null;
  invitedAt: string | null;
  invitationExpiresAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  activatedAt: string | null;
  canRemind: boolean;
  canBlock: boolean;
  canResetInvite: boolean;
  blocked: boolean;
};

export type PortalUsersScanBound = {
  scanned: number;
  total: number;
  truncated: boolean;
};

export type PortalUsersTruncation = {
  truncated: boolean;
  memberships: PortalUsersScanBound;
  invitations: PortalUsersScanBound;
  companies: PortalUsersScanBound;
};

export type PortalUsersKpis = {
  activeUsers: number;
  awaitingActivation: number;
  accountAdmins: number;
  orderers: number;
  activeCreatedLast7Days: number;
  activeCreatedPrevious7Days: number;
};

export type PortalUserTimelineStep = {
  id: "invited" | "reminded" | "activated";
  label: string;
  at: string | null;
  state: "done" | "current" | "upcoming";
  /** Actor or pending copy, e.g. "door Maria de Vries", "Automatisch", "In afwachting". */
  detail: string | null;
};

export function personInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function formatNlDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
      .format(d)
      .replace(/\./g, "");
  } catch {
    return "—";
  }
}

export function formatNlDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(d)
      .replace(/\./g, "");
  } catch {
    return "—";
  }
}

export function formatNlNumber(n: number): string {
  try {
    return new Intl.NumberFormat("nl-NL").format(n);
  } catch {
    return String(n);
  }
}

export function kpiTrend(
  current: number,
  previous: number,
): { delta: string; tone: "up" | "down" | "neutral" } {
  if (previous === 0) {
    if (current === 0) return { delta: "0%", tone: "neutral" };
    return { delta: "nieuw", tone: "up" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { delta: `+${pct}%`, tone: "up" };
  if (pct < 0) return { delta: `${pct}%`, tone: "down" };
  return { delta: "0%", tone: "neutral" };
}

/**
 * A capped read must be visible. Returning null keeps the banner off screen for the
 * normal case; any other result means the list and the KPIs above it are incomplete
 * and must say so rather than looking authoritative.
 */
export function truncationNoticeNl(
  truncation: PortalUsersTruncation | null | undefined,
): string | null {
  if (!truncation?.truncated) return null;
  const parts: string[] = [];
  const describe = (bound: PortalUsersScanBound, noun: string) => {
    if (!bound.truncated) return;
    parts.push(`${formatNlNumber(bound.scanned)} van ${formatNlNumber(bound.total)} ${noun}`);
  };
  describe(truncation.memberships, "gebruikerskoppelingen");
  describe(truncation.invitations, "uitnodigingen");
  describe(truncation.companies, "bedrijven");
  if (parts.length === 0) return null;
  return `Onvolledig overzicht: alleen de eerste ${parts.join(
    ", ",
  )} zijn geladen. De lijst, het aantal treffers en de kerncijfers tellen de rest niet mee. Filter op bedrijf of zoek gerichter voor een volledig beeld.`;
}

/** Never falls back to another user when the selected id is missing. */
export function selectedPortalUserRow<T extends { id: string }>(
  items: readonly T[],
  selectedId: string | undefined | null,
): T | null {
  if (!selectedId) return null;
  return items.find((item) => item.id === selectedId) ?? null;
}

export function buildRegistrationTimeline(row: Pick<
  PortalUserRow,
  "invitedAt" | "lastReminderAt" | "reminderCount" | "activatedAt" | "status" | "invitedByName"
>): PortalUserTimelineStep[] {
  const remindedDone = Boolean(row.lastReminderAt) || row.reminderCount > 0;
  const activatedDone = row.status.id === "active" || Boolean(row.activatedAt);
  const invitedDone = Boolean(row.invitedAt) || remindedDone || activatedDone;
  const invitedBy = row.invitedByName?.trim();
  return [
    {
      id: "invited",
      label: "Uitnodiging verzonden",
      at: row.invitedAt,
      state: invitedDone ? "done" : "current",
      detail: invitedDone && invitedBy ? `door ${invitedBy}` : null,
    },
    {
      id: "reminded",
      label: "Herinnering gestuurd",
      at: row.lastReminderAt,
      state: remindedDone ? "done" : invitedDone ? "current" : "upcoming",
      detail: remindedDone ? "Automatisch" : null,
    },
    {
      id: "activated",
      label: "Account geactiveerd",
      at: row.activatedAt,
      state: activatedDone ? "done" : "upcoming",
      detail: activatedDone ? null : "In afwachting",
    },
  ];
}

export type PortalUserKpiIcon = "users" | "clock" | "shield" | "box";

export type PortalUserKpiCard = {
  id: "active" | "awaiting" | "admins" | "orderers";
  label: string;
  value: number;
  helper: string;
  trend: string | null;
  tone: "up" | "down" | "neutral";
  icon: PortalUserKpiIcon;
  well: string;
};

export function mapPortalUserKpiCards(kpis: PortalUsersKpis): PortalUserKpiCard[] {
  const trend = kpiTrend(kpis.activeCreatedLast7Days, kpis.activeCreatedPrevious7Days);
  return [
    {
      id: "active",
      label: "Actieve gebruikers",
      value: kpis.activeUsers,
      helper: trend.delta === "nieuw" ? "nieuw deze week" : "t.o.v. vorige week",
      trend: trend.delta,
      tone: trend.tone,
      icon: "users",
      well: "bg-emerald-500/15 text-emerald-400",
    },
    {
      id: "awaiting",
      label: "Wacht op activatie",
      value: kpis.awaitingActivation,
      helper: "openstaande uitnodigingen",
      trend: null,
      tone: "neutral",
      icon: "clock",
      well: "bg-violet-500/15 text-violet-400",
    },
    {
      id: "admins",
      label: "Accountbeheerders",
      value: kpis.accountAdmins,
      helper: "één eigenaar per bedrijf",
      trend: null,
      tone: "neutral",
      icon: "shield",
      well: "bg-sky-500/15 text-sky-400",
    },
    {
      id: "orderers",
      label: "Bestellers",
      value: kpis.orderers,
      helper: "bestelaccounts",
      trend: null,
      tone: "neutral",
      icon: "box",
      well: "bg-amber-500/15 text-amber-400",
    },
  ];
}

export function portalUserStatusDotClass(tone: string): string {
  if (tone === "active") return "bg-emerald-400";
  if (tone === "invited") return "bg-amber-400";
  if (tone === "reminder") return "bg-violet-400";
  if (tone === "blocked") return "bg-rose-500";
  return "bg-violet-400";
}

export function portalUserStatusTextClass(tone: string): string {
  if (tone === "active") return "text-emerald-400";
  if (tone === "invited") return "text-amber-400";
  if (tone === "reminder") return "text-violet-400";
  if (tone === "blocked") return "text-rose-400";
  return "text-violet-400";
}

export function isAccountAdmin(type: string): boolean {
  return type === "account_admin";
}

/**
 * Route param for /users/$userId. Always the directory id (`m:companyId:userId` or
 * `i:invitationId`): a bare user id loses the company scope, and the server then has to
 * guess which membership was meant for users that belong to more than one company.
 */
export function userDetailsParam(row: Pick<PortalUserRow, "id" | "userId">): string {
  return row.id;
}
