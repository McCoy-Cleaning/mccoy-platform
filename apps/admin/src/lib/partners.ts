import { DEFAULT_PARTNER_LOGOS } from "@mccoy/cms-schema";

export const partners: { name: string; src: string }[] = DEFAULT_PARTNER_LOGOS.map((p) => ({
  name: p.name,
  src: p.src,
}));
