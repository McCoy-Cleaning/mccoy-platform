import type {
  EnqueueNotificationOutboxInput,
  EnqueueNotificationOutboxResult,
  NotificationOutboxPayload,
  NotificationOutboxRow,
} from "./types";
import { createSupabaseServiceClient } from "../supabase";

function mapOutboxRow(row: Record<string, unknown>): NotificationOutboxRow {
  return {
    id: String(row.id),
    type: String(row.type),
    payload: (row.payload ?? {}) as NotificationOutboxPayload,
    dedupe_key: (row.dedupe_key as string | null) ?? null,
    actor_user_id: (row.actor_user_id as string | null) ?? null,
    created_at: String(row.created_at),
    processed_at: (row.processed_at as string | null) ?? null,
    failed_at: (row.failed_at as string | null) ?? null,
    attempts: Number(row.attempts ?? 0),
    last_error: (row.last_error as string | null) ?? null,
  };
}

/**
 * Enqueue a notification event for the worker.
 * Idempotent when `dedupeKey` is set (unique partial index).
 */
export async function enqueueNotificationOutbox(
  input: EnqueueNotificationOutboxInput,
): Promise<EnqueueNotificationOutboxResult> {
  const supabase = createSupabaseServiceClient();
  const payload: NotificationOutboxPayload = {
    title: input.title,
    body: input.body ?? null,
    destinationPath: input.destinationPath ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? {},
  };

  const insertRow = {
    type: input.type,
    payload,
    dedupe_key: input.dedupeKey ?? null,
    actor_user_id: input.actorUserId ?? null,
  };

  if (input.dedupeKey) {
    const { data: existing, error: existingError } = await supabase
      .from("notification_outbox")
      .select("id")
      .eq("dedupe_key", input.dedupeKey)
      .maybeSingle();
    if (existingError) {
      throw new Error(`enqueueNotificationOutbox lookup failed: ${existingError.message}`);
    }
    if (existing?.id) {
      return { id: String(existing.id), inserted: false };
    }
  }

  const { data, error } = await supabase
    .from("notification_outbox")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    // Race on unique dedupe_key — treat as idempotent hit.
    if (input.dedupeKey && error.code === "23505") {
      const { data: raced, error: raceError } = await supabase
        .from("notification_outbox")
        .select("id")
        .eq("dedupe_key", input.dedupeKey)
        .maybeSingle();
      if (raceError || !raced?.id) {
        throw new Error(`enqueueNotificationOutbox race resolve failed: ${error.message}`);
      }
      return { id: String(raced.id), inserted: false };
    }
    throw new Error(`enqueueNotificationOutbox failed: ${error.message}`);
  }

  return { id: String(data.id), inserted: true };
}

export async function listUnprocessedNotificationOutbox(
  limit = 50,
): Promise<NotificationOutboxRow[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("notification_outbox")
    .select("*")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 200)));

  if (error) {
    throw new Error(`listUnprocessedNotificationOutbox failed: ${error.message}`);
  }

  return (data ?? []).map((row) => mapOutboxRow(row as Record<string, unknown>));
}

export async function markNotificationOutboxProcessed(
  outboxId: string,
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("notification_outbox")
    .update({
      processed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", outboxId);

  if (error) {
    throw new Error(`markNotificationOutboxProcessed failed: ${error.message}`);
  }
}

export async function markNotificationOutboxFailed(
  outboxId: string,
  errorMessage: string,
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data: current, error: readError } = await supabase
    .from("notification_outbox")
    .select("attempts")
    .eq("id", outboxId)
    .maybeSingle();

  if (readError) {
    throw new Error(`markNotificationOutboxFailed read failed: ${readError.message}`);
  }

  const attempts = Number(current?.attempts ?? 0) + 1;
  const safeError = errorMessage.slice(0, 500);

  const { error } = await supabase
    .from("notification_outbox")
    .update({
      attempts,
      failed_at: new Date().toISOString(),
      last_error: safeError,
    })
    .eq("id", outboxId);

  if (error) {
    throw new Error(`markNotificationOutboxFailed failed: ${error.message}`);
  }
}
