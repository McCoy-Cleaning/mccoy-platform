/**
 * Production admin entry: enable response compression, then run srvx
 * against the built server + client assets.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

process.env.MCCOY_ENABLE_RESPONSE_COMPRESSION = "1";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const serverDir = path.resolve(root, "dist/server");
const serverEntry = path.join(serverDir, "server.js");
// Prefer app-specific override; ignore ambient PORT from other tools/sessions.
const port = process.env.MCCOY_ADMIN_PORT ?? "4174";
process.env.PORT = port;

if (!existsSync(serverEntry)) {
  console.error(`[start-prod] Missing ${serverEntry}. Run "npm run build" first.`);
  process.exit(1);
}

const srvxBin = path.resolve(root, "../../node_modules/srvx/bin/srvx.mjs");
const bin = existsSync(srvxBin) ? srvxBin : null;

const child = bin
  ? spawn(process.execPath, [bin, "--prod", `--port=${port}`, "-s", "../client", "./server.js"], {
      cwd: serverDir,
      stdio: "inherit",
      env: process.env,
    })
  : spawn("npx", ["--yes", "srvx", "--prod", `--port=${port}`, "-s", "../client", "./server.js"], {
      cwd: serverDir,
      stdio: "inherit",
      env: process.env,
      shell: true,
    });

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
