import json
from pathlib import Path
from urllib.parse import urlparse

src = Path(r"C:\Users\Ra\Desktop\mccoy_code\.data\aether-staged-fixes.json")
dump = json.loads(src.read_text(encoding="utf-8"))

def dec(s: str) -> str:
    return (
        s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )

by = {}
for row in dump.get("patches", []):
    if row.get("status") != "approved":
        continue
    kind = row.get("kind")
    if kind not in ("title", "meta_description", "h1"):
        continue
    val = dec(str(row.get("proposedValue") or "")).strip()
    if not val:
        continue
    url = row.get("pageUrl") or ""
    path = urlparse(url).path.rstrip("/") or "/"
    prev = by.get(path) or {"url": url, "path": path}
    if kind == "title":
        prev["title"] = val
    elif kind == "meta_description":
        prev["description"] = val
    else:
        prev["h1"] = val
    by[path] = prev

doc = {
    "version": 1,
    "siteId": dump.get("siteId"),
    "notice": "Opt-in Improve overlay. Approved title/meta/H1 apply without CMS publish. Frozen deployed SEO remains the baseline when no approved patch exists.",
    "patches": [by[k] for k in sorted(by)],
}
out = Path(r"C:\Users\Ra\Desktop\mccoy_code\apps\storefront\public\aether-edge-patches.json")
out.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("wrote", out, "patches", len(doc["patches"]))
