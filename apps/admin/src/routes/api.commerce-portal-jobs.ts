import { createFileRoute } from "@tanstack/react-router";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import {
  cleanupExpiredWebsiteFormUploadBatches,
  processCommerceEmailOutbox,
  processExpiredCustomerInvitations,
} from "@mccoy/database/server";

/**
 * Secured cron target for invitation reminders and commerce email outbox.
 * Requires `Authorization: Bearer $COMMERCE_CRON_SECRET`.
 */
export const Route = createFileRoute("/api/commerce-portal-jobs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        ensureMonorepoEnvLoaded();
        const secret = process.env.COMMERCE_CRON_SECRET?.trim();
        if (!secret) {
          return new Response("Commerce cron secret not configured", { status: 503 });
        }
        const auth = request.headers.get("authorization");
        if (auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const reminders = await processExpiredCustomerInvitations(25);
        const emails = await processCommerceEmailOutbox(25);
        const websiteFormUploads = await cleanupExpiredWebsiteFormUploadBatches(250);
        return Response.json({ ok: true, reminders, emails, websiteFormUploads });
      },
    },
  },
});
