import * as React from "react";
import {
  JOB_APPLICATION_CUSTOM_FIELD_TYPES,
  createFormFieldItem,
  createFormFieldOption,
  FORM_FIELD_TYPE_LABELS_NL,
  localImage,
  resolveSafeVideoEmbed,
  type CmsImage,
  type FormFieldItem,
  type FormFieldOption,
  type FormFieldType,
  type VacaturesApplicationContent,
  type VacaturesApplicationMedia,
} from "@mccoy/cms-schema";
import {
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
import { ObjectListEditor } from "./ObjectListEditor";
import { FormScopeField } from "./FormScopeField";
import { EnDraftFor, NlEnField, sectionEnPath } from "./en-draft-fields";
import { BlockImageField, Field, Section, inputClass, selectClass } from "./shared-fields";
import type { CmsImagePickerProps } from "../image-picker-props";

const VACATURES_APP_COPY_KEYS = [
  "formEyebrow",
  "formIntro",
  "mediaEyebrow",
  "mediaHeading",
  "mediaBadge",
  "mediaLinkLabel",
] as const;

const FALLBACK_IMAGE = localImage("/images/hero-placeholder.jpg", "Afbeelding");

function FormFieldOptionsEditor({
  options,
  onChange,
  enPathPrefix,
}: {
  options: FormFieldOption[];
  onChange: (next: FormFieldOption[]) => void;
  enPathPrefix?: string;
}) {
  return (
    <ObjectListEditor<FormFieldOption>
      items={options}
      onChange={onChange}
      createItem={() => createFormFieldOption("Optie")}
      cloneItem={(item) => ({ ...item, id: createFormFieldOption(item.label).id })}
      addLabel="Optie toevoegen"
      renderItem={(option, actions, optionIndex) => (
        <div className="space-y-3">
          <Field label="Label">
            <input
              className={inputClass}
              value={option.label}
              onChange={(e) => actions.update({ ...option, label: e.target.value })}
            />
          </Field>
          {enPathPrefix ? (
            <EnDraftFor
              fieldPath={`${enPathPrefix}.options.${optionIndex}.label`}
              label="Label"
            />
          ) : null}
          <Field label="Waarde (optioneel)" hint="Stabiele sleutel; leeg = afgeleid uit label.">
            <input
              className={inputClass}
              value={option.value ?? ""}
              onChange={(e) =>
                actions.update({ ...option, value: e.target.value.trim() || undefined })
              }
            />
          </Field>
        </div>
      )}
    />
  );
}

export function VacaturesApplicationInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  content: VacaturesApplicationContent;
  onPatch: (patch: Partial<VacaturesApplicationContent>) => void;
} & CmsImagePickerProps) {
  const media = content.media;
  const embed =
    media.kind === "video" ? resolveSafeVideoEmbed(media.videoUrl ?? "") : null;

  const setMedia = (next: VacaturesApplicationMedia) => onPatch({ media: next });
  const imageProps: CmsImagePickerProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };

  const pathPrefix = "section:vacatures.application";
  const aiFields = collectShallowStringFields(
    content as unknown as Record<string, unknown>,
    [...VACATURES_APP_COPY_KEYS],
    { includeEmpty: true },
  );
  const applyDutch = (nl: Record<string, string>) => {
    const patch: Partial<VacaturesApplicationContent> = {};
    for (const key of VACATURES_APP_COPY_KEYS) {
      if (typeof nl[key] === "string") patch[key] = nl[key] || undefined;
    }
    onPatch(patch);
  };

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-white/55">
        Sollicitatieformulier (links) en media (rechts). Naam en e-mail zijn altijd verplicht op de
        site; hier configureer je extra velden, uploads en de video of foto. Engelse concepten en AI
        staan in het paneel hieronder; Opslaan vult ontbrekende EN-drafts vanuit NL.
      </p>

      <SectionAiToolbar
        pathPrefix={pathPrefix}
        fields={aiFields}
        fieldLabels={{
          formEyebrow: "Formulier-eyebrow",
          formIntro: "Formulier-intro",
          mediaEyebrow: "Media-eyebrow",
          mediaHeading: "Media-kop",
          mediaBadge: "Video-badge",
          mediaLinkLabel: "Linklabel",
        }}
        onApplyDutch={applyDutch}
      />

      <Section title="Formulier">
        <NlEnField label="Eyebrow" enPath={sectionEnPath("vacatures.application", "formEyebrow")}>
          <input
            className={inputClass}
            value={content.formEyebrow ?? ""}
            onChange={(e) => onPatch({ formEyebrow: e.target.value || undefined })}
            placeholder="Sollicitatieformulier"
          />
        </NlEnField>
        <NlEnField
          label="Introductietekst"
          enPath={sectionEnPath("vacatures.application", "formIntro")}
          multiline
        >
          <textarea
            className={`${inputClass} min-h-[4rem]`}
            value={content.formIntro ?? ""}
            onChange={(e) => onPatch({ formIntro: e.target.value || undefined })}
            placeholder="Vul je gegevens in…"
          />
        </NlEnField>
        <FormScopeField
          label="Scope sollicitatieformulier"
          value={content.applicationScope}
          onChange={(applicationScope) => onPatch({ applicationScope })}
        />
      </Section>

      <Section title="Velden">
        <p className="text-[13px] leading-relaxed text-white/50">
          <span className="text-white/70">Naam</span> en{" "}
          <span className="text-white/70">E-mail</span> staan standaard op het formulier. Voeg
          telefoon, tekstvakken, keuzelijsten of bestandsuploads (CV / brief) toe. Het{" "}
          <span className="text-white/70">label</span> is wat de bezoeker ziet; het veldtype bepaalt
          invoercontrole.
        </p>
        <ObjectListEditor<FormFieldItem>
          items={content.fields}
          onChange={(fields) => onPatch({ fields })}
          createItem={() => createFormFieldItem("Nieuw veld", "text")}
          cloneItem={(item) => ({
            ...item,
            id: createFormFieldItem(item.label, item.type).id,
            options: item.options?.map((option) => ({
              ...option,
              id: createFormFieldOption(option.label, option.value).id,
            })),
          })}
          addLabel="Veld toevoegen"
          renderItem={(item, actions, index) => (
            <div className="space-y-3">
              <NlEnField
                label="Label"
                enPath={sectionEnPath("vacatures.application", `fields.${index}.label`)}
              >
                <input
                  className={inputClass}
                  value={item.label}
                  onChange={(e) => actions.update({ ...item, label: e.target.value })}
                />
              </NlEnField>
              <NlEnField
                label="Placeholder"
                enPath={sectionEnPath("vacatures.application", `fields.${index}.placeholder`)}
              >
                <input
                  className={inputClass}
                  value={item.placeholder ?? ""}
                  onChange={(e) =>
                    actions.update({
                      ...item,
                      placeholder: e.target.value || undefined,
                    })
                  }
                />
              </NlEnField>
              <Field
                label="Veldtype"
                hint="Bepaalt opslag en invoercontrole — niet hetzelfde als het zichtbare label."
              >
                <select
                  className={selectClass}
                  value={item.type}
                  onChange={(e) => {
                    const type = e.target.value as FormFieldType;
                    const next: FormFieldItem = {
                      ...item,
                      type,
                      options:
                        type === "select"
                          ? item.options?.length
                            ? item.options
                            : [createFormFieldOption("Optie 1"), createFormFieldOption("Optie 2")]
                          : undefined,
                    };
                    actions.update(next);
                  }}
                >
                  {JOB_APPLICATION_CUSTOM_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {FORM_FIELD_TYPE_LABELS_NL[type]}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-[13px] text-white/70">
                <input
                  type="checkbox"
                  checked={Boolean(item.required)}
                  onChange={(e) => actions.update({ ...item, required: e.target.checked })}
                />
                Verplicht
              </label>
              {item.type === "select" ? (
                <div className="space-y-3">
                  <p className="text-[13px] font-medium text-white/55">Keuzeopties</p>
                  <FormFieldOptionsEditor
                    options={item.options ?? []}
                    onChange={(options) => actions.update({ ...item, options })}
                    enPathPrefix={`section:vacatures.application:fields.${index}`}
                  />
                </div>
              ) : null}
            </div>
          )}
        />
      </Section>

      <Section title="Media (rechts)">
        <NlEnField
          label="Eyebrow"
          enPath={sectionEnPath("vacatures.application", "mediaEyebrow")}
        >
          <input
            className={inputClass}
            value={content.mediaEyebrow ?? ""}
            onChange={(e) => onPatch({ mediaEyebrow: e.target.value || undefined })}
            placeholder="Maak kennis met McCoy"
          />
        </NlEnField>
        <NlEnField
          label="Kop / intro"
          enPath={sectionEnPath("vacatures.application", "mediaHeading")}
          multiline
        >
          <textarea
            className={`${inputClass} min-h-[4rem]`}
            value={content.mediaHeading ?? ""}
            onChange={(e) => onPatch({ mediaHeading: e.target.value || undefined })}
          />
        </NlEnField>
        <Field label="Mediatype">
          <select
            className={selectClass}
            value={media.kind}
            onChange={(e) => {
              const kind = e.target.value as VacaturesApplicationMedia["kind"];
              if (kind === "video") {
                setMedia({
                  kind: "video",
                  videoUrl:
                    media.kind === "video"
                      ? media.videoUrl
                      : "https://www.facebook.com/McCoyCleaning/videos/4269581773264540/",
                  shareUrl: media.kind === "video" ? media.shareUrl : undefined,
                });
              } else {
                setMedia({
                  kind: "image",
                  image: media.kind === "image" ? media.image : FALLBACK_IMAGE,
                });
              }
            }}
          >
            <option value="video">Video (YouTube, Vimeo of Facebook)</option>
            <option value="image">Foto</option>
          </select>
        </Field>

        {media.kind === "video" ? (
          <>
            <Field
              label="Video-URL"
              hint={
                embed?.ok
                  ? `Embed: ${embed.provider}`
                  : embed?.reason || "YouTube, Vimeo, Facebook of McCoy-host"
              }
            >
              <input
                className={inputClass}
                value={media.videoUrl}
                onChange={(e) => setMedia({ ...media, videoUrl: e.target.value })}
                placeholder="https://www.facebook.com/…/videos/…"
              />
            </Field>
            <Field label="Deellink (optioneel)" hint="Link onder de video, bijv. Open op Facebook.">
              <input
                className={inputClass}
                value={media.shareUrl ?? ""}
                onChange={(e) =>
                  setMedia({ ...media, shareUrl: e.target.value.trim() || undefined })
                }
                placeholder="https://www.facebook.com/share/…"
              />
            </Field>
            <NlEnField
              label="Badge op video (optioneel)"
              enPath={sectionEnPath("vacatures.application", "mediaBadge")}
            >
              <input
                className={inputClass}
                value={content.mediaBadge ?? ""}
                onChange={(e) => onPatch({ mediaBadge: e.target.value || undefined })}
                placeholder="McCoy on Facebook"
              />
            </NlEnField>
            <NlEnField
              label="Linklabel (optioneel)"
              enPath={sectionEnPath("vacatures.application", "mediaLinkLabel")}
            >
              <input
                className={inputClass}
                value={content.mediaLinkLabel ?? ""}
                onChange={(e) => onPatch({ mediaLinkLabel: e.target.value || undefined })}
                placeholder="Open op Facebook"
              />
            </NlEnField>
          </>
        ) : (
          <BlockImageField
            label="Foto"
            value={media.image}
            preferTags={["about", "team", "cms"]}
            onChange={(image: CmsImage | undefined) => {
              if (image) setMedia({ kind: "image", image });
            }}
            {...imageProps}
          />
        )}
      </Section>
    </div>
  );
}
