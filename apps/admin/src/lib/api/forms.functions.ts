import { createServerFn } from "@tanstack/react-start";
import { resolvePublishedFormScope, resolveVacancyApplication } from "@mccoy/cms-schema";
import { websiteFormPayloadSchema } from "@mccoy/validation";

export const submitWebsiteForm = createServerFn({ method: "POST" })
  .validator(websiteFormPayloadSchema)
  .handler(async ({ data }) => {
    try {
      const { loadCmsPageForWebsiteForm } = await import("@mccoy/database/server");
      const page = await loadCmsPageForWebsiteForm(data.pageId);

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
        const resolved = resolveVacancyApplication(page, data.fields?.vacancyId, new Date(), {
          vacancySlug: data.fields?.vacancySlug,
        });
        const hasJobsBlock = Boolean(page?.blocks?.some((b) => b.type === "jobs"));
        if (hasJobsBlock) {
          if (!resolved.ok) {
            return { ok: false as const, error: resolved.reason, code: "validation" as const };
          }
          const {
            vacancySlug: _vacancySlug,
            vacancyTitleSnapshot: _vacancyTitleSnapshot,
            role: _clientRole,
            ...restFields
          } = data.fields ?? {};
          payload = {
            ...payload,
            fields: {
              ...restFields,
              vacancyId: resolved.fields.vacancyId,
              role: resolved.fields.vacancyTitleSnapshot,
            },
          };
        } else if (resolved.ok) {
          const {
            vacancySlug: _vacancySlug,
            vacancyTitleSnapshot: _vacancyTitleSnapshot,
            role: _clientRole,
            ...restFields
          } = data.fields ?? {};
          payload = {
            ...payload,
            fields: {
              ...restFields,
              vacancyId: resolved.fields.vacancyId,
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
