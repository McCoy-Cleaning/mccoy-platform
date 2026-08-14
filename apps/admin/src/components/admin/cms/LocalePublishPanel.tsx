import * as React from "react";
import type {
  CmsPage,
  Locale,
  LocalePublicationState,
  TranslationCoverageResult,
} from "@mccoy/cms-schema";
import {
  ensureEnglishLocaleContentFromDrafts,
  enPublishBlockedByCoverage,
  scanTranslationCoverage,
} from "@mccoy/cms-schema";
import {
  adminGetCmsPageStatus,
  adminListCmsRevisions,
  adminPublishCmsPage,
  adminRollbackCmsPage,
  adminSetCmsLocaleState,
} from "@/lib/api/cms-publish.functions";
import { cms, useCms, useEditablePage } from "@/lib/cms/store";
import { cn } from "@/lib/utils";
import { appConfirm } from "@/lib/app-dialogs";

type Props = {
  page: CmsPage;
  onPageChange?: (page: CmsPage) => void;
};

const PUBLICATION_LABELS: Record<LocalePublicationState, string> = {
  missing: "Ontbreekt",
  draft: "Concept",
  review: "Review",
  approved: "Goedgekeurd",
  published: "Gepubliceerd",
  archived: "Gearchiveerd",
};

/**
 * Phase D — locale tabs, publication/freshness chips, publish/rollback UX.
 * AI never auto-publishes — publish is always an explicit editor action.
 */
export function LocalePublishPanel({ page, onPageChange }: Props) {
  const state = useCms();
  const editable = useEditablePage(page.id) ?? page;
  const [locale, setLocale] = React.useState<Locale>("nl");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [draftRevision, setDraftRevision] = React.useState(1);
  const [coverage, setCoverage] = React.useState<TranslationCoverageResult | null>(null);
  const [automaticTranslationStatus, setAutomaticTranslationStatus] = React.useState(() =>
    cms.getAutomaticEnTranslationStatus(page.id),
  );
  const [revisions, setRevisions] = React.useState<
    Array<{ id: string; revisionNumber: number; status: string; publishedAt: string | null }>
  >([]);

  const localeState = page.localeStates?.[locale] ?? {
    publicationState: locale === "nl" ? ("published" as const) : ("missing" as const),
    freshness: locale === "nl" ? ("current" as const) : ("unknown" as const),
  };

  const refresh = React.useCallback(async () => {
    const [status, rev] = await Promise.all([
      adminGetCmsPageStatus({ data: { pageId: page.id } }),
      adminListCmsRevisions({ data: { pageId: page.id } }),
    ]);
    if (status.ok) setDraftRevision(status.draftRevisionNumber);
    if (rev.ok) setRevisions(rev.revisions);
  }, [page.id]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    setAutomaticTranslationStatus(cms.getAutomaticEnTranslationStatus(page.id));
    return cms.subscribeAutomaticEnTranslationStatus(page.id, setAutomaticTranslationStatus);
  }, [page.id]);

  // Depend on stable store refs only. Never put getEditablePage() nested fields in
  // deps — applyDraftToPage always structuredClone's, so enFieldDrafts/etc. are new
  // identities every render and setCoverage → re-render loops (BR-001).
  const draft = state.draft[page.id];
  const saved = state.saved[page.id];
  const publishedUpdatedAt = state.pages.find((p) => p.id === page.id)?.updatedAt ?? page.updatedAt;

  React.useEffect(() => {
    const live = cms.getEditablePage(page.id) ?? page;
    const next = cms.getTranslationCoverage(page.id) ?? scanTranslationCoverage({ page: live });
    setCoverage(next);
  }, [page.id, draft, saved, publishedUpdatedAt, state.version]);

  const setState = async (publicationState: LocalePublicationState) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await adminSetCmsLocaleState({
        data: {
          pageId: page.id,
          payload: editable,
          locale,
          publicationState,
          freshness: publicationState === "published" ? "current" : localeState.freshness,
        },
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      const withStates = {
        ...editable,
        localeStates: result.localeStates ?? editable.localeStates,
      };
      onPageChange?.(withStates);
      cms.updatePage(page.id, { localeStates: result.localeStates });
      setMessage(`Status ${locale.toUpperCase()}: ${PUBLICATION_LABELS[publicationState]}`);
    } finally {
      setBusy(false);
    }
  };

  const translateMissing = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await cms.translateMissingEnFields(page.id);
      if (!result.ok) {
        setMessage(result.reason);
        return;
      }
      const updated = cms.getEditablePage(page.id);
      if (updated) onPageChange?.(updated);
      setCoverage(cms.getTranslationCoverage(page.id));
      setMessage(
        result.translated > 0
          ? `${result.translated} ontbrekende velden vertaald.${result.warning ? ` (${result.warning})` : ""}`
          : result.warning
            ? `Geen velden vertaald: ${result.warning}`
            : "Geen ontbrekende velden om te vertalen.",
      );
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (locale === "en") {
        const cov =
          cms.getTranslationCoverage(page.id) ?? scanTranslationCoverage({ page: editable });
        if (enPublishBlockedByCoverage(cov)) {
          setMessage(
            `EN publicatie geblokkeerd: ${cov.missing} ontbrekend, ${cov.blank} leeg, ${cov.invalid} ongeldig. Vertaal eerst ontbrekende velden.`,
          );
          setCoverage(cov);
          return;
        }
      }
      let payload: CmsPage = {
        ...editable,
        localeStates: {
          ...editable.localeStates!,
          [locale]: {
            publicationState: "published" as const,
            freshness: "current" as const,
          },
          nl: editable.localeStates?.nl ?? {
            publicationState: "published" as const,
            freshness: "current" as const,
          },
        },
      };
      const publishedLocales: Locale[] = ["nl"];
      if (locale === "en" || payload.localeStates?.en?.publicationState === "published") {
        payload = ensureEnglishLocaleContentFromDrafts(payload);
        publishedLocales.push("en");
      }
      if (locale === "en" && !payload.localeContent?.en) {
        setMessage("Voeg eerst Engelse content toe voordat je EN publiceert.");
        return;
      }
      const result = await adminPublishCmsPage({
        data: {
          pageId: page.id,
          payload,
          publishedLocales: Array.from(new Set(publishedLocales)),
          expectedDraftRevision: draftRevision,
        },
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      // Sync editor store so subsequent Opslaan keeps EN published (and refreshes overlays).
      const publishedPage: CmsPage = {
        ...payload,
        localeStates: result.localeStates ?? payload.localeStates,
      };
      cms.updatePage(page.id, {
        localeStates: publishedPage.localeStates,
        localeContent: publishedPage.localeContent,
        enFieldDrafts: publishedPage.enFieldDrafts,
        enFieldDraftSources: publishedPage.enFieldDraftSources,
        enFieldDraftMeta: publishedPage.enFieldDraftMeta,
      });
      onPageChange?.(publishedPage);
      setMessage(
        locale === "en"
          ? `EN gepubliceerd (revisie ${result.result.revisionNumber}). Live op /en.`
          : `Gepubliceerd (revisie ${result.result.revisionNumber}).`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const rollback = async (targetRevisionId: string) => {
    if (
      !(await appConfirm({
        title: "Gepubliceerde revisie terugzetten?",
        description:
          "De huidige conceptinhoud wordt vervangen door deze gepubliceerde revisie. Niet-opgeslagen wijzigingen gaan verloren.",
        confirmLabel: "Terugzetten",
        tone: "warning",
      }))
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await adminRollbackCmsPage({
        data: { pageId: page.id, targetRevisionId },
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Rollback uitgevoerd.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const previewHref = (() => {
    const origin =
      (import.meta.env.VITE_STOREFRONT_ORIGIN as string | undefined)?.replace(/\/$/, "") ||
      "http://localhost:5173";
    const path =
      locale === "en"
        ? page.paths?.en
          ? page.paths.en.startsWith("/en")
            ? page.paths.en
            : `/en${page.paths.en === "/" ? "" : page.paths.en}`
          : "/en"
        : (page.paths?.nl ?? page.slug);
    return `${origin}${path}?_cmsPreview=1&_cmsLocale=${locale}&pageId=${encodeURIComponent(page.id)}`;
  })();

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["nl", "en"] as Locale[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase",
              locale === l
                ? "border-[#1e88e5] bg-[#1e88e5]/20 text-white"
                : "border-white/10 bg-white/5 text-white/60 hover:text-white",
            )}
          >
            {l}
          </button>
        ))}
        <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] uppercase tracking-wide text-white/70">
          {PUBLICATION_LABELS[localeState.publicationState]}
        </span>
        {localeState.publicationState === "published" && localeState.freshness === "stale" ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-amber-200">
            Verouderd
          </span>
        ) : null}
      </div>

      <p className="text-xs text-white/50">
        Opslaan &amp; publiceren behoudt alle bestaande EN-tekst, vertaalt alle lege EN-velden in
        gebundelde aanvragen en publiceert het resultaat in één stap. EN kan hier ook terug naar
        concept.
      </p>

      {automaticTranslationStatus?.state === "queued" ||
      automaticTranslationStatus?.state === "translating" ? (
        <p className="text-xs text-[#90caf9]" role="status">
          Ontbrekende EN-velden vertalen…
        </p>
      ) : automaticTranslationStatus?.state === "completed" &&
        automaticTranslationStatus.translated > 0 ? (
        <p className="text-xs text-emerald-300/90" role="status">
          {automaticTranslationStatus.translated} EN-veld(en) automatisch aangevuld.
        </p>
      ) : automaticTranslationStatus?.state === "failed" ? (
        <p className="text-xs text-amber-200" role="status">
          Automatisch aanvullen is gepauzeerd
          {automaticTranslationStatus.errorCode === "rate_limit" ? " door de Groq-limiet" : ""}.
          Probeer ontbrekende velden handmatig opnieuw.
        </p>
      ) : null}

      {coverage ? (
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70">
          <div className="font-semibold text-white/80">EN velddekking</div>
          <p className="mt-1">
            {coverage.translated}/{coverage.totalRequired} vertaald
            {coverage.missing ? ` · ${coverage.missing} ontbrekend` : ""}
            {coverage.blank ? ` · ${coverage.blank} leeg` : ""}
            {coverage.stale ? ` · ${coverage.stale} verouderd` : ""}
            {coverage.overrideRemoved ? ` · ${coverage.overrideRemoved} gewist (nog EN nodig)` : ""}
            {coverage.intentionalBlank ? ` · ${coverage.intentionalBlank} bewust leeg` : ""}
            {coverage.complete && coverage.overrideRemoved === 0 ? " · compleet" : ""}
          </p>
          {coverage.missing + coverage.blank + coverage.overrideRemoved > 0 ? (
            <p className="mt-1 text-white/50">
              {coverage.missing + coverage.blank + coverage.overrideRemoved} veld(en) hebben nog
              geen geldige EN-vertaling. Na opslaan worden alleen lege velden automatisch aangevuld;
              de knop hieronder probeert mislukte of ontbrekende velden expliciet opnieuw.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void setState("draft")}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5 disabled:opacity-40"
        >
          Concept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void setState("review")}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5 disabled:opacity-40"
        >
          Naar review
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void setState("approved")}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5 disabled:opacity-40"
        >
          Goedkeuren
        </button>
        <button
          type="button"
          disabled={
            busy ||
            (coverage != null && coverage.missing + coverage.blank + coverage.overrideRemoved === 0)
          }
          onClick={() => void translateMissing()}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          {automaticTranslationStatus?.state === "failed"
            ? "Opnieuw proberen"
            : "Ontbrekende velden vertalen"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void publish()}
          className="rounded-xl border border-[#1e88e5]/50 bg-[#1e88e5]/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e88e5]/30 disabled:opacity-40"
        >
          Publiceer {locale.toUpperCase()}
        </button>
        <a
          href={previewHref}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
        >
          Preview (noindex)
        </a>
      </div>

      {message ? <p className="text-xs text-[#90caf9]">{message}</p> : null}

      {revisions.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
            Revisies
          </div>
          <ul className="max-h-40 space-y-1 overflow-auto text-xs text-white/60">
            {revisions.slice(0, 8).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-black/30 px-2 py-1.5"
              >
                <span>
                  #{r.revisionNumber} · {r.status}
                  {r.publishedAt ? ` · ${r.publishedAt.slice(0, 16)}` : ""}
                </span>
                {r.status === "superseded" || r.status === "published" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void rollback(r.id)}
                    className="text-[10px] text-white/50 hover:text-white disabled:opacity-40"
                  >
                    Rollback
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
