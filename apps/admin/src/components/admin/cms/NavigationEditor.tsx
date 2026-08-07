import * as React from "react";
import {
  createNavLink,
  DEFAULT_NAV_LOGO,
  LOGO_HEIGHT_DESKTOP_MAX,
  LOGO_HEIGHT_DESKTOP_MIN,
  LOGO_HEIGHT_MOBILE_MAX,
  LOGO_HEIGHT_MOBILE_MIN,
  resolveLogoHeightDesktop,
  resolveLogoHeightMobile,
  type SiteNavLink,
  type SiteNavigationContent,
} from "@mccoy/cms-schema";
import { PrototypeImageField, TypedLinkField } from "@mccoy/cms-editor";
import { Plus, Trash2 } from "lucide-react";
import { cms, useCms, useSiteNavigation } from "@/lib/cms/store";
import { CMS_PROJECT_IMAGES, cmsMediaUrl, storefrontOrigin } from "@/lib/cms/project-images";
import { uploadCmsMediaFromFile } from "@/lib/cms/media-client";
import { useCmsImagePickerProps } from "@/lib/cms/use-cms-image-picker-props";
import { cn } from "@/lib/utils";
import { appConfirm } from "@/lib/app-dialogs";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/30";

const smallBtnClass =
  "rounded-lg border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50";

export function NavigationEditor() {
  const state = useCms();
  const navigation = useSiteNavigation();
  // Enable Opslaan whenever a navigation draft exists (unsaved concept).
  // Prefer presence over deep-equal dirty checks so React snapshot / persist edge cases
  // cannot leave the button stuck disabled while the editor shows live edits.
  const hasDraft = state.navigationDraft != null;
  const [statusMessage, setStatusMessage] = React.useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);
  const assetBaseUrl = storefrontOrigin();
  const { mediaLibraryItems, resolveProjectImage } = useCmsImagePickerProps();

  const patch = (
    next: Partial<{ [K in keyof SiteNavigationContent]: SiteNavigationContent[K] | null }>,
  ) => {
    const result = cms.patchNavigation(next);
    if (!result.ok) {
      setStatusMessage({ tone: "err", text: result.reason });
      return;
    }
    setStatusMessage(null);
  };

  const onSave = () => {
    void (async () => {
      const result = await cms.saveNavigation();
      if (!result.ok) {
        setStatusMessage({ tone: "err", text: result.reason });
        return;
      }
      setStatusMessage({ tone: "ok", text: "Navigatie opgeslagen." });
    })();
  };

  const onDiscard = () => {
    void (async () => {
      if (
        !(await appConfirm({
          title: "Navigatiewijzigingen verwerpen?",
          description:
            "Niet-opgeslagen wijzigingen aan logo, links of knoppen verdwijnen. De laatst opgeslagen navigatie blijft actief.",
          confirmLabel: "Verwerpen",
          tone: "destructive",
        }))
      ) {
        return;
      }
      cms.discardNavigationDraft();
      setStatusMessage(null);
    })();
  };

  const updateLink = (id: string, partial: Partial<SiteNavLink>) => {
    patch({
      links: navigation.links.map((link) => (link.id === id ? { ...link, ...partial } : link)),
    });
  };

  const logoValue = navigation.logo ?? DEFAULT_NAV_LOGO;
  const desktopHeight = resolveLogoHeightDesktop(navigation);
  const mobileHeight = resolveLogoHeightMobile(navigation);
  const usingDefaultLogo = !navigation.logo;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Navigatielogo</h3>
          {navigation.logo ? (
            <button type="button" className={smallBtnClass} onClick={() => patch({ logo: null })}>
              Standaardlogo herstellen
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="grid h-20 w-36 place-items-center rounded-lg border border-white/10 bg-[#0b0d12] px-2">
            <img
              src={cmsMediaUrl(logoValue.src, assetBaseUrl)}
              alt=""
              style={{ height: Math.min(desktopHeight, 64) }}
              className="max-w-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium text-white/85">
              {usingDefaultLogo ? "Huidig: standaard McCoy-logo" : "Huidig: aangepast logo"}
            </p>
            <p className="truncate font-mono text-[10px] text-white/40">
              {logoValue.src.startsWith("data:") ? "data:… (geüpload)" : logoValue.src}
            </p>
          </div>
        </div>

        <PrototypeImageField
          label="Logo vervangen"
          value={logoValue}
          projectImages={CMS_PROJECT_IMAGES}
          assetBaseUrl={assetBaseUrl}
          preferTags={["logo", "nav", "brand"]}
          mediaLibraryItems={mediaLibraryItems}
          resolveProjectImage={resolveProjectImage}
          uploadToMediaLibrary={async ({ file, profile, tags, alt }) => {
            const result = await uploadCmsMediaFromFile({
              file,
              profile,
              tags,
              altDefault: alt,
            });
            if (!result.ok) return { ok: false, reason: result.error };
            return {
              ok: true,
              image: result.image,
              label: result.asset.originalFilename || file.name,
              reused: result.reused,
            };
          }}
          onChange={(logo) => patch({ logo })}
          onClear={navigation.logo ? () => patch({ logo: null }) : undefined}
        />
        <p className="text-[10px] text-white/40">
          Upload naar de mediabibliotheek (Supabase Storage) of kies een projectbestand (bij voorkeur
          via Storage na seed). Opslaan synchroniseert naar de storefront.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-white/45">
              <span>Desktop-hoogte</span>
              <span className="font-mono text-white/70">{desktopHeight}px</span>
            </span>
            <input
              type="range"
              min={LOGO_HEIGHT_DESKTOP_MIN}
              max={LOGO_HEIGHT_DESKTOP_MAX}
              value={desktopHeight}
              onChange={(e) => patch({ logoHeightDesktop: Number(e.target.value) })}
              className="w-full accent-sky-400"
              aria-label="Logohoogte desktopnavigatie"
            />
            <p className="text-[10px] text-white/35">Bovenste balk vanaf tablet/desktop</p>
          </label>
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-white/45">
              <span>Mobiel-hoogte</span>
              <span className="font-mono text-white/70">{mobileHeight}px</span>
            </span>
            <input
              type="range"
              min={LOGO_HEIGHT_MOBILE_MIN}
              max={LOGO_HEIGHT_MOBILE_MAX}
              value={mobileHeight}
              onChange={(e) => patch({ logoHeightMobile: Number(e.target.value) })}
              className="w-full accent-sky-400"
              aria-label="Logohoogte mobiele navigatie"
            />
            <p className="text-[10px] text-white/35">Bovenste balk op mobiel én in het menu</p>
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">
            Menu-links ({navigation.links.length})
          </h3>
        </div>
        <p className="text-[11px] leading-relaxed text-white/45">
          Extra custom pagina’s verschijnen hier automatisch na Opslaan wanneer “Toon in
          navigatie” aan staat (max. 3 extra). Verwijder een link hier of schakel de optie uit
          op de pagina.
        </p>
        <div className="space-y-3">
          {navigation.links.map((item, index) => (
            <div
              key={item.id}
              className="space-y-2.5 rounded-xl border border-white/[0.08] bg-black/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-white/40">#{index + 1}</span>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-white/70 transition hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                  aria-label={`Link ${index + 1} verwijderen`}
                  onClick={() =>
                    patch({ links: navigation.links.filter((l) => l.id !== item.id) })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <label className="block space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-white/45">Label</span>
                <input
                  className={inputClass}
                  value={item.label}
                  onChange={(e) => updateLink(item.id, { label: e.target.value })}
                />
              </label>
              <TypedLinkField
                label="Link"
                value={item.link}
                onChange={(link) => {
                  if (!link) return;
                  updateLink(item.id, { link });
                }}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 py-2.5 text-[12px] font-semibold text-white/75 transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
          onClick={() => patch({ links: [...navigation.links, createNavLink()] })}
        >
          <Plus className="h-3.5 w-3.5" />
          Link toevoegen
        </button>
      </section>

      <CtaEditor
        title="Vacatures-knop"
        cta={navigation.jobsCta}
        onChange={(jobsCta) => patch({ jobsCta })}
        onClear={() => patch({ jobsCta: null })}
      />
      <CtaEditor
        title="Offerte-knop"
        cta={navigation.quoteCta}
        onChange={(quoteCta) => patch({ quoteCta })}
        onClear={() => patch({ quoteCta: null })}
      />

      <div className="space-y-2 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!hasDraft}
            onClick={onSave}
            className="rounded-xl bg-[#1e88e5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Opslaan
          </button>
          <button
            type="button"
            disabled={!hasDraft}
            onClick={onDiscard}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 disabled:opacity-40"
          >
            Concept verwerpen
          </button>
          {hasDraft ? (
            <span className="text-[11px] text-amber-300">Niet-opgeslagen navigatiewijzigingen</span>
          ) : (
            <span className="text-[11px] text-white/40">Alles opgeslagen</span>
          )}
        </div>
        <p className="text-[11px] text-white/40">
          Na Opslaan verschijnt de navigatie op de live site. Open storefront-tabs vernieuwen
          vanzelf via sync; anders één keer verversen. Bij admin op :5174 moet de storefront
          (:5173) draaien.
        </p>
        {statusMessage ? (
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "text-[12px]",
              statusMessage.tone === "ok" ? "text-emerald-300" : "text-red-300",
            )}
          >
            {statusMessage.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CtaEditor({
  title,
  cta,
  onChange,
  onClear,
}: {
  title: string;
  cta: SiteNavigationContent["jobsCta"];
  onChange: (cta: NonNullable<SiteNavigationContent["jobsCta"]>) => void;
  onClear: () => void;
}) {
  if (!cta) {
    return (
      <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button
          type="button"
          className={smallBtnClass}
          onClick={() =>
            onChange({
              label: title.includes("Offerte") ? "Vraag een offerte aan" : "Vacatures",
              link: {
                type: "internal_route",
                route: title.includes("Offerte") ? "offerte" : "vacatures",
              },
            })
          }
        >
          Knop toevoegen
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button type="button" className={smallBtnClass} onClick={onClear}>
          Knop verwijderen
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] uppercase tracking-wider text-white/45">Label</span>
        <input
          className={inputClass}
          value={cta.label}
          onChange={(e) => onChange({ ...cta, label: e.target.value })}
        />
      </label>
      <TypedLinkField
        label="Link"
        value={cta.link}
        onChange={(link) => {
          if (!link) {
            onClear();
            return;
          }
          onChange({ ...cta, link });
        }}
      />
    </section>
  );
}
