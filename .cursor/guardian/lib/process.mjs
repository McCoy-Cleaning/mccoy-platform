import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: options.timeout ?? 120_000,
    env: { ...process.env, ...(options.env ?? {}) },
    input: options.input
  });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    error: result.error?.message ?? null
  };
}

function npmCliPath() {
  return path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
}

export function detectPackageManager(root) {
  // Prefer npm when package-lock.json exists (this monorepo scripts use npm workspaces).
  // Avoid spawning *.cmd on Windows (EINVAL / shell quoting issues) — use node + npm-cli.js.
  if (fs.existsSync(path.join(root, "package-lock.json"))) {
    if (process.platform === "win32" && fs.existsSync(npmCliPath())) {
      return { command: process.execPath, runArgs: [npmCliPath(), "run"] };
    }
    return { command: process.platform === "win32" ? "npm.cmd" : "npm", runArgs: ["run"] };
  }
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) {
    return { command: process.platform === "win32" ? "pnpm.cmd" : "pnpm", runArgs: ["run"] };
  }
  if (fs.existsSync(path.join(root, "yarn.lock"))) {
    return { command: process.platform === "win32" ? "yarn.cmd" : "yarn", runArgs: [] };
  }
  if (fs.existsSync(path.join(root, "bun.lockb")) || fs.existsSync(path.join(root, "bun.lock"))) {
    return { command: process.platform === "win32" ? "bun.exe" : "bun", runArgs: ["run"] };
  }
  if (process.platform === "win32" && fs.existsSync(npmCliPath())) {
    return { command: process.execPath, runArgs: [npmCliPath(), "run"] };
  }
  return { command: process.platform === "win32" ? "npm.cmd" : "npm", runArgs: ["run"] };
}

export function runPackageScript(root, script, timeout = 900_000) {
  const manager = detectPackageManager(root);
  return run(manager.command, [...manager.runArgs, script], { cwd: root, timeout });
}
