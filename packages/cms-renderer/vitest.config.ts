import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Guardian runs test:ci right after a full monorepo typecheck; on Windows the
    // default thread pool can hit ERR_IPC_CHANNEL_CLOSED under memory pressure.
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
  },
});
