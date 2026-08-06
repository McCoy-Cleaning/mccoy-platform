import * as React from "react";
import type { ContactFormContent } from "@mccoy/cms-schema";
import { InspectTextField } from "../ai-assist";
import { FormScopeField } from "../blocks/FormScopeField";
import { Field, inputClass } from "../inspector-chrome";

export function ContactFormInspector({
  content,
  onPatch,
  formLabel = "Contactformulier",
  sectionKey = "contact.form",
}: {
  content: ContactFormContent;
  onPatch: (patch: Partial<ContactFormContent>) => void;
  formLabel?: string;
  sectionKey?: "contact.form" | "offerte.form";
}) {
  const isOfferte = sectionKey === "offerte.form";
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/50">
        Het {formLabel.toLowerCase()} is vast onderdeel van de pagina: verbergen kan, verwijderen niet.
        Veldlabels komen uit de sitevertalingen.
      </p>
      <Field label="Kop boven formulier (optioneel)">
        <input
          className={inputClass}
          value={content.heading ?? ""}
          onChange={(e) => onPatch({ heading: e.target.value || undefined })}
        />
      </Field>
      {!isOfferte ? (
        <InspectTextField
          label="Introductietekst"
          value={content.body ?? ""}
          onChange={(v) => onPatch({ body: v || undefined })}
          fieldPath={`section:${sectionKey}:body`}
          fieldHint="body"
          multiline
          maxChars={600}
          placeholder="Tekst naast het formulier (links)."
          enableAi={false}
        />
      ) : null}
      {isOfferte ? (
        <>
          <FormScopeField
            label="Scope glasbewassing"
            value={content.glassScope}
            onChange={(glassScope) => onPatch({ glassScope })}
          />
          <FormScopeField
            label="Scope meubelreiniging"
            value={content.furnitureScope}
            onChange={(furnitureScope) => onPatch({ furnitureScope })}
          />
        </>
      ) : (
        <FormScopeField
          value={content.scope}
          onChange={(scope) => onPatch({ scope })}
        />
      )}
    </div>
  );
}
