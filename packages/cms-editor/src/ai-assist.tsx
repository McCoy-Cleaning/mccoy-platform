import * as React from "react";
import { shouldSyncParagraphStructure, syncParagraphStructure } from "@mccoy/cms-schema";
import { cn } from "@mccoy/ui";

export type CmsAiTone = "professional" | "catchy" | "warm" | "concise";

export type CmsAiGenerateRequest = {
  brief?: string;
  currentText?: string;
  fieldHint?: string;
  tone?: CmsAiTone;
  maxChars?: number;
  /** "Opnieuw genereren" — skip cache and ask for a distinct variant. */
  regenerate?: boolean;
  /** Previous AI preview text to avoid repeating. */
  previousText?: string;
};

export type CmsAiTranslateRequest = {
  text?: string;
  fields?: Record<string, string>;
  maxCharsPerField?: number;
};

export type CmsAiSectionFieldSpec = {
  currentText?: string;
  fieldHint?: string;
  maxChars?: number;
};

export type CmsAiGenerateSectionRequest = {
  brief?: string;
  fields: Record<string, CmsAiSectionFieldSpec>;
  tone?: CmsAiTone;
  regenerate?: boolean;
  previousFields?: Record<string, string>;
};

export type CmsAiGenerateResponse =
  | { ok: true; text: string; warnings: string[] }
  | { ok: false; error: string };

export type CmsAiTranslateResponse =
  | { ok: true; text?: string; fields: Record<string, string>; warnings: string[] }
  | { ok: false; error: string };

export type CmsAiGenerateSectionResponse =
  | { ok: true; nl: Record<string, string>; en: Record<string, string>; warnings: string[] }
  | { ok: false; error: string };

export type CmsConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "default" | "warning" | "destructive";
};

export type CmsAiAssistApi = {
  configured: boolean | null;
  statusMessage?: string;
  generateDutch: (input: CmsAiGenerateRequest) => Promise<CmsAiGenerateResponse>;
  translateToEn: (input: CmsAiTranslateRequest) => Promise<CmsAiTranslateResponse>;
  generateSection: (input: CmsAiGenerateSectionRequest) => Promise<CmsAiGenerateSectionResponse>;
  getEnDraft: (path: string) => string;
  setEnDraft: (path: string, value: string) => void;
  setEnDrafts: (patch: Record<string, string>) => void;
  /**
   * Confirm before overwriting existing EN drafts.
   * Fail closed: missing handler, thrown errors, Escape, and cancel must abort.
   * Never use window.confirm.
   */
  confirmOverwrite: (request: CmsConfirmationRequest) => Promise<boolean>;
};

const CmsAiAssistContext = React.createContext<CmsAiAssistApi | null>(null);

export function CmsAiAssistProvider({
  value,
  children,
}: {
  value: CmsAiAssistApi;
  children: React.ReactNode;
}) {
  return <CmsAiAssistContext.Provider value={value}>{children}</CmsAiAssistContext.Provider>;
}

export function useCmsAiAssist(): CmsAiAssistApi | null {
  return React.useContext(CmsAiAssistContext);
}

/**
 * Fail-closed overwrite confirmation. Missing API support, thrown errors,
 * Escape, and cancellation all abort without touching CMS content.
 * Never falls back to window.confirm.
 */
export async function requestCmsOverwriteConfirm(
  ai: CmsAiAssistApi | null | undefined,
  request: CmsConfirmationRequest,
): Promise<boolean> {
  const confirm = ai?.confirmOverwrite;
  if (typeof confirm !== "function") return false;
  try {
    return Boolean(await confirm(request));
  } catch {
    return false;
  }
}

const inputClass =
  "w-full rounded-xl border border-white/12 bg-[#161920] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 [color-scheme:dark]";

const aiBtnClass =
  "rounded-md border border-white/12 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55 transition hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-40";

const primaryAiBtnClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-[12px] font-semibold text-white shadow-[0_8px_24px_-12px_rgba(14,165,233,0.75)] transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none";

/** Keys that must never get Genereer / Vertaal / EN-concept chrome. */
export const NON_TRANSLATABLE_FIELD_KEYS = new Set([
  "image",
  "before",
  "after",
  "poster",
  "missionImage",
  "visionImage",
  "historyImage",
  "ctaHref",
  "href",
  "url",
  "videoUrl",
  "src",
  "link",
  "path",
  "slug",
  "id",
  "align",
  "layout",
  "variant",
  "email",
  "phone",
  "size",
  "icon",
  "displayMode",
  "employmentType",
  "currency",
  "period",
  "logoBackdrop",
  "resolvedBackdrop",
]);

export function isTranslatableFieldKey(key: string): boolean {
  if (NON_TRANSLATABLE_FIELD_KEYS.has(key)) return false;
  const lower = key.toLowerCase();
  if (lower.includes("image") || lower.includes("poster") || lower.endsWith("url")) return false;
  if (lower.endsWith("href") || lower.endsWith("src") || lower.endsWith("path")) return false;
  if (lower.includes("email") || lower.includes("phone")) return false;
  if (lower === "size" || lower === "icon" || lower === "slug") return false;
  return true;
}

export function defaultMaxCharsForField(key: string): number {
  const lower = key.toLowerCase();
  if (lower.includes("body") || lower.includes("description") || lower.includes("intro") || lower.includes("quote")) {
    return 600;
  }
  if (lower.includes("heading") || lower === "title" || lower.includes("subtitle")) return 120;
  if (lower.includes("label") || lower.includes("cta") || lower === "eyebrow") return 60;
  return 200;
}

type PreviewState =
  | { kind: "idle" }
  | { kind: "loading"; action: "nl" | "en" }
  | { kind: "preview-nl"; text: string; warnings: string[] }
  | { kind: "preview-en"; text: string; warnings: string[] }
  | { kind: "error"; message: string };

/**
 * Plain text field. When AI is available and the field is translatable, small
 * Genereer / Vertaal controls appear only on hover or focus — never as a default stack.
 */
export function InspectTextField({
  label,
  value,
  onChange,
  fieldPath,
  fieldHint,
  multiline = false,
  maxChars = 280,
  placeholder,
  enableAi,
  /**
   * When false, hide the per-field EN draft textarea.
   * Use when a parent SectionAiToolbar already owns EN concept editors
   * (avoids the same labels twice).
   */
  showEnDraft = true,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Stable path for EN drafts, e.g. section:home.hero:heading */
  fieldPath?: string;
  fieldHint?: string;
  multiline?: boolean;
  maxChars?: number;
  placeholder?: string;
  /** Override AI eligibility (defaults from fieldHint / fieldPath). */
  enableAi?: boolean;
  showEnDraft?: boolean;
}) {
  const ai = useCmsAiAssist();
  const [preview, setPreview] = React.useState<PreviewState>({ kind: "idle" });

  const hintKey = fieldHint?.split(/[.\s:/]/).filter(Boolean).at(-1) ?? "";
  const aiEligible =
    enableAi ??
    (Boolean(ai) &&
      Boolean(fieldPath) &&
      (hintKey ? isTranslatableFieldKey(hintKey) : true));

  const configured = ai?.configured === true;
  const showAiChrome = Boolean(ai) && aiEligible;
  const showManualEn =
    showEnDraft &&
    Boolean(ai) &&
    Boolean(fieldPath) &&
    (hintKey ? isTranslatableFieldKey(hintKey) : Boolean(fieldPath));
  const enDraftValue = showManualEn && fieldPath ? ai!.getEnDraft(fieldPath) : "";

  const runGenerateNl = async (opts?: { regenerate?: boolean; previousText?: string }) => {
    if (!ai || !configured) return;
    setPreview({ kind: "loading", action: "nl" });
    // Prefer the editor's typed idea; if empty, fall back to briefing from previous preview context.
    const idea = value.trim();
    const result = await ai.generateDutch({
      currentText: idea || undefined,
      // When regenerating with an empty field, still require some seed — use previous as brief idea.
      brief: !idea && opts?.previousText ? `Variant op: ${opts.previousText.slice(0, 400)}` : undefined,
      fieldHint: fieldHint ?? label,
      tone: "catchy",
      maxChars,
      regenerate: opts?.regenerate,
      previousText: opts?.previousText,
    });
    if (!result.ok) {
      setPreview({ kind: "error", message: result.error });
      return;
    }
    setPreview({ kind: "preview-nl", text: result.text, warnings: result.warnings });
  };

  const runTranslateEn = async () => {
    if (!ai || !configured || !fieldPath) return;
    if (!value.trim()) {
      setPreview({ kind: "error", message: "Vul eerst Nederlandse tekst in om te vertalen." });
      return;
    }
    setPreview({ kind: "loading", action: "en" });
    const result = await ai.translateToEn({ text: value, maxCharsPerField: Math.max(maxChars, 400) });
    if (!result.ok) {
      setPreview({ kind: "error", message: result.error });
      return;
    }
    const text = result.text ?? result.fields.text ?? Object.values(result.fields)[0] ?? "";
    if (!text) {
      setPreview({ kind: "error", message: "Geen Engelse vertaling ontvangen." });
      return;
    }
    setPreview({ kind: "preview-en", text, warnings: result.warnings });
  };

  const applyNl = () => {
    if (preview.kind !== "preview-nl") return;
    onChange(preview.text);
    setPreview({ kind: "idle" });
  };

  const applyEn = async () => {
    if (preview.kind !== "preview-en" || !ai || !fieldPath) return;
    const existing = ai.getEnDraft(fieldPath);
    if (existing.trim() && existing.trim() !== preview.text.trim()) {
      const ok = await requestCmsOverwriteConfirm(ai, {
        title: "Engelse concepttekst overschrijven?",
        description:
          "Er staat al een Engelse concepttekst. Overschrijven met de nieuwe vertaling?",
        confirmLabel: "Overschrijven",
        cancelLabel: "Annuleren",
        tone: "warning",
      });
      if (!ok) return;
    }
    const enText = shouldSyncParagraphStructure(value, preview.text)
      ? syncParagraphStructure(value, preview.text)
      : preview.text;
    ai.setEnDraft(fieldPath, enText);
    setPreview({ kind: "idle" });
  };

  return (
    <div className="group/field block space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</span>
        {showAiChrome ? (
          <div
            className={cn(
              "flex flex-wrap items-center gap-1 opacity-0 transition-opacity",
              "group-hover/field:opacity-100 group-focus-within/field:opacity-100",
              preview.kind !== "idle" ? "opacity-100" : null,
            )}
          >
            <button
              type="button"
              className={aiBtnClass}
              disabled={!configured || preview.kind === "loading"}
              onClick={() => void runGenerateNl()}
              aria-label={`${label}: Genereer Nederlandse tekst`}
              title={!configured ? (ai?.statusMessage ?? "AI niet geconfigureerd") : "Genereer NL"}
            >
              {preview.kind === "loading" && preview.action === "nl" ? "…" : "NL"}
            </button>
            {fieldPath ? (
              <button
                type="button"
                className={aiBtnClass}
                disabled={!configured || preview.kind === "loading" || !value.trim()}
                onClick={() => void runTranslateEn()}
                aria-label={`${label}: Vertaal naar Engels`}
                title={!configured ? (ai?.statusMessage ?? "AI niet geconfigureerd") : "Vertaal naar EN"}
              >
                {preview.kind === "loading" && preview.action === "en" ? "…" : "EN"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {multiline ? (
        <textarea
          className={cn(inputClass, "min-h-[88px]")}
          value={value}
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next);
            // Mirror NL blank-line structure onto the EN draft so both locales
            // keep the same paragraph spacing after NL edits.
            if (fieldPath && ai) {
              const en = ai.getEnDraft(fieldPath);
              if (en.trim() && shouldSyncParagraphStructure(next, en)) {
                const synced = syncParagraphStructure(next, en);
                if (synced !== en) ai.setEnDraft(fieldPath, synced);
              }
            }
          }}
        />
      ) : (
        <input
          className={inputClass}
          value={value}
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {showManualEn && fieldPath ? (
        <label className="block space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-sky-300/55">
            EN · handmatig
          </span>
          <textarea
            className={cn(inputClass, "min-h-[52px] border-sky-500/15 bg-sky-950/15 text-xs text-sky-50/90")}
            value={enDraftValue}
            placeholder="Leeg = NL-fallback (Opslaan vult dit niet opnieuw)"
            onChange={(e) => ai!.setEnDraft(fieldPath, e.target.value)}
            aria-label={`${label}: Engelse vertaling (handmatig)`}
          />
        </label>
      ) : null}

      {preview.kind === "error" ? (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-100" role="alert">
          <p>{preview.message}</p>
          <button type="button" className={cn(aiBtnClass, "mt-1.5")} onClick={() => setPreview({ kind: "idle" })}>
            Sluiten
          </button>
        </div>
      ) : null}

      {preview.kind === "preview-nl" || preview.kind === "preview-en" ? (
        <div
          className="space-y-2 rounded-xl border border-sky-400/30 bg-sky-500/10 p-3"
          role="dialog"
          aria-label="AI-voorbeeld"
        >
          <p className="text-[11px] font-semibold text-sky-100">
            {preview.kind === "preview-nl" ? "Voorbeeld (NL) — nog niet toegepast" : "Voorbeeld (EN) — nog niet toegepast"}
          </p>
          <p className="whitespace-pre-wrap text-sm text-white/90">{preview.text}</p>
          {preview.warnings.length > 0 ? (
            <ul className="list-disc pl-4 text-[10px] text-amber-100/80">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              onClick={() =>
                void (preview.kind === "preview-nl" ? applyNl() : applyEn())
              }
            >
              Toepassen
            </button>
            <button
              type="button"
              className={aiBtnClass}
              disabled={!configured}
              onClick={() =>
                void (preview.kind === "preview-nl"
                  ? runGenerateNl({ regenerate: true, previousText: preview.text })
                  : runTranslateEn())
              }
              aria-label={
                preview.kind === "preview-nl" ? `${label}: Opnieuw genereren` : `${label}: Opnieuw vertalen`
              }
            >
              Opnieuw
            </button>
            <button type="button" className={aiBtnClass} onClick={() => setPreview({ kind: "idle" })}>
              Annuleren
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Section-level AI: primary “Genereer met AI” (NL + auto EN drafts), with
 * optional translate-only / EN-concept editors collapsed underneath.
 */
export function SectionAiToolbar({
  fields,
  pathPrefix,
  fieldLabels,
  onApplyDutch,
}: {
  /** fieldKey → current NL value (may be empty for generate targets) */
  fields: Record<string, string>;
  /** Builds draft paths: `${pathPrefix}:${fieldKey}` */
  pathPrefix: string;
  /** Optional labels for EN draft editors */
  fieldLabels?: Record<string, string>;
  /** Apply generated Dutch copy into the live section fields (required for generate). */
  onApplyDutch?: (nlFields: Record<string, string>) => void;
}) {
  const ai = useCmsAiAssist();
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [brief, setBrief] = React.useState("");
  const [state, setState] = React.useState<
    | { kind: "idle" }
    | { kind: "loading"; phase: "generate" | "translate" }
    | { kind: "preview-section"; nl: Record<string, string>; en: Record<string, string>; warnings: string[] }
    | { kind: "preview-translate"; fields: Record<string, string>; warnings: string[] }
    | { kind: "error"; message: string }
    | { kind: "success"; message: string }
  >({ kind: "idle" });

  if (!ai) return null;

  const targetKeys = Object.keys(fields).filter((key) => isTranslatableFieldKey(key));
  const translateEntries = targetKeys
    .map((key) => [key, fields[key] ?? ""] as const)
    .filter(([, v]) => v.trim().length > 0);
  const configured = ai.configured === true;
  const canGenerate = configured && targetKeys.length > 0 && Boolean(onApplyDutch);
  // Always expose EN editors for translatable fields (manual entry without AI).
  const draftEntries = targetKeys.map((key) => {
    const path = `${pathPrefix}:${key}`;
    return { key, path, value: ai.getEnDraft(path) };
  });

  const runGenerateSection = async (opts?: {
    regenerate?: boolean;
    previousFields?: Record<string, string>;
  }) => {
    if (!canGenerate || !onApplyDutch) return;
    setState({ kind: "loading", phase: "generate" });
    const payload: Record<string, CmsAiSectionFieldSpec> = {};
    for (const key of targetKeys) {
      const current = fields[key]?.trim();
      payload[key] = {
        // Keep the redacteur's typed idea as the seed (not the previous AI preview).
        currentText: current || undefined,
        fieldHint: fieldLabels?.[key] ?? key,
        maxChars: defaultMaxCharsForField(key),
      };
    }
    const result = await ai.generateSection({
      brief: brief.trim() || undefined,
      fields: payload,
      tone: "catchy",
      regenerate: opts?.regenerate,
      previousFields: opts?.previousFields,
    });
    if (!result.ok) {
      setState({ kind: "error", message: result.error });
      return;
    }
    setState({
      kind: "preview-section",
      nl: result.nl,
      en: result.en,
      warnings: result.warnings,
    });
  };

  const applySection = async () => {
    if (state.kind !== "preview-section" || !onApplyDutch) return;
    const existingEn = Object.keys(state.en).filter((key) => {
      const path = `${pathPrefix}:${key}`;
      return Boolean(ai.getEnDraft(path).trim());
    });
    if (existingEn.length > 0) {
      const ok = await requestCmsOverwriteConfirm(ai, {
        title: "EN-concepten overschrijven?",
        description: `${existingEn.length} veld(en) hebben al een EN-concept. Overschrijven met de nieuwe vertaling?`,
        confirmLabel: "Overschrijven",
        cancelLabel: "Annuleren",
        tone: "warning",
      });
      if (!ok) return;
    }
    onApplyDutch(state.nl);
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(state.en)) {
      if (!isTranslatableFieldKey(key)) continue;
      patch[`${pathPrefix}:${key}`] = value;
    }
    ai.setEnDrafts(patch);
    setBrief("");
    setState({
      kind: "success",
      message: "NL toegepast en EN-concepten opgeslagen. Nog niet gepubliceerd.",
    });
  };

  const runBatchTranslate = async () => {
    if (!configured || translateEntries.length === 0) return;
    setState({ kind: "loading", phase: "translate" });
    const payload = Object.fromEntries(translateEntries);
    const result = await ai.translateToEn({ fields: payload });
    if (!result.ok) {
      setState({ kind: "error", message: result.error });
      return;
    }
    setState({ kind: "preview-translate", fields: result.fields, warnings: result.warnings });
  };

  const applyTranslate = async () => {
    if (state.kind !== "preview-translate") return;
    const existing = translateEntries.filter(([key]) => {
      const path = `${pathPrefix}:${key}`;
      return Boolean(ai.getEnDraft(path).trim());
    });
    if (existing.length > 0) {
      const ok = await requestCmsOverwriteConfirm(ai, {
        title: "EN-concepten overschrijven?",
        description: `${existing.length} veld(en) hebben al een EN-concept. Overschrijven met deze batchvertaling?`,
        confirmLabel: "Overschrijven",
        cancelLabel: "Annuleren",
        tone: "warning",
      });
      if (!ok) return;
    }
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(state.fields)) {
      if (!isTranslatableFieldKey(key)) continue;
      patch[`${pathPrefix}:${key}`] = value;
    }
    ai.setEnDrafts(patch);
    setState({
      kind: "success",
      message: "Engelse concepten opgeslagen in het concept. Nog niet gepubliceerd.",
    });
  };

  const labelFor = (key: string) => fieldLabels?.[key] ?? key;
  const busy = state.kind === "loading";

  return (
    <div className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-3">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left"
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen((o) => !o)}
      >
        <div className="min-w-0">
          <p className="text-[12px] font-semibold tracking-tight text-white/85">Genereer met AI</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">
            Optioneel — uitklappen om AI-hulp te gebruiken.
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/55">
          {panelOpen ? "Inklappen" : "Uitklappen"}
        </span>
      </button>

      {panelOpen ? (
        <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] leading-relaxed text-white/40">
            Nederlandse tekst voor deze sectie, daarna automatisch EN-concepten. Niet publiceren.
          </p>
        </div>
        <button
          type="button"
          className={primaryAiBtnClass}
          disabled={!canGenerate || busy}
          onClick={() =>
            void runGenerateSection(
              state.kind === "preview-section"
                ? { regenerate: true, previousFields: state.nl }
                : undefined,
            )
          }
          aria-label="Genereer sectie met AI (Nederlands + Engels)"
          title={
            !configured
              ? (ai.statusMessage ?? "AI niet geconfigureerd")
              : !onApplyDutch
                ? "Genereren niet beschikbaar voor deze sectie"
                : targetKeys.length === 0
                  ? "Geen tekstvelden in deze sectie"
                  : "Genereer NL + EN"
          }
        >
          {state.kind === "loading" && state.phase === "generate"
            ? "Bezig…"
            : state.kind === "preview-section" || state.kind === "success"
              ? "Opnieuw genereren"
              : "Genereer met AI"}
        </button>
      </div>

      <div
        className="rounded-xl border border-sky-400/20 bg-sky-500/[0.07] px-3 py-2.5"
        role="note"
        aria-label="Tips voor een goede AI-briefing"
      >
        <p className="text-[11px] font-semibold text-sky-100/95">Zo formuleert u het beste</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-white/55">
          <li>
            Noem <span className="text-white/75">doelgroep</span>,{" "}
            <span className="text-white/75">doel van de sectie</span> en{" "}
            <span className="text-white/75">toon</span> (bijv. kort &amp; krachtig).
          </li>
          <li>
            Geef <span className="text-white/75">concrete feiten</span> die waar mogen blijven
            (regio, USP, dienst) — AI verzint geen cijfers of claims.
          </li>
          <li>
            Tip: zet ook een idee in de velden hieronder; dat stuurt de AI sterker dan alleen een
            lege briefing.
          </li>
        </ul>
        <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-white/45">
          <span className="font-medium text-white/60">Goed:</span>{" "}
          “Hero voor kantoren in Twente; vast eigen team; toon zelfverzekerd; CTA naar offerte.”
          <br />
          <span className="font-medium text-white/60">Zwak:</span> “Maak iets moois over schoonmaak.”
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">
          Briefing
        </span>
        <textarea
          className={cn(inputClass, "min-h-[88px] py-2 text-[13px] leading-relaxed")}
          value={brief}
          placeholder="Bijv. Hero voor zakelijke klanten in Twente. Benadruk vast eigen team en zichtbaar resultaat. Toon: kort en zelfverzekerd. Geen prijsclaims."
          onChange={(e) => setBrief(e.target.value)}
          disabled={busy}
          maxLength={2000}
          aria-describedby="cms-ai-brief-hint"
        />
        <p id="cms-ai-brief-hint" className="text-[10px] leading-snug text-white/35">
          Hoe specifieker de briefing, hoe beter het resultaat. Leeg laten kan — dan gebruikt AI de
          bestaande veldteksten of algemene McCoy-copy.
        </p>
      </label>

      {!configured ? (
        <p className="text-[11px] text-amber-200/85" role="status">
          {ai.statusMessage ?? "AI niet geconfigureerd. Zet GROQ_API_KEY in .env (server)."}
        </p>
      ) : null}

      {configured && targetKeys.length === 0 ? (
        <p className="text-[11px] text-white/40">Geen vertaalbare tekstvelden in deze sectie.</p>
      ) : null}

      {state.kind === "error" ? (
        <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2" role="alert">
          <p className="text-[11px] text-red-100">{state.message}</p>
          <button type="button" className={cn(aiBtnClass, "mt-1.5")} onClick={() => setState({ kind: "idle" })}>
            Sluiten
          </button>
        </div>
      ) : null}

      {state.kind === "success" ? (
        <p className="text-[11px] text-emerald-200/90" role="status">
          {state.message}
        </p>
      ) : null}

      {state.kind === "preview-section" ? (
        <div
          className="space-y-3 rounded-xl border border-sky-400/25 bg-sky-500/[0.08] p-3"
          role="dialog"
          aria-label="AI-sectievoorbeeld"
        >
          <p className="text-[11px] font-semibold text-sky-100">Voorbeeld — nog niet toegepast</p>
          <ul className="max-h-56 space-y-2.5 overflow-y-auto">
            {Object.keys(state.nl).map((key) => (
              <li key={key} className="space-y-1 rounded-lg bg-black/25 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {labelFor(key)}
                </p>
                <p className="text-[12px] leading-snug text-white/90">
                  <span className="text-white/40">NL · </span>
                  {state.nl[key]}
                </p>
                <p className="text-[12px] leading-snug text-sky-100/85">
                  <span className="text-sky-200/50">EN · </span>
                  {state.en[key]}
                </p>
              </li>
            ))}
          </ul>
          {state.warnings.length > 0 ? (
            <ul className="list-disc pl-4 text-[10px] text-amber-100/80">
              {state.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-400"
              onClick={() => void applySection()}
            >
              Toepassen
            </button>
            <button
              type="button"
              className={aiBtnClass}
              disabled={!canGenerate || busy}
              onClick={() =>
                void runGenerateSection(
                  state.kind === "preview-section"
                    ? { regenerate: true, previousFields: state.nl }
                    : undefined,
                )
              }
              aria-label="Opnieuw genereren met AI"
            >
              Opnieuw genereren
            </button>
            <button type="button" className={aiBtnClass} onClick={() => setState({ kind: "idle" })}>
              Annuleren
            </button>
          </div>
        </div>
      ) : null}

      {draftEntries.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-sky-500/15 bg-sky-950/10 p-2.5">
          <div>
            <p className="text-[11px] font-semibold text-sky-100/90">Engelse vertaling</p>
            <p className="mt-0.5 text-[10px] text-white/40">
              Handmatig invullen of via AI hierboven. Concept — nog niet publiceren.
            </p>
          </div>
          {draftEntries.map(({ key, path, value }) => (
            <label key={path} className="block space-y-1">
              <span className="text-[10px] text-white/40">{labelFor(key)}</span>
              <textarea
                className={cn(inputClass, "min-h-[48px] border-sky-500/15 bg-sky-950/15 text-xs text-sky-50/90")}
                value={value}
                placeholder="Engelse vertaling (handmatig — AI overschrijft dit niet)"
                onChange={(e) => ai.setEnDraft(path, e.target.value)}
                aria-label={`${labelFor(key)}: Engelse concepttekst`}
              />
            </label>
          ))}
        </div>
      ) : null}

      <details className="group/ai rounded-xl border border-white/[0.06] bg-black/15 open:bg-black/20">
        <summary className="cursor-pointer list-none px-2.5 py-2 text-[11px] font-medium text-white/40 transition hover:text-white/65 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block text-white/25 transition-transform group-open/ai:rotate-90"
            >
              ▸
            </span>
            Meer AI
            <span className="font-normal text-white/28">· alleen vertalen</span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-white/[0.06] px-2.5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-white/45">Vertaal bestaande NL-tekst naar EN-concepten.</p>
            <button
              type="button"
              className={aiBtnClass}
              disabled={!configured || busy || translateEntries.length === 0}
              onClick={() => void runBatchTranslate()}
              aria-label="Vertaal sectie naar Engels"
            >
              {state.kind === "loading" && state.phase === "translate" ? "Bezig…" : "Vertaal naar EN"}
            </button>
          </div>
          {translateEntries.length === 0 ? (
            <p className="text-[10px] text-white/40">Geen Nederlandse tekst om te vertalen.</p>
          ) : null}
          {state.kind === "preview-translate" ? (
            <div className="space-y-2" role="dialog" aria-label="Sectievertalling voorbeeld">
              <p className="text-[11px] text-sky-100">Voorbeeld — nog niet toegepast</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-white/80">
                {Object.entries(state.fields).map(([key, value]) => (
                  <li key={key}>
                    <span className="text-white/45">{labelFor(key)}:</span> {value}
                  </li>
                ))}
              </ul>
              {state.warnings.length > 0 ? (
                <ul className="list-disc pl-4 text-[10px] text-amber-100/80">
                  {state.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-400"
                  onClick={() => void applyTranslate()}
                >
                  Toepassen
                </button>
                <button
                  type="button"
                  className={aiBtnClass}
                  disabled={!configured || busy || translateEntries.length === 0}
                  onClick={() => void runBatchTranslate()}
                  aria-label="Opnieuw vertalen naar Engels"
                >
                  Opnieuw
                </button>
                <button type="button" className={aiBtnClass} onClick={() => setState({ kind: "idle" })}>
                  Annuleren
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </details>
        </>
      ) : null}
    </div>
  );
}

/**
 * Standalone manual EN draft editor for nested fields (columns, cards, list items)
 * that are not covered by SectionAiToolbar shallow keys.
 * Works without Groq — only needs CmsAiAssistProvider draft getters/setters.
 */
export function ManualEnDraftField({
  fieldPath,
  label,
  multiline = false,
}: {
  fieldPath: string;
  label?: string;
  multiline?: boolean;
}) {
  const ai = useCmsAiAssist();
  if (!ai) return null;
  // EN editor must show only the overlay draft — never NL as a controlled value.
  const value = ai.getEnDraft(fieldPath);
  const onEnChange = (next: string) => {
    ai.setEnDraft(fieldPath, next);
  };
  return (
    <label className="block space-y-1" data-cms-en-draft-path={fieldPath}>
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-sky-300/55">
        {label ? `EN · ${label}` : "EN · handmatig"}
      </span>
      {multiline ? (
        <textarea
          className={cn(inputClass, "min-h-[52px] border-sky-500/15 bg-sky-950/15 text-xs text-sky-50/90")}
          value={value}
          placeholder="Leeg = NL-fallback (Opslaan vult dit niet opnieuw)"
          onChange={(e) => onEnChange(e.target.value)}
          aria-label={label ? `${label}: Engelse vertaling` : "Engelse vertaling (handmatig)"}
        />
      ) : (
        <input
          className={cn(inputClass, "border-sky-500/15 bg-sky-950/15 text-xs text-sky-50/90")}
          value={value}
          placeholder="Leeg = NL-fallback (Opslaan vult dit niet opnieuw)"
          onChange={(e) => onEnChange(e.target.value)}
          aria-label={label ? `${label}: Engelse vertaling` : "Engelse vertaling (handmatig)"}
        />
      )}
    </label>
  );
}

/** Collect plain string values from a shallow content object (skip nested objects and non-copy keys). */
export function collectShallowStringFields(
  content: Record<string, unknown>,
  keys?: string[],
  options?: { includeEmpty?: boolean },
): Record<string, string> {
  const out: Record<string, string> = {};
  const list = keys ?? Object.keys(content);
  for (const key of list) {
    if (!isTranslatableFieldKey(key)) continue;
    const value = content[key];
    if (typeof value === "string") {
      if (value.trim() || options?.includeEmpty) out[key] = value;
    } else if (options?.includeEmpty && keys?.includes(key) && (value === undefined || value === null)) {
      out[key] = "";
    }
  }
  return out;
}
