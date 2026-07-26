import { STAFF_ROLES } from "@mccoy/domain";
import {
  getNotificationDefinition,
  isActiveNotificationType,
  isNotificationType,
  parseNotificationMetadata,
  type NotificationType,
} from "@mccoy/notifications/server";

import {
  listUnprocessedNotificationOutbox,
  markNotificationOutboxFailed,
  markNotificationOutboxProcessed,
} from "./outbox";
import type {
  NotificationOutboxPayload,
  NotificationOutboxRow,
  ProcessNotificationOutboxResult,
} from "./types";
import { createSupabaseServiceClient } from "../supabase";

async function resolveRecipientUserIds(
  resolver: string,
  actorUserId: string | null,
): Promise<string[]> {
  const supabase = createSupabaseServiceClient();

  if (resolver === "actor_only") {
    if (!actorUserId) {
      throw new Error("actor_only resolver requires actor_user_id");
    }
    return [actorUserId];
  }

  if (resolver === "active_staff") {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("account_kind", "staff")
      .eq("status", "active")
      .in("staff_role", [...STAFF_ROLES])
      .is("blocked_at", null);

    if (error) {
      throw new Error(`resolve active_staff failed: ${error.message}`);
    }

    return (data ?? []).map((row) => String(row.id));
  }

  if (resolver.startsWith("future_")) {
    throw new Error(`recipient resolver not implemented: ${resolver}`);
  }

  throw new Error(`unknown recipient resolver: ${resolver}`);
}

function expiresAtFromDays(days: number | undefined): string | null {
  if (days == null || days <= 0) return null;
  const ms = Date.now() + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

async function findNotificationByDedupeKey(
  dedupeKey: string,
): Promise<string | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (error) {
    throw new Error(`findNotificationByDedupeKey failed: ${error.message}`);
  }

  return data?.id ? String(data.id) : null;
}

async function ensureRecipients(
  notificationId: string,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;

  const supabase = createSupabaseServiceClient();
  const rows = userIds.map((userId) => ({
    notification_id: notificationId,
    user_id: userId,
  }));

  const { error } = await supabase
    .from("notification_recipients")
    .upsert(rows, { onConflict: "notification_id,user_id", ignoreDuplicates: true });

  if (error) {
    throw new Error(`ensureRecipients failed: ${error.message}`);
  }
}

async function insertNotificationWithRecipients(params: {
  type: NotificationType;
  payload: NotificationOutboxPayload;
  dedupeKey: string | null;
  actorUserId: string | null;
  recipientUserIds: string[];
}): Promise<string> {
  const def = getNotificationDefinition(params.type);
  const supabase = createSupabaseServiceClient();

  const metadataResult = parseNotificationMetadata(
    params.type,
    params.payload.metadata ?? {},
  );
  if (!metadataResult.ok) {
    throw new Error(`invalid notification metadata: ${metadataResult.error}`);
  }

  const title = params.payload.title?.trim();
  if (!title) {
    throw new Error("notification title is required");
  }

  const insertRow = {
    type: params.type,
    category: def.category,
    severity: def.severity,
    title: title.slice(0, 200),
    body: params.payload.body?.slice(0, 500) ?? null,
    destination_path: params.payload.destinationPath ?? null,
    entity_type: params.payload.entityType ?? null,
    entity_id: params.payload.entityId ?? null,
    metadata: metadataResult.metadata,
    dedupe_key: params.dedupeKey,
    actor_user_id: params.actorUserId,
    expires_at: expiresAtFromDays(def.expiresAfterDays),
  };

  const { data, error } = await supabase
    .from("notifications")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    if (params.dedupeKey && error.code === "23505") {
      const existingId = await findNotificationByDedupeKey(params.dedupeKey);
      if (!existingId) {
        throw new Error(`notification dedupe race resolve failed: ${error.message}`);
      }
      await ensureRecipients(existingId, params.recipientUserIds);
      return existingId;
    }
    throw new Error(`insert notification failed: ${error.message}`);
  }

  const notificationId = String(data.id);
  await ensureRecipients(notificationId, params.recipientUserIds);
  return notificationId;
}

async function processOutboxRow(row: NotificationOutboxRow): Promise<"processed" | "skipped"> {
  if (!isNotificationType(row.type)) {
    throw new Error(`unknown notification type: ${row.type}`);
  }
  if (!isActiveNotificationType(row.type)) {
    throw new Error(`inactive notification type: ${row.type}`);
  }

  const def = getNotificationDefinition(row.type);

  if (row.dedupe_key) {
    const existingId = await findNotificationByDedupeKey(row.dedupe_key);
    if (existingId) {
      const recipientIds = await resolveRecipientUserIds(
        def.recipientResolver,
        row.actor_user_id,
      );
      await ensureRecipients(existingId, recipientIds);
      return "skipped";
    }
  }

  const recipientIds = await resolveRecipientUserIds(
    def.recipientResolver,
    row.actor_user_id,
  );

  if (recipientIds.length === 0) {
    // Nothing to deliver — still mark processed to avoid poison loops.
    return "skipped";
  }

  await insertNotificationWithRecipients({
    type: row.type,
    payload: row.payload,
    dedupeKey: row.dedupe_key,
    actorUserId: row.actor_user_id,
    recipientUserIds: recipientIds,
  });

  return "processed";
}

/**
 * Drain unprocessed notification_outbox rows into notifications + recipients.
 * Idempotent via notifications.dedupe_key.
 */
export async function processNotificationOutbox(
  limit = 50,
): Promise<ProcessNotificationOutboxResult> {
  const rows = await listUnprocessedNotificationOutbox(limit);
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const outcome = await processOutboxRow(row);
      await markNotificationOutboxProcessed(row.id);
      if (outcome === "skipped") skipped += 1;
      else processed += 1;
    } catch (error) {
      failed += 1;
      const message =
        error instanceof Error ? error.message : "notification outbox processing failed";
      console.error("[notification-outbox] consumer failed", row.id, message);
      try {
        await markNotificationOutboxFailed(row.id, message);
      } catch (markError) {
        console.error("[notification-outbox] mark failed", row.id, markError);
      }
    }
  }

  return { processed, failed, skipped };
}
