import * as React from "react";
import {
  FORM_SCOPE_LABEL_MAX,
  formScopeFromLabelInput,
  type FormScopeSnapshot,
} from "@mccoy/cms-schema";
import { Field, inputClass } from "./shared-fields";

export function FormScopeField({
  label = "Aanvragen-scope",
  value,
  onChange,
  hint =
    "Optioneel. Extra filter-tab in Aanvragen (naast type zoals Algemeen). Alleen inzendingen via dit gepubliceerde formulier verschijnen onder die tab. De sleutel blijft stabiel bij hernoemen.",
}: {
  label?: string;
  value?: FormScopeSnapshot;
  onChange: (next: FormScopeSnapshot | undefined) => void;
  hint?: string;
}) {
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Field label={label} hint={hint}>
      <input
        className={inputClass}
        value={value?.label ?? ""}
        maxLength={FORM_SCOPE_LABEL_MAX}
        placeholder="Bijv. Vestiging Amsterdam"
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw.trim()) {
            setError(null);
            onChange(undefined);
            return;
          }
          if (raw.length > FORM_SCOPE_LABEL_MAX) {
            setError(`Maximaal ${FORM_SCOPE_LABEL_MAX} tekens.`);
            return;
          }
          if (/[\r\n\u0000-\u001f\u007f]/.test(raw)) {
            setError("Ongeldige tekens in het label.");
            return;
          }
          const next = formScopeFromLabelInput(raw, value);
          if (!next) {
            setError("Kon geen geldige scope-sleutel afleiden.");
            return;
          }
          setError(null);
          onChange(next);
        }}
      />
      {value?.key ? (
        <p className="mt-1 text-xs text-white/40">
          Sleutel: <code className="text-white/55">{value.key}</code>
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[11px] text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </Field>
  );
}
