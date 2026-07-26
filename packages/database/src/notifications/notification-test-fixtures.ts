/**
 * Minimal fake Supabase query-builder for notification engine unit tests.
 * Not a test file itself (no `describe`/`it`) — imported by worker/preferences tests
 * so we can exercise the outbox → worker → recipients pipeline without a live DB.
 */

export type FakeResolution = { data: unknown; error: { message: string; code?: string } | null };

export type FakeCall = { table: string; method: string; args: unknown[] };

type TableScript = FakeResolution[];

/**
 * `script` maps table name → the sequence of resolutions returned for
 * successive `.from(table)` calls (each call consumes the next entry; the
 * last entry repeats once exhausted).
 */
export function createFakeSupabase(script: Record<string, TableScript>) {
  const callIndex: Record<string, number> = {};
  const calls: FakeCall[] = [];

  function nextResolution(table: string): FakeResolution {
    const idx = callIndex[table] ?? 0;
    callIndex[table] = idx + 1;
    const list = script[table] ?? [];
    if (list.length === 0) return { data: null, error: null };
    return list[Math.min(idx, list.length - 1)]!;
  }

  function makeChain(table: string) {
    const resolution = nextResolution(table);
    const record = (method: string, args: unknown[]) => calls.push({ table, method, args });

    const chain: Record<string, unknown> = {};
    const passthrough =
      (method: string) =>
      (...args: unknown[]) => {
        record(method, args);
        return chain;
      };

    chain.select = passthrough("select");
    chain.eq = passthrough("eq");
    chain.in = passthrough("in");
    chain.is = passthrough("is");
    chain.order = passthrough("order");
    chain.limit = passthrough("limit");
    chain.insert = passthrough("insert");
    chain.update = passthrough("update");
    chain.upsert = passthrough("upsert");
    chain.maybeSingle = () => {
      record("maybeSingle", []);
      return Promise.resolve(resolution);
    };
    chain.single = () => {
      record("single", []);
      return Promise.resolve(resolution);
    };
    // Thenable so `await supabase.from(x).insert(y)` resolves without a terminal call.
    chain.then = (
      onFulfilled?: (value: FakeResolution) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(resolution).then(onFulfilled, onRejected);

    return chain;
  }

  return {
    client: {
      from: (table: string) => makeChain(table),
    },
    calls,
  };
}

export function ok(data: unknown): FakeResolution {
  return { data, error: null };
}

export function dbError(message: string, code?: string): FakeResolution {
  return { data: null, error: { message, code } };
}
