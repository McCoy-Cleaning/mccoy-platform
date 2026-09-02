import { createSupabaseServiceClient } from "../supabase";

export type CommerceEmailOutboxRow = {
  id: string;
  emailType: string;
  toEmailNormalized: string;
  payload: Record<string, unknown>;
  invitationId: string | null;
  dedupeKey: string | null;
};

export async function enqueueCommerceEmailOutbox(input: {
  emailType: string;
  toEmailNormalized: string;
  invitationId?: string | null;
  dedupeKey?: string | null;
  payload: Record<string, unknown>;
}): Promise<{ id: string; inserted: boolean }> {
  const supabase = createSupabaseServiceClient();

  if (input.dedupeKey) {
    const { data: existing } = await supabase
      .schema("private")
      .from("commerce_email_outbox")
      .select("id")
      .eq("dedupe_key", input.dedupeKey)
      .maybeSingle();
    if (existing?.id) return { id: String(existing.id), inserted: false };
  }

  const { data, error } = await supabase
    .schema("private")
    .from("commerce_email_outbox")
    .insert({
      email_type: input.emailType,
      to_email_normalized: input.toEmailNormalized,
      invitation_id: input.invitationId ?? null,
      dedupe_key: input.dedupeKey ?? null,
      payload: input.payload,
    })
    .select("id")
    .single();

  if (error) {
    if (input.dedupeKey && error.code === "23505") {
      const { data: raced } = await supabase
        .schema("private")
        .from("commerce_email_outbox")
        .select("id")
        .eq("dedupe_key", input.dedupeKey)
        .maybeSingle();
      if (raced?.id) return { id: String(raced.id), inserted: false };
    }
    throw new Error(`enqueueCommerceEmailOutbox: ${error.message}`);
  }

  return { id: String(data.id), inserted: true };
}

export async function listUnprocessedCommerceEmails(limit = 25): Promise<CommerceEmailOutboxRow[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .schema("private")
    .from("commerce_email_outbox")
    .select("id, email_type, to_email_normalized, payload, invitation_id, dedupe_key")
    .is("processed_at", null)
    .is("failed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listUnprocessedCommerceEmails: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    emailType: String(row.email_type),
    toEmailNormalized: String(row.to_email_normalized),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    invitationId: (row.invitation_id as string | null) ?? null,
    dedupeKey: (row.dedupe_key as string | null) ?? null,
  }));
}

export async function markCommerceEmailProcessed(id: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .schema("private")
    .from("commerce_email_outbox")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`markCommerceEmailProcessed: ${error.message}`);
}

export async function markCommerceEmailFailed(id: string, message: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .schema("private")
    .from("commerce_email_outbox")
    .update({
      failed_at: new Date().toISOString(),
      last_error: message.slice(0, 500),
      attempts: 1,
    })
    .eq("id", id);
  if (error) throw new Error(`markCommerceEmailFailed: ${error.message}`);
}
