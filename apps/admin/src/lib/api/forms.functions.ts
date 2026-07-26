import { createServerFn } from "@tanstack/react-start";
import { resolvePublishedFormScope, resolveVacancyApplication, type CmsPage } from "@mccoy/cms-schema";
import { websiteFormPayloadSchema } from "@mccoy/validation";

export const submitWebsiteForm = createServerFn({ method: "POST" })
  .validator(websiteFormPayloadSchema)
  .handler(async ({ data }) => {
    try {
      const { getCmsStore } = await import("@mccoy/database/server");
      const store = getCmsStore();
      const revision = await store.getActivePublishedRevision(data.pageId);
      const page = (revision?.payload ?? null) as CmsPage | null;

      const resolvedForm = resolvePublishedFormScope(page, {
        pageId: data.pageId,
        sourceId: data.sourceId,
        kind: data.kind,
      });
      if (!resolvedForm.ok) {
        return {
          ok: false as const,
          error: resolvedForm.reason,
          code: "validation" as const,
        };
      }

      let payload = {
        ...data,
        scope: resolvedForm.form.scope ?? undefined,
      };

      if (data.kind === "job_application") {
        const resolved = resolveVacancyApplication(page, data.fields?.vacancyId);
        const hasJobsBlock = Boolean(page?.blocks?.some((b) => b.type === "jobs"));
        if (hasJobsBlock) {
          if (!resolved.ok) {
            return { ok: false as const, error: resolved.reason, code: "validation" as const };
          }
          payload = {
            ...payload,
            fields: {
              ...data.fields,
              vacancyId: resolved.fields.vacancyId,
              vacancyTitleSnapshot: resolved.fields.vacancyTitleSnapshot,
              role: resolved.fields.vacancyTitleSnapshot,
            },
          };
        } else if (resolved.ok) {
          payload = {
            ...payload,
            fields: {
              ...data.fields,
              vacancyId: resolved.fields.vacancyId,
              vacancyTitleSnapshot: resolved.fields.vacancyTitleSnapshot,
              role: resolved.fields.vacancyTitleSnapshot,
            },
          };
        }
      }

      const { FormSubmitError, sendWebsiteFormEmail } = await import("@mccoy/email/server");
      try {
        await sendWebsiteFormEmail(payload);
        return { ok: true as const };
      } catch (error) {
        if (error instanceof FormSubmitError) {
          return { ok: false as const, error: error.message, code: error.code };
        }
        throw error;
      }
    } catch (error) {
      const { FormSubmitError } = await import("@mccoy/email/server");
      if (error instanceof FormSubmitError) {
        return { ok: false as const, error: error.message, code: error.code };
      }
      console.error("[forms] unexpected submit error", error);
      return {
        ok: false as const,
        error: "Something went wrong. Please try again later.",
        code: "provider" as const,
      };
    }
  });
