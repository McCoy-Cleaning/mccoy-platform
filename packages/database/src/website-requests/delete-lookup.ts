/**
 * Helpers for Aanvragen delete / list suppress of closed website requests.
 */
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "../supabase";
import { jsonWebsiteRequestsStore } from "../json-store";

/**
 * WR- numbers for closed/spam requests. Used so mailbox copies cannot reappear
 * as graph:/imap: list rows after Aanvragen delete.
 */
export async function listHiddenWebsiteRequestNumbers(): Promise<string[]> {
  if (hasSupabaseServiceConfig()) {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("website_requests")
      .select("number")
      .in("status", ["closed", "spam"])
      .limit(2000);

    if (error) {
      console.error("[website-requests] listHiddenWebsiteRequestNumbers failed", {
        message: error.message.slice(0, 160),
      });
      return [];
    }

    const numbers: string[] = [];
    for (const row of (data as Array<{ number: string }> | null) ?? []) {
      const number = row.number?.trim().toUpperCase();
      if (number) numbers.push(number);
    }
    return numbers;
  }

  const rows = await jsonWebsiteRequestsStore.listWebsiteRequests({ status: "all" });
  return rows
    .filter((r) => r.status === "closed" || r.status === "spam")
    .map((r) => r.number.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Resolve a website_requests.id from a Microsoft Graph message id
 * (mail_messages row or root_graph_message_id).
 */
export async function findWebsiteRequestIdByGraphMessageId(
  graphMessageId: string,
): Promise<string | null> {
  const graphId = graphMessageId.trim();
  if (!graphId || !hasSupabaseServiceConfig()) return null;

  const supabase = createSupabaseServiceClient();

  const { data: mailRow, error: mailError } = await supabase
    .from("website_request_mail_messages")
    .select("request_id")
    .eq("graph_message_id", graphId)
    .limit(1)
    .maybeSingle();

  if (mailError) {
    console.error("[website-requests] find by graph_message_id (mail) failed", {
      message: mailError.message.slice(0, 160),
    });
  } else if (mailRow && typeof (mailRow as { request_id?: string }).request_id === "string") {
    return (mailRow as { request_id: string }).request_id;
  }

  const { data: requestRow, error: requestError } = await supabase
    .from("website_requests")
    .select("id")
    .eq("root_graph_message_id", graphId)
    .limit(1)
    .maybeSingle();

  if (requestError) {
    console.error("[website-requests] find by root_graph_message_id failed", {
      message: requestError.message.slice(0, 160),
    });
    return null;
  }

  const id = (requestRow as { id?: string } | null)?.id;
  return typeof id === "string" ? id : null;
}

/**
 * Resolve website_requests.id by human-readable WR- number (exact match).
 */
export async function findWebsiteRequestIdByNumber(
  requestNumber: string,
): Promise<string | null> {
  const number = requestNumber.trim().toUpperCase();
  if (!number) return null;

  if (hasSupabaseServiceConfig()) {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("website_requests")
      .select("id")
      .ilike("number", number)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[website-requests] find by number failed", {
        message: error.message.slice(0, 160),
      });
      return null;
    }
    const id = (data as { id?: string } | null)?.id;
    return typeof id === "string" ? id : null;
  }

  const rows = await jsonWebsiteRequestsStore.listWebsiteRequests({ status: "all" });
  const hit = rows.find((r) => r.number.trim().toUpperCase() === number);
  return hit?.id ?? null;
}
