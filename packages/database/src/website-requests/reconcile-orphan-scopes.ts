/**
 * When published CMS forms drop a scope, clear that scope on website_requests
 * so Aanvragen treats those rows as unscoped Algemeen (kind unchanged).
 */
import { collectPublishedFormScopes } from "@mccoy/cms-schema";

import { loadPublishedCmsPagesForFormScopes } from "../cms/load-published-form-scopes";
import { jsonWebsiteRequestsStore } from "../json-store";
import { hasSupabaseServiceConfig } from "../supabase";
import { supabaseWebsiteRequestsStore } from "./supabase-store";

/**
 * Active Aanvragen scope keys from live published CMS forms.
 * Returns `null` when published pages cannot be loaded (caller must not clear).
 */
export async function loadActivePublishedFormScopeKeys(): Promise<string[] | null> {
  try {
    const pages = await loadPublishedCmsPagesForFormScopes();
    return collectPublishedFormScopes(pages).map((scope) => scope.key);
  } catch {
    return null;
  }
}

export type ReconcileOrphanScopesResult = {
  cleared: number;
  activeKeys: string[];
};

/**
 * Persistently clear scope_key/scope_label on requests whose scope is no longer
 * present on any published form. Never deletes requests; never changes kind.
 */
export async function reconcileOrphanWebsiteRequestScopes(): Promise<ReconcileOrphanScopesResult> {
  const activeKeys = await loadActivePublishedFormScopeKeys();
  if (activeKeys === null) {
    return { cleared: 0, activeKeys: [] };
  }
  const store = hasSupabaseServiceConfig()
    ? supabaseWebsiteRequestsStore
    : jsonWebsiteRequestsStore;
  const { cleared } = await store.clearOrphanWebsiteRequestScopes(activeKeys);
  return { cleared, activeKeys };
}
