import * as React from "react";
import {
  CmsAiAssistProvider,
  type CmsAiAssistApi,
  type CmsAiGenerateRequest,
  type CmsAiGenerateSectionRequest,
  type CmsAiTranslateRequest,
  type CmsConfirmationRequest,
} from "@mccoy/cms-editor";
import { cms, useEditablePage } from "@/lib/cms/store";
import { canonicalizeEnFieldDraftPath, lookupEnFieldDraft } from "@mccoy/cms-schema";
import {
  generateDutchCopy,
  generateSectionCopy,
  getContentAiStatus,
  translateNlToEn,
} from "@/lib/api/content-ai.functions";
import { appConfirm } from "@/lib/app-dialogs";

/**
 * Wires admin server functions + CMS enFieldDrafts into cms-editor AI controls.
 */
export function AdminCmsContentAiProvider({
  pageId,
  children,
}: {
  pageId: string;
  children: React.ReactNode;
}) {
  const page = useEditablePage(pageId);
  const [configured, setConfigured] = React.useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | undefined>();

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getContentAiStatus();
        if (cancelled) return;
        if (res.ok) {
          setConfigured(res.status.configured);
          setStatusMessage(
            res.status.configured
              ? undefined
              : "AI niet geconfigureerd. Zet GROQ_API_KEY in .env (server) en herstart de admin-app.",
          );
        } else {
          setConfigured(false);
          setStatusMessage(res.error);
        }
      } catch {
        if (!cancelled) {
          setConfigured(false);
          setStatusMessage("Kon AI-status niet ophalen.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const api = React.useMemo<CmsAiAssistApi>(() => {
    return {
      configured,
      statusMessage,
      getEnDraft: (path) => {
        // Always read the live store page — never a closed-over snapshot — so
        // clear → getEnDraft in the same tick cannot resurrect a stale EN draft.
        const live = cms.getEditablePage(pageId) ?? page;
        if (!live) return "";
        return lookupEnFieldDraft(live, path);
      },
      setEnDraft: (path, value) => {
        const live = cms.getEditablePage(pageId) ?? page;
        const key = live ? canonicalizeEnFieldDraftPath(live, path) : path;
        cms.setEnFieldDrafts(pageId, { [key]: value });
      },
      setEnDrafts: (patch) => {
        if (!page) {
          cms.setEnFieldDrafts(pageId, patch);
          return;
        }
        const canonical: Record<string, string> = {};
        for (const [path, value] of Object.entries(patch)) {
          canonical[canonicalizeEnFieldDraftPath(page, path)] = value;
        }
        cms.setEnFieldDrafts(pageId, canonical);
      },
      generateDutch: async (input: CmsAiGenerateRequest) => {
        try {
          const res = await generateDutchCopy({
            data: {
              brief: input.brief,
              currentText: input.currentText,
              fieldHint: input.fieldHint,
              tone: input.tone ?? "catchy",
              maxChars: input.maxChars ?? 280,
              regenerate: input.regenerate,
              previousText: input.previousText,
            },
          });
          if (!res.ok) return { ok: false as const, error: res.error };
          return {
            ok: true as const,
            text: res.result.text,
            warnings: res.result.warnings,
          };
        } catch {
          return {
            ok: false as const,
            error: "Netwerkfout bij AI-generatie. Probeer opnieuw.",
          };
        }
      },
      translateToEn: async (input: CmsAiTranslateRequest) => {
        try {
          const res = await translateNlToEn({
            data: {
              text: input.text,
              fields: input.fields,
              maxCharsPerField: input.maxCharsPerField ?? 2000,
            },
          });
          if (!res.ok) return { ok: false as const, error: res.error };
          return {
            ok: true as const,
            text: res.result.text,
            fields: res.result.fields,
            warnings: res.result.warnings,
          };
        } catch {
          return {
            ok: false as const,
            error: "Netwerkfout bij vertaling. Probeer opnieuw.",
          };
        }
      },
      generateSection: async (input: CmsAiGenerateSectionRequest) => {
        try {
          const res = await generateSectionCopy({
            data: {
              brief: input.brief,
              fields: input.fields,
              tone: input.tone ?? "catchy",
              regenerate: input.regenerate,
              previousFields: input.previousFields,
            },
          });
          if (!res.ok) return { ok: false as const, error: res.error };
          return {
            ok: true as const,
            nl: res.result.nl,
            en: res.result.en,
            warnings: res.result.warnings,
          };
        } catch {
          return {
            ok: false as const,
            error: "Netwerkfout bij sectie-generatie. Probeer opnieuw.",
          };
        }
      },
      confirmOverwrite: async (request: CmsConfirmationRequest) => {
        try {
          return await appConfirm({
            title: request.title,
            description: request.description,
            confirmLabel: request.confirmLabel,
            cancelLabel: request.cancelLabel,
            tone: request.tone,
          });
        } catch {
          return false;
        }
      },
    };
  }, [configured, statusMessage, page, pageId]);

  return <CmsAiAssistProvider value={api}>{children}</CmsAiAssistProvider>;
}
