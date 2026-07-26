/**
 * Root `@mccoy/database` is shared/contracts-only.
 * Prefer:
 * - `@mccoy/database/client` for browser-safe Supabase helpers
 * - `@mccoy/database/server` for Node/server data access
 *
 * Do not re-export server modules from this root.
 */

export type {
  CreateWebsiteRequestInput,
  ListWebsiteRequestsFilter,
  WebsiteRequestsStore,
} from "./types";

export type {
  MccoySupabaseClient,
  SupabasePublicConfig,
} from "./supabase-browser";
