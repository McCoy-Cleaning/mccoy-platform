import * as React from "react";
import {
  Inbox,
  Briefcase,
  GlassWater,
  Sofa,
  HelpCircle,
  Mail,
} from "lucide-react";
import type { FormKind } from "@/lib/forms/types";
import type { KindFilter } from "../types/search";

export const SCOPE_TAB_LIMIT = 5;

export const KIND_FILTERS: {
  id: KindFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { id: "all", label: "Alles", icon: Inbox, color: "#e8e8f0" },
  { id: "job_application", label: "Sollicitatie", icon: Briefcase, color: "#a78bfa" },
  { id: "glass_washing", label: "Glasbewassing", icon: GlassWater, color: "#22d3ee" },
  { id: "furniture_cleaning", label: "Meubels", icon: Sofa, color: "#f59e0b" },
  { id: "inquiry", label: "Algemeen", icon: HelpCircle, color: "#22c55e" },
  { id: "newsletter", label: "Nieuwsbrief", icon: Mail, color: "#38bdf8" },
];

export function kindMeta(kind: FormKind) {
  return KIND_FILTERS.find((f) => f.id === kind) ?? KIND_FILTERS[0]!;
}
