import {
  ACTIVE_NOTIFICATION_TYPES,
  getNotificationDefinition,
  isActiveNotificationType,
  type ActiveNotificationType,
} from "@mccoy/notifications/server";

import { createSupabaseServiceClient } from "../supabase";
import type { NotificationPreferenceChannel, NotificationPreferenceView } from "./types";

type PreferenceRowFields = {
  in_app_enabled: boolean;
  browser_enabled: boolean;
  email_enabled: boolean;
};

function defaultsForType(type: ActiveNotificationType): PreferenceRowFields {
  const def = getNotificationDefinition(type);
  return {
    in_app_enabled: def.defaultChannels.includes("in_app"),
    browser_enabled: def.defaultChannels.includes("browser"),
    email_enabled: def.defaultChannels.includes("email"),
  };
}

function toView(
  type: ActiveNotificationType,
  fields: PreferenceRowFields,
): NotificationPreferenceView {
  const def = getNotificationDefinition(type);
  return {
    type,
    category: def.category,
    inAppEnabled: fields.in_app_enabled,
    browserEnabled: fields.browser_enabled,
  };
}

/**
 * List preferences for every implemented (active) notification type.
 * Types without a stored row fall back to the registry's default channels —
 * preference rows are created lazily on first toggle, not proactively.
 */
export async function listNotificationPreferencesForUser(
  userId: string,
): Promise<NotificationPreferenceView[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("notification_type, in_app_enabled, browser_enabled, email_enabled")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`listNotificationPreferencesForUser failed: ${error.message}`);
  }

  const overrides = new Map<string, PreferenceRowFields>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    overrides.set(String(row.notification_type), {
      in_app_enabled: Boolean(row.in_app_enabled),
      browser_enabled: Boolean(row.browser_enabled),
      email_enabled: Boolean(row.email_enabled),
    });
  }

  return ACTIVE_NOTIFICATION_TYPES.map((type) =>
    toView(type, overrides.get(type) ?? defaultsForType(type)),
  );
}

/**
 * Toggle one channel for one notification type. Reads-then-writes the full
 * row so an update to one channel never clobbers the other stored channel.
 * Rejects inactive/unknown types — there is nothing to toggle for a
 * placeholder domain that has no worker or metadata schema yet.
 */
export async function setNotificationPreference(
  userId: string,
  type: string,
  channel: NotificationPreferenceChannel,
  enabled: boolean,
): Promise<NotificationPreferenceView> {
  if (!isActiveNotificationType(type)) {
    throw new Error(`cannot set preference for inactive notification type: ${type}`);
  }

  const supabase = createSupabaseServiceClient();
  const { data: existing, error: readError } = await supabase
    .from("notification_preferences")
    .select("in_app_enabled, browser_enabled, email_enabled")
    .eq("user_id", userId)
    .eq("notification_type", type)
    .maybeSingle();

  if (readError) {
    throw new Error(`setNotificationPreference read failed: ${readError.message}`);
  }

  const current: PreferenceRowFields = existing
    ? {
        in_app_enabled: Boolean(existing.in_app_enabled),
        browser_enabled: Boolean(existing.browser_enabled),
        email_enabled: Boolean(existing.email_enabled),
      }
    : defaultsForType(type);

  const next: PreferenceRowFields = {
    ...current,
    ...(channel === "in_app" ? { in_app_enabled: enabled } : { browser_enabled: enabled }),
  };

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: userId,
      notification_type: type,
      ...next,
    },
    { onConflict: "user_id,notification_type" },
  );

  if (error) {
    throw new Error(`setNotificationPreference upsert failed: ${error.message}`);
  }

  return toView(type, next);
}
