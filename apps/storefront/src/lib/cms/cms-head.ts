import type { buildCmsHeadFromSnapshot } from "@mccoy/cms-schema";

/** Client-safe: maps CMS head snapshot into TanStack head shape. */
export function tanstackHeadFromCms(head: ReturnType<typeof buildCmsHeadFromSnapshot>) {
  return {
    meta: head.meta,
    links: head.links,
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(head.jsonLd),
      },
    ],
  };
}
