import fs from "node:fs";
import path from "node:path";

const roots = [
  "C:\\Users\\Ra\\Desktop",
  "C:\\Users\\Ra\\Downloads",
  "C:\\Users\\Ra\\Documents",
  "C:\\Users\\Ra\\OneDrive",
  "C:\\Users\\Ra\\Desktop\\mccoy_code",
];

const hits = [];

function walk(dir, depth) {
  if (depth < 0) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const lower = e.name.toLowerCase();
    if (e.isFile()) {
      if (
        lower.endsWith(".zip") ||
        lower.endsWith(".rar") ||
        lower.endsWith(".7z") ||
        (lower.includes("mccoy") && (lower.includes("original") || lower.includes("legacy") || lower.includes("backup")))
      ) {
        try {
          const st = fs.statSync(full);
          hits.push({ full, size: st.size, mtime: st.mtime.toISOString() });
        } catch {}
      }
    } else if (e.isDirectory()) {
      if (
        ["node_modules", ".git", "AppData", "Windows", "$Recycle.Bin"].includes(e.name)
      )
        continue;
      walk(full, depth - 1);
    }
  }
}

for (const r of roots) {
  if (fs.existsSync(r)) walk(r, r.includes("mccoy_code") ? 4 : 3);
}

console.log(JSON.stringify(hits, null, 2));
console.log("count", hits.length);

// Also list Desktop top-level for clues
try {
  console.log(
    "Desktop:",
    fs.readdirSync("C:\\Users\\Ra\\Desktop").join(" | "),
  );
} catch (e) {
  console.log("Desktop list failed", e.message);
}
try {
  console.log(
    "Downloads:",
    fs.readdirSync("C:\\Users\\Ra\\Downloads").join(" | "),
  );
} catch (e) {
  console.log("Downloads list failed", e.message);
}
