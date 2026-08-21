/**
 * Side-effect imports so Vite's SSR env compiles createServerFn modules early.
 * TanStack Start's lazy validate path only runs `?server-fn-module-lookup`, which
 * ingests the AST but does not register handlers — cold sessions then fail with
 * "Invalid server function ID" for modules not yet transformed (e.g. admin-auth).
 */
import "./admin-auth.functions";
import "./admin-overview.functions";
import "./admin-requests.functions";
import "./admin-customers.functions";
import "./cms-publish.functions";
import "./cms-media.functions";
import "./content-ai.functions";
import "./forms.functions";
import "./notifications.functions";
import "./staff-identity.functions";
import "./staff-settings.functions";
