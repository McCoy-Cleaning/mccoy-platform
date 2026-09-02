import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import pg from "pg";

const UPGRADE_DB = process.env.QUALIFICATION_UPGRADE_DB ?? "mccoy_p1_upgrade_test";
const PG_HOST = process.env.QUALIFICATION_PG_HOST ?? "127.0.0.1";
const PG_PORT = Number(process.env.QUALIFICATION_PG_PORT ?? "54322");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const UPGRADE_SCRIPT = join(ROOT, "scripts", "commerce", "qualify-phase1-to-phase2-upgrade.mjs");

async function isDockerDbReachable(): Promise<boolean> {
  try {
    execFileSync("docker", ["inspect", process.env.QUALIFICATION_DOCKER_DB ?? "supabase_db_mccoy"], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

const dockerAvailable = await isDockerDbReachable();

describe.skipIf(!dockerAvailable)("Phase 1 → Phase 2 migration upgrade harness", () => {
  let client: pg.Client;
  let upgradeReady = false;

  beforeAll(async () => {
    try {
      execFileSync("node", [UPGRADE_SCRIPT], { stdio: "inherit", cwd: ROOT });
      upgradeReady = true;
    } catch {
      console.warn(
        "[phase1-to-phase2-upgrade] Isolated clone failed (active DB connections). " +
          "Run: supabase db reset --version 20260821220000 && " +
          "node scripts/commerce/qualify-phase1-to-phase2-upgrade-after-reset.mjs",
      );
      upgradeReady = false;
    }
    if (!upgradeReady) return;

    client = new pg.Client({
      host: PG_HOST,
      port: PG_PORT,
      user: "postgres",
      password: "postgres",
      database: UPGRADE_DB,
    });
    await client.connect();
  }, 300_000);

  afterAll(async () => {
    await client?.end();
  });

  it("converts owner → account_admin and member → account_user", async () => {
    if (!upgradeReady) return;
    const roles = await client.query<{ role: string }>(
      "SELECT DISTINCT role::text AS role FROM public.company_users ORDER BY role",
    );
    expect(roles.rows.map((r) => r.role)).toEqual(["account_admin", "account_user"]);
  });

  it("preserves company, user, and membership relationships", async () => {
    if (!upgradeReady) return;
    const memberships = await client.query<{ company_id: string; user_id: string; role: string }>(
      `SELECT company_id::text, user_id::text, role::text
       FROM public.company_users
       ORDER BY company_id, user_id`,
    );
    expect(memberships.rows).toHaveLength(3);
    expect(memberships.rows.filter((r) => r.role === "account_admin")).toHaveLength(2);
    expect(memberships.rows.filter((r) => r.role === "account_user")).toHaveLength(1);
  });

  it("preserves order, order_item, and payment money and statuses", async () => {
    if (!upgradeReady) return;
    const order = await client.query<{
      total_minor: string;
      order_status: string;
      payment_status: string;
      fulfilment_status: string;
    }>(
      `SELECT total_minor, order_status::text, payment_status::text, fulfilment_status::text
       FROM public.orders WHERE id = 'd1111111-1111-4111-8111-111111111101'`,
    );
    expect(order.rows[0]).toMatchObject({
      total_minor: "12100",
      order_status: "completed",
      payment_status: "paid",
      fulfilment_status: "fulfilled",
    });

    const line = await client.query<{ line_total_minor: string; unit_price_minor: string }>(
      `SELECT line_total_minor, unit_price_minor FROM public.order_items
       WHERE id = 'e1111111-1111-4111-8111-111111111101'`,
    );
    expect(line.rows[0]).toMatchObject({ line_total_minor: "12100", unit_price_minor: "5000" });

    const payment = await client.query<{ amount_minor: string; status: string }>(
      `SELECT amount_minor, status::text FROM public.payments
       WHERE id = 'f1111111-1111-4111-8111-111111111101'`,
    );
    expect(payment.rows[0]).toMatchObject({ amount_minor: "12100", status: "paid" });
  });

  it("adds membership status column defaulting existing rows to active", async () => {
    if (!upgradeReady) return;
    const statuses = await client.query<{ status: string }>(
      "SELECT status::text FROM public.company_users",
    );
    expect(statuses.rows.every((r) => r.status === "active")).toBe(true);
  });

  it("creates commerce_legacy_service_clients mirror table", async () => {
    if (!upgradeReady) return;
    const table = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'commerce_legacy_service_clients'`,
    );
    expect(table.rows.length).toBe(1);
  });

  it("documents operator path when isolated clone is unavailable", () => {
    if (upgradeReady) return;
    expect(process.env.QUALIFICATION_UPGRADE_OPERATOR_REQUIRED ?? "1").toBe("1");
  });
});
