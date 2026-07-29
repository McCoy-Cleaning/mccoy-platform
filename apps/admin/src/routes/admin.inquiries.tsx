import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
  Inbox,
  Briefcase,
  GlassWater,
  Sofa,
  HelpCircle,
  Search,
  ArrowLeft,
  Send,
  Loader2,
  RefreshCw,
  Mail,
  AlertTriangle,
  Paperclip,
  Download,
  MessageSquare,
} from "lucide-react";
import { PageHeader } from "@/components/admin/AdminBits";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getAdminFormInboxAttachment,
  getAdminFormInboxMessage,
  getAdminFormInboxThread,
  listAdminFormInbox,
  markAdminRequestsNotificationsRead,
  replyAdminFormInboxMessage,
} from "@/lib/api/admin-requests.functions";
import { refreshAdminRequestsUnreadBadge } from "@/lib/requests/unread-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KIND_LABELS, FIELD_LABELS_NL } from "@/lib/requests/labels";
import type { FormKind } from "@/lib/forms/types";
import type {
  FormInboxAttachment,
  FormInboxMessage,
  FormInboxMessageSummary,
  FormInboxThreadItem,
  InboxScopeFacet,
} from "@mccoy/email/contracts";
import { FORM_KINDS } from "@mccoy/domain";

type KindFilter = FormKind | "all";
type ScopeFilter = string | "all";

const SCOPE_TAB_LIMIT = 5;

export const Route = createFileRoute("/admin/inquiries")({
  validateSearch: (search: Record<string, unknown>) => {
    const kindRaw = typeof search.kind === "string" ? search.kind : "all";
    const kind =
      kindRaw === "all" || (FORM_KINDS as readonly string[]).includes(kindRaw)
        ? (kindRaw as KindFilter)
        : "all";
    const scope =
      typeof search.scope === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(search.scope)
        ? search.scope
        : "all";
    const q = typeof search.q === "string" ? search.q.slice(0, 200) : "";
    return { kind, scope, q };
  },
  component: InquiriesPage,
});

const KIND_FILTERS: {
  id: KindFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { id: "all", label: "Alles", icon: Inbox, color: "#e8e8f0" },
  { id: "job_application", label: "Sollicitatie", icon: Briefcase, color: "#a78bfa" },
  { id: "glass_washing", label: "Glasbewassing", icon: GlassWater, color: "#22d3ee" },
  { id: "furniture_cleaning", label: "Meubels", icon: Sofa, color: "#f59e0b" },
  { id: "inquiry", label: "Algemeen", icon: HelpCircle, color: "#22c55e" },
  { id: "newsletter", label: "Nieuwsbrief", icon: Mail, color: "#38bdf8" },
];

function kindMeta(kind: FormKind) {
  return KIND_FILTERS.find((f) => f.id === kind) ?? KIND_FILTERS[0]!;
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeWhen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Gisteren";
  return `${days}d`;
}

function InquiriesPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const kind = search.kind;
  const scopeKey = search.scope as ScopeFilter;
  const [q, setQ] = React.useState(search.q);
  const [debouncedQ, setDebouncedQ] = React.useState(search.q);
  const [items, setItems] = React.useState<FormInboxMessageSummary[]>([]);
  const [scopeFacets, setScopeFacets] = React.useState<InboxScopeFacet[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<FormInboxMessage | null>(null);
  const [listState, setListState] = React.useState<"loading" | "ready" | "error">("loading");
  const [detailState, setDetailState] = React.useState<"idle" | "loading" | "error">("idle");
  const [listError, setListError] = React.useState<string | null>(null);
  const [listErrorCode, setListErrorCode] = React.useState<string | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setQ(search.q);
    setDebouncedQ(search.q);
  }, [search.q]);

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    if (debouncedQ === search.q) return;
    void navigate({
      search: (prev) => ({ ...prev, q: debouncedQ }),
      replace: true,
    });
  }, [debouncedQ, navigate, search.q]);

  const setKind = (next: KindFilter) => {
    void navigate({ search: (prev) => ({ ...prev, kind: next }) });
  };

  const setScopeKey = (next: ScopeFilter) => {
    void navigate({ search: (prev) => ({ ...prev, scope: next }) });
  };

  const loadList = React.useCallback(async () => {
    setListState("loading");
    setListError(null);
    setListErrorCode(null);
    try {
      const result = await listAdminFormInbox({
        data: {
          kind,
          scopeKey,
          q: debouncedQ || undefined,
        },
      });
      if (!result.ok) {
        setListState("error");
        setListError(result.error);
        setListErrorCode("code" in result ? String(result.code) : null);
        setItems([]);
        setScopeFacets([]);
        return;
      }
      setItems(result.items);
      setScopeFacets(result.facets?.scopes ?? []);
      setListState("ready");
      // Opening Aanvragen clears the nav badge (unread notifications, category requests).
      void markAdminRequestsNotificationsRead()
        .then((res) => {
          if (res.ok && res.count > 0) refreshAdminRequestsUnreadBadge();
        })
        .catch(() => {
          /* non-fatal — badge simply stays until next successful mark */
        });
    } catch {
      setListState("error");
      setListError("Kon mailbox niet laden.");
      setItems([]);
      setScopeFacets([]);
    }
  }, [kind, scopeKey, debouncedQ]);

  React.useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = React.useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailState("loading");
    setDetailError(null);
    try {
      const result = await getAdminFormInboxMessage({ data: { id } });
      if (!result.ok) {
        setDetail(null);
        setDetailState("error");
        setDetailError(result.error);
        return;
      }
      setDetail(result.message);
      setDetailState("idle");
      setItems((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));

      void getAdminFormInboxThread({ data: { id } })
        .then((threadResult) => {
          if (!threadResult.ok) return;
          setDetail((prev) =>
            prev && prev.id === id ? { ...prev, thread: threadResult.thread } : prev,
          );
        })
        .catch(() => {
          /* keep root-only thread */
        });
    } catch {
      setDetail(null);
      setDetailState("error");
      setDetailError("Kon het bericht niet openen.");
    }
  }, []);

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailState("idle");
    setDetailError(null);
  };

  const useScopeSelect = scopeFacets.length > SCOPE_TAB_LIMIT;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Inbox}
        accent="#22d3ee"
        title="Aanvragen"
        subtitle="Alle berichten die klanten via de website sturen. Tik op een bericht om te lezen en te antwoorden."
        actions={[
          {
            label: "Vernieuwen",
            icon: RefreshCw,
            onClick: () => {
              void loadList();
              if (selectedId) void loadDetail(selectedId);
            },
          },
        ]}
      />

      {selectedId ? (
        <InboxDetail
          detail={detail}
          state={detailState}
          error={detailError}
          onBack={closeDetail}
          onRefreshDetail={() => {
            if (selectedId) void loadDetail(selectedId);
          }}
        />
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
            <label className="sr-only" htmlFor="inquiry-search">
              Zoek e-mails
            </label>
            <input
              id="inquiry-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Zoek op naam, e-mail of onderwerp…"
              className="w-full rounded-2xl border border-white/15 bg-white/[0.04] py-3.5 pl-12 pr-4 text-base outline-none transition placeholder:text-white/35 focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filter op formuliertype"
            className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {KIND_FILTERS.map((f) => {
              const Icon = f.icon;
              const isActive = kind === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setKind(f.id)}
                  className={cn(
                    "group relative flex shrink-0 snap-start items-center gap-2.5 rounded-2xl border px-5 py-3 text-[15px] font-semibold transition-all",
                    isActive
                      ? "border-transparent bg-white text-[#0a0a0f] shadow-lg"
                      : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {f.label}
                </button>
              );
            })}
          </div>

          {scopeFacets.length > 0 ? (
            useScopeSelect ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label htmlFor="inquiry-scope" className="text-sm font-medium text-white/60">
                  Scope
                </label>
                <select
                  id="inquiry-scope"
                  value={scopeKey}
                  onChange={(e) => setScopeKey(e.target.value as ScopeFilter)}
                  className="w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30 sm:max-w-xs"
                >
                  <option value="all">Alle scopes</option>
                  {scopeFacets.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label} ({s.count})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div
                role="tablist"
                aria-label="Filter op scope"
                className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={scopeKey === "all"}
                  onClick={() => setScopeKey("all")}
                  className={cn(
                    "shrink-0 snap-start rounded-2xl border px-5 py-3 text-[15px] font-semibold transition-all",
                    scopeKey === "all"
                      ? "border-transparent bg-white text-[#0a0a0f] shadow-lg"
                      : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white",
                  )}
                >
                  Alle scopes
                </button>
                {scopeFacets.map((s) => {
                  const isActive = scopeKey === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setScopeKey(s.key)}
                      className={cn(
                        "shrink-0 snap-start rounded-2xl border px-5 py-3 text-[15px] font-semibold transition-all",
                        isActive
                          ? "border-transparent bg-white text-[#0a0a0f] shadow-lg"
                          : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white",
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )
          ) : null}

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
            {listState === "loading" && (
              <div className="flex items-center justify-center gap-3 p-12 text-base text-white/55">
                <Loader2 className="h-5 w-5 animate-spin" />
                Berichten laden…
              </div>
            )}
            {listState === "error" && (
              <div role="alert" className="space-y-4 p-10 text-center">
                {listErrorCode === "config" ? (
                  <>
                    <AlertTriangle className="mx-auto h-10 w-10 text-amber-300/80" />
                    <p className="text-base font-semibold text-amber-100">
                      Mailbox niet geconfigureerd
                    </p>
                    <p className="mx-auto max-w-md text-sm leading-relaxed text-white/55">
                      {listError}. Zet{" "}
                      <code className="text-white/75">FORM_INBOX_PROVIDER=imap</code> terwijl Graph
                      nog niet klaar is, plus SMTP_* / FORM_INBOX_* (IMAP lezen + SMTP versturen).
                      Of configureer Microsoft Graph. Zie docs/apps-and-hosts.md.
                    </p>
                  </>
                ) : (
                  <p className="text-base text-red-300">{listError ?? "Er ging iets mis."}</p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadList()}
                    className="a-btn a-btn-secondary"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Opnieuw proberen
                  </button>
                </div>
              </div>
            )}
            {listState === "ready" && items.length === 0 && (
              <div className="p-12 text-center">
                <Mail className="mx-auto mb-4 h-10 w-10 text-white/30" />
                <p className="text-lg font-semibold text-white/80">Geen berichten gevonden</p>
                <p className="mt-2 text-[15px] text-white/50">
                  Zodra een klant een formulier op de website invult, verschijnt het hier.
                </p>
              </div>
            )}
            {listState === "ready" && items.length > 0 && (
              <ul className="divide-y divide-white/5">
                {items.map((m) => {
                  const meta = kindMeta(m.kind);
                  const Icon = meta.icon;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => void loadDetail(m.id)}
                        className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1e88e5]"
                      >
                        <div
                          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10"
                          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-base font-semibold">
                              {m.submitterName ?? m.submitterEmail ?? m.from}
                            </div>
                            {m.unread && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-[#2f9ff0] shadow-[0_0_8px_rgba(30,136,229,0.9)]" aria-label="Ongelezen" />
                            )}
                            <span className="hidden rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/55 sm:inline">
                              {KIND_LABELS[m.kind]}
                            </span>
                            {m.scopeLabel || m.scopeKey ? (
                              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs text-cyan-100">
                                {m.scopeLabel || m.scopeKey}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 truncate text-sm text-white/55">
                            {m.submitterName && m.submitterEmail
                              ? m.submitterEmail
                              : KIND_LABELS[m.kind]}
                          </div>
                          {m.snippet && m.snippet !== m.submitterEmail && (
                            <div className="mt-0.5 truncate text-sm text-white/40">
                              {m.snippet}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right text-sm text-white/45">
                          <div>{relativeWhen(m.date)}</div>
                          {m.requestNumber && (
                            <div className="mt-0.5 font-mono text-xs text-white/35">
                              {m.requestNumber}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function InboxDetail({
  detail,
  state,
  error,
  onBack,
  onRefreshDetail,
}: {
  detail: FormInboxMessage | null;
  state: "idle" | "loading" | "error";
  error: string | null;
  onBack: () => void;
  onRefreshDetail: () => void;
}) {
  const [reply, setReply] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [replyError, setReplyError] = React.useState<string | null>(null);
  const [replySuccess, setReplySuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReply("");
    setConfirmOpen(false);
    setReplyError(null);
    setReplySuccess(null);
  }, [detail?.id]);

  const performSend = async () => {
    if (!detail) return;
    setBusy(true);
    setReplyError(null);
    setReplySuccess(null);
    try {
      const result = await replyAdminFormInboxMessage({
        data: { id: detail.id, body: reply },
      });
      if (!result.ok) {
        setReplyError(result.error);
        setBusy(false);
        return;
      }
      setReply("");
      setConfirmOpen(false);
      setReplySuccess(`Antwoord verzonden naar ${result.toEmail}.`);
      setBusy(false);
      // Reload thread so the outbound (BCC'd) reply appears
      window.setTimeout(() => onRefreshDetail(), 1500);
    } catch {
      setReplyError("Verzenden mislukt. Probeer het opnieuw.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="a-btn a-btn-secondary"
      >
        <ArrowLeft className="h-4 w-4" />
        Terug naar overzicht
      </button>

      {state === "loading" && (
        <div className="flex items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-base text-white/55">
          <Loader2 className="h-5 w-5 animate-spin" />
          Bericht laden…
        </div>
      )}

      {state === "error" && (
        <div
          role="alert"
          className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-base text-red-200"
        >
          {error ?? "Kon details niet laden."}
        </div>
      )}

      {detail && state !== "loading" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
          <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-white/45">
                <span>{KIND_LABELS[detail.kind]}</span>
                {detail.scopeLabel || detail.scopeKey ? (
                  <>
                    <span>·</span>
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs text-cyan-100">
                      {detail.scopeLabel || detail.scopeKey}
                    </span>
                  </>
                ) : null}
                {detail.requestNumber && (
                  <>
                    <span>·</span>
                    <span className="font-mono">{detail.requestNumber}</span>
                  </>
                )}
              </div>
              <h2 className="mt-1.5 text-2xl font-bold tracking-tight break-words">
                {detail.submitterName ??
                  detail.fields.find((f) => f.key === "name")?.value ??
                  detail.subject}
              </h2>
              <p className="mt-1 text-sm text-white/45">{formatWhen(detail.date)}</p>
            </div>

            <dl className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-[15px] sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/45">Van</dt>
                <dd className="mt-0.5 break-all text-white/85">{detail.from}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/45">Antwoord naar</dt>
                <dd className="mt-0.5 break-all text-white/85">
                  {detail.submitterEmail ?? "Niet gevonden"}
                </dd>
              </div>
            </dl>

            {detail.fields.length > 0 ? (
              <div>
                <h3 className="mb-2.5 text-sm font-semibold uppercase tracking-wider text-white/55">
                  Ingevulde gegevens
                </h3>
                <dl className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  {detail.fields.map((field) => (
                    <div
                      key={`${field.key}-${field.label}`}
                      className="grid gap-1 px-4 py-3.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
                    >
                      <dt className="text-sm font-semibold uppercase tracking-wide text-white/50">
                        {FIELD_LABELS_NL[field.key] ?? field.label}
                      </dt>
                      <dd className="min-w-0">
                        <FormFieldValue
                          fieldKey={field.key}
                          label={FIELD_LABELS_NL[field.key] ?? field.label}
                          value={field.value}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <div>
                <h3 className="mb-2.5 text-sm font-semibold uppercase tracking-wider text-white/55">
                  Inhoud
                </h3>
                <div className="max-h-[20rem] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-4">
                  <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-white/85">
                    {detail.textBody || "(geen tekstinhoud)"}
                  </pre>
                </div>
              </div>
            )}

            <AttachmentsBlock messageId={detail.id} attachments={detail.attachments} />

            <ConversationThread thread={detail.thread} rootId={detail.id} />
          </section>

          <section className="h-fit rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <h3 className="text-xl font-bold tracking-tight">Antwoorden</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {detail.submitterEmail
                ? `Uw antwoord gaat als e-mail naar ${detail.submitterEmail}. Het gesprek blijft hier bewaard.`
                : "Geen submitter-e-mail gevonden — antwoorden is niet mogelijk."}
            </p>

            <label className="mt-5 block">
              <span className="a-label">Uw bericht</span>
              <textarea
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value);
                  setReplySuccess(null);
                }}
                rows={8}
                maxLength={8000}
                disabled={!detail.submitterEmail}
                placeholder="Typ hier uw antwoord…"
                className="w-full resize-y rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base outline-none transition placeholder:text-white/35 focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30 disabled:opacity-50"
              />
            </label>

            {replySuccess && (
              <div
                role="status"
                className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
              >
                {replySuccess}
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="mt-4 min-h-14 w-full rounded-xl text-base font-semibold"
              onClick={() => setConfirmOpen(true)}
              disabled={busy || !detail.submitterEmail || reply.trim().length < 2}
            >
              <Send className="h-5 w-5" />
              Verstuur antwoord
            </Button>

            <ConfirmationDialog
              open={confirmOpen}
              title="Antwoord versturen"
              description={
                detail.submitterEmail
                  ? `Verstuur dit antwoord naar ${detail.submitterEmail}? Dit kan niet ongedaan worden gemaakt.`
                  : "Geen afzender-e-mail gevonden — antwoorden is niet mogelijk."
              }
              confirmLabel="Versturen"
              pending={busy}
              error={replyError}
              onConfirm={performSend}
              onCancel={() => {
                if (busy) return;
                setConfirmOpen(false);
                setReplyError(null);
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}

const COLLAPSE_FIELD_KEYS = new Set(["motivation", "letter"]);
const COLLAPSE_CHAR_THRESHOLD = 220;

function FormFieldValue({
  fieldKey,
  label,
  value,
}: {
  fieldKey: string;
  label: string;
  value: string;
}) {
  const [open, setOpen] = React.useState(false);
  const shouldCollapse =
    COLLAPSE_FIELD_KEYS.has(fieldKey) && value.trim().length > COLLAPSE_CHAR_THRESHOLD;

  if (!shouldCollapse) {
    return <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90">{value}</p>;
  }

  const preview = value.trim().slice(0, COLLAPSE_CHAR_THRESHOLD).trimEnd();

  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90">
        {preview}
        <span className="text-white/40">…</span>
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5]"
      >
        Alles lezen
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden border-white/10 bg-[#0f172a] text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">{label}</DialogTitle>
            <DialogDescription className="sr-only">Volledige tekst van {label}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,28rem)] overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-white/90">
              {value}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttachmentsBlock({
  messageId,
  attachments,
}: {
  messageId?: string;
  attachments: FormInboxAttachment[];
}) {
  const [busyName, setBusyName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!attachments.length) return null;

  const download = async (att: FormInboxAttachment) => {
    if (att.contentBase64) {
      const binary = atob(att.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: att.contentType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!messageId) {
      setError("Bijlage niet beschikbaar om te downloaden.");
      return;
    }

    setBusyName(att.filename);
    setError(null);
    try {
      const result = await getAdminFormInboxAttachment({
        data: { id: messageId, filename: att.filename },
      });
      if (!result.ok || !result.attachment.contentBase64) {
        setError(result.ok ? "Download mislukt." : result.error);
        return;
      }
      const binary = atob(result.attachment.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: result.attachment.contentType || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.attachment.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download mislukt.");
    } finally {
      setBusyName(null);
    }
  };

  return (
    <div>
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/55">
        <Paperclip className="h-4 w-4" />
        Bijlagen
      </h3>
      <ul className="space-y-2">
        {attachments.map((att) => (
          <li
            key={`${att.filename}-${att.size}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="truncate text-[15px] text-white/90">{att.filename}</div>
              <div className="text-xs text-white/45">
                {att.contentType}
                {att.size > 0 ? ` · ${Math.round(att.size / 1024)} KB` : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void download(att)}
              disabled={busyName === att.filename}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-50"
            >
              {busyName === att.filename ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ConversationThread({ thread, rootId }: { thread: FormInboxThreadItem[]; rootId: string }) {
  const others = thread.filter((t) => t.id !== rootId || thread.length === 1);
  const items = thread.length > 1 ? thread : others;

  if (items.length === 0) return null;

  const directionLabel: Record<FormInboxThreadItem["direction"], string> = {
    form: "Websiteformulier",
    customer: "Klant",
    admin: "McCoy",
  };

  return (
    <div>
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/55">
        <MessageSquare className="h-4 w-4" />
        Gesprek ({thread.length})
      </h3>
      <ol className="space-y-3">
        {thread.map((item) => (
          <li
            key={item.id}
            className={cn(
              "rounded-2xl border p-4",
              item.direction === "admin" && "border-[#1e88e5]/30 bg-[#1e88e5]/10",
              item.direction === "customer" && "border-emerald-500/25 bg-emerald-500/10",
              item.direction === "form" && "border-white/10 bg-black/20",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
              <span className="font-semibold text-white/75">{directionLabel[item.direction]}</span>
              <span>{formatWhen(item.date)}</span>
            </div>
            <div className="mt-1 text-xs text-white/45">
              {item.from} → {item.to}
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/85">
              {item.direction === "form"
                ? "(Oorspronkelijke formulieraanvraag — zie velden hierboven)"
                : item.textBody || "(geen tekst)"}
            </p>
            {item.attachments.length > 0 && item.direction !== "form" && (
              <div className="mt-2">
                <AttachmentsBlock messageId={item.id} attachments={item.attachments} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
