import { createServerFn } from "@tanstack/react-start";
import {
  resolvePublishedContactFormFields,
  resolvePublishedFormScope,
  resolvePublishedJobApplicationFields,
  resolvePublishedQuoteFormFields,
  resolveVacancyApplication,
  validateContactFormSubmission,
} from "@mccoy/cms-schema";
import {
  MAX_WEBSITE_FORM_ATTACHMENT_COUNT,
  MAX_WEBSITE_FORM_ATTACHMENT_FILE_BYTES,
  MAX_WEBSITE_FORM_ATTACHMENT_TOTAL_BYTES,
} from "@mccoy/domain";
import {
  websiteFormPayloadSchema,
  websiteFormPrepareAttachmentsSchema,
} from "@mccoy/validation";
import { isHoneypotTriggered } from "@mccoy/security";

/**
 * Import `@mccoy/email/server` only inside handlers. The package root and
 * `@mccoy/email/contracts` stay free of imapflow/mailparser (node:stream).
 * Same pattern as cms-published.functions.ts — dynamic import of
 * `@mccoy/email/server` keeps Node-only modules out of the client graph.
 */
export const prepareWebsiteFormAttachments = createServerFn({ method: "POST" })
  .validator(websiteFormPrepareAttachmentsSchema)
  .handler(async ({ data }) => {
    try {
      if (isHoneypotTriggered(data.website)) {
        return { ok: true as const, slots: [] };
      }

      const files = data.files ?? [];
      if (files.length > MAX_WEBSITE_FORM_ATTACHMENT_COUNT) {
        return {
          ok: false as const,
          error: `U kunt maximaal ${MAX_WEBSITE_FORM_ATTACHMENT_COUNT} bestanden toevoegen.`,
          code: "validation" as const,
        };
      }

      let totalBytes = 0;
      for (const file of files) {
        if (file.sizeBytes > MAX_WEBSITE_FORM_ATTACHMENT_FILE_BYTES) {
          return {
            ok: false as const,
            error: `Bestand “${file.filename}” is te groot.`,
            code: "validation" as const,
          };
        }
        totalBytes += file.sizeBytes;
      }
      if (totalBytes > MAX_WEBSITE_FORM_ATTACHMENT_TOTAL_BYTES) {
        return {
          ok: false as const,
          error: "De geselecteerde bestanden zijn samen te groot.",
          code: "validation" as const,
        };
      }

      const { loadCmsPageForWebsiteForm, createWebsiteRequestAttachmentUploadSlots } =
        await import("@mccoy/database/server");
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

      const slots = await createWebsiteRequestAttachmentUploadSlots(files);
      return { ok: true as const, slots };
    } catch (error) {
      console.error("[forms] prepare attachments failed", error);
      return {
        ok: false as const,
        error:
          error instanceof Error && error.message
            ? error.message
            : "Bestandsupload kon niet worden voorbereid.",
        code: "provider" as const,
      };
    }
  });

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

      // Authoritative scope from published CMS — ignore client-supplied scope.
      let payload = {
        ...data,
        scope: resolvedForm.form.scope ?? undefined,
      };

      if (data.kind === "inquiry") {
        const resolvedFields = resolvePublishedContactFormFields(page, data.sourceId);
        if (resolvedFields.ok) {
          const validated = validateContactFormSubmission(resolvedFields.fields, data.fields ?? {});
          if (!validated.ok) {
            return { ok: false as const, error: validated.reason, code: "validation" as const };
          }
          payload = { ...payload, fields: validated.sanitized };
        }
      }

      if (data.kind === "glass_washing" || data.kind === "furniture_cleaning") {
        const resolvedFields = resolvePublishedQuoteFormFields(
          page,
          data.sourceId,
          data.kind,
        );
        if (resolvedFields.ok) {
          const validated = validateContactFormSubmission(resolvedFields.fields, data.fields ?? {});
          if (!validated.ok) {
            return { ok: false as const, error: validated.reason, code: "validation" as const };
          }
          payload = { ...payload, fields: validated.sanitized };
        }
      }

      if (data.kind === "job_application") {
        const resolvedFields = resolvePublishedJobApplicationFields(page);
        let workingFields = data.fields ?? {};
        if (resolvedFields.ok) {
          const {
            vacancyId: _vacancyId,
            vacancySlug: _vacancySlugIn,
            vacancyTitleSnapshot: _vacancyTitleSnapshotIn,
            role: _clientRoleIn,
            ...formFields
          } = workingFields;
          const validated = validateContactFormSubmission(resolvedFields.fields, formFields);
          if (!validated.ok) {
            return { ok: false as const, error: validated.reason, code: "validation" as const };
          }
          workingFields = {
            ...validated.sanitized,
            vacancyId: data.fields?.vacancyId ?? "",
            vacancySlug: data.fields?.vacancySlug ?? "",
            vacancyTitleSnapshot: data.fields?.vacancyTitleSnapshot ?? "",
            role: data.fields?.role ?? "",
          };
        }

        const resolved = resolveVacancyApplication(page, workingFields.vacancyId, new Date(), {
          vacancySlug: workingFields.vacancySlug,
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
          } = workingFields;
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
          } = workingFields;
          payload = {
            ...payload,
            fields: {
              ...restFields,
              vacancyId: resolved.fields.vacancyId,
              role: resolved.fields.vacancyTitleSnapshot,
            },
          };
        } else {
          payload = { ...payload, fields: workingFields };
        }
      }

      const { sendWebsiteFormEmail } = await import("@mccoy/email/server");
      await sendWebsiteFormEmail(payload);
      return { ok: true as const };
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
