import { DEFAULT_PARTNER_LOGOS, type LogoBackdropResolved } from "@mccoy/cms-schema";

export const partners: {
  name: string;
  src: string;
  backdrop: LogoBackdropResolved;
  cardBackground: string;
}[] = DEFAULT_PARTNER_LOGOS.map((p) => ({
  name: p.name,
  src: p.src,
  backdrop: p.resolvedBackdrop,
  cardBackground: p.cardBackground,
}));
