import type { FormKind } from "./forms";
import type { InquiryStatus, RequestStatus } from "./requests";

export const KIND_LABELS: Record<FormKind, string> = {
  inquiry: "Algemeen",
  glass_washing: "Glasbewassing",
  furniture_cleaning: "Meubels",
  job_application: "Sollicitatie",
  newsletter: "Nieuwsbrief",
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "Nieuw",
  open: "Open",
  replied: "Beantwoord",
  closed: "Gesloten",
  spam: "Spam",
};

/** Dutch labels for the inquiry workflow status (staff triage label). */
export const INQUIRY_STATUS_LABELS_NL: Record<InquiryStatus, string> = {
  new: "Nieuw",
  in_progress: "In behandeling",
  invoiced: "Gefactureerd",
};

export const FIELD_LABELS_NL: Record<string, string> = {
  name: "Naam",
  email: "E-mail",
  phone: "Telefoon",
  company: "Bedrijf",
  message: "Bericht",
  floors: "Verdiepingen",
  windows: "Ramen",
  height: "Hoogte (m)",
  access: "Toegang",
  sides: "Zijden",
  frequency: "Frequentie",
  item: "Type item",
  pieces: "Aantal",
  material: "Materiaal",
  area: "Oppervlakte (m²)",
  stains: "Vlekken / notities",
  photos: "Foto's",
  role: "Functie",
  motivation: "Motivatie",
  cv: "CV",
  letter: "Motivatiebrief",
  consent: "Consent",
  consentAccepted: "Akkoord privacy",
  sourceBlockId: "CMS-blok",
  scopeLabel: "Scope",
  scopeKey: "Scope-sleutel",
};
