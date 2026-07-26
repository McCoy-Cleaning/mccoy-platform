/**
 * Browser-safe entry for `@mccoy/database/client`.
 * Do not re-export server modules (fs, service-role, staff, CMS stores) from here.
 */

export type {
  CreateWebsiteRequestInput,
  ListWebsiteRequestsFilter,
  WebsiteRequestsStore,
} from "./types";

export {
  createBrowserSupabaseClient,
  getBrowserSupabasePublicConfig,
  hasBrowserSupabaseConfig,
  type MccoySupabaseClient,
  type SupabasePublicConfig,
} from "./supabase-browser";
