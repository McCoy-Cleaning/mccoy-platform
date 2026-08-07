import * as React from "react";
import {
  createFooterContactRow,
  createFooterLink,
  createFooterSocialLink,
  DEFAULT_FOOTER_LOGO,
  FOOTER_LOGO_HEIGHT_MAX,
  FOOTER_LOGO_HEIGHT_MIN,
  resolveFooterLogoHeight,
  type SiteFooterContactRow,
  type SiteFooterContent,
  type SiteFooterLink,
  type SiteFooterSocialLink,
} from "@mccoy/cms-schema";
import { PrototypeImageField, TypedLinkField } from "@mccoy/cms-editor";
import { Plus, Trash2 } from "lucide-react";
import { cms, useCms, useSiteFooter } from "@/lib/cms/store";
import { CMS_PROJECT_IMAGES, cmsMediaUrl, storefrontOrigin } from "@/lib/cms/project-images";
import { uploadCmsMediaFromFile } from "@/lib/cms/media-client";
import { useCmsImagePickerProps } from "@/lib/cms/use-cms-image-picker-props";
import { appConfirm } from "@/lib/app-dialogs";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/30";

const smallBtnClass =
  "rounded-lg border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50";

export function FooterEditor() {
  const state = useCms();
  const footer = useSiteFooter();
  const hasDraft = state.footerDraft != null;
  const [statusMessage, setStatusMessage] = React.useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);
  const assetBaseUrl = storefrontOrigin();
  const { mediaLibraryItems, resolveProjectImage } = useCmsImagePickerProps();

  const patch = (
    next: Partial<{ [K in keyof SiteFooterContent]: SiteFooterContent[K] | null }>,
  ) => {
    const result = cms.patchFooter(next);
    if (!result.ok) {
      setStatusMessage({ tone: "err", text: result.reason });
      return;
    }
    setStatusMessage(null);
  };

  const onSave = () => {
    const result = cms.saveFooter();
    if (!result.ok) {
      setStatusMessage({ tone: "err", text: result.reason });
      return;
    }
    setStatusMessage({ tone: "ok", text: "Footer opgeslagen." });
  };

  const onDiscard = () => {
    void (async () => {
      if (
        !(await appConfirm({
          title: "Footerwijzigingen verwerpen?",
          description:
            "Niet-opgeslagen wijzigingen verdwijnen. De laatst opgeslagen footer blijft actief.",
          confirmLabel: "Verwerpen",
          tone: "destructive",
        }))
      ) {
        return;
      }
      cms.discardFooterDraft();
      setStatusMessage(null);
    })();
  };

  const logoValue = footer.logo ?? DEFAULT_FOOTER_LOGO;
  const usingDefaultLogo = !footer.logo;
  const logoHeight = resolveFooterLogoHeight(footer);

  const updateServicesLink = (id: string, partial: Partial<SiteFooterLink>) => {
    patch({
      servicesLinks: footer.servicesLinks.map((l) => (l.id === id ? { ...l, ...partial } : l)),
    });
  };
  const updateExtraLink = (id: string, partial: Partial<SiteFooterLink>) => {
    patch({
      extraLinks: footer.extraLinks.map((l) => (l.id === id ? { ...l, ...partial } : l)),
    });
  };
  const updateLegalLink = (id: string, partial: Partial<SiteFooterLink>) => {
    patch({
      legalLinks: footer.legalLinks.map((l) => (l.id === id ? { ...l, ...partial } : l)),
    });
  };
  const updateSocial = (id: string, partial: Partial<SiteFooterSocialLink>) => {
    patch({
      socialLinks: footer.socialLinks.map((l) => (l.id === id ? { ...l, ...partial } : l)),
    });
  };
  const updateContact = (id: string, partial: Partial<SiteFooterContactRow>) => {
    patch({
      contactRows: footer.contactRows.map((l) => (l.id === id ? { ...l, ...partial } : l)),
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Footerlogo</h3>
          {footer.logo ? (
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
              style={{ height: Math.min(logoHeight, 64) }}
              className="max-w-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium text-white/85">
              {usingDefaultLogo ? "Huidig: standaard McCoy-logo" : "Huidig: aangepast logo"}
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
          onClear={footer.logo ? () => patch({ logo: null }) : undefined}
        />
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-white/45">
            <span>Logohoogte</span>
            <span className="font-mono text-white/70">{logoHeight}px</span>
          </span>
          <input
            type="range"
            min={FOOTER_LOGO_HEIGHT_MIN}
            max={FOOTER_LOGO_HEIGHT_MAX}
            value={logoHeight}
            onChange={(e) => patch({ logoHeight: Number(e.target.value) })}
            className="w-full accent-sky-400"
            aria-label="Logohoogte footer"
          />
          <p className="text-[10px] text-white/35">Zichtbare hoogte in de websitefooter</p>
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wider text-white/45">Tagline</span>
          <textarea
            className={inputClass}
            rows={2}
            value={footer.tagline}
            onChange={(e) => patch({ tagline: e.target.value })}
          />
        </label>
      </section>

      <LinkListEditor
        title="Sociale links"
        items={footer.socialLinks}
        onAdd={() => patch({ socialLinks: [...footer.socialLinks, createFooterSocialLink()] })}
        onRemove={(id) =>
          patch({ socialLinks: footer.socialLinks.filter((l) => l.id !== id) })
        }
        renderItem={(item) => (
          <>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-white/45">Netwerk</span>
              <select
                className={inputClass}
                value={item.network}
                onChange={(e) =>
                  updateSocial(item.id, {
                    network: e.target.value as SiteFooterSocialLink["network"],
                  })
                }
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="other">Anders</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-white/45">Label</span>
              <input
                className={inputClass}
                value={item.label}
                onChange={(e) => updateSocial(item.id, { label: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-white/45">URL</span>
              <input
                className={inputClass}
                value={item.href}
                placeholder="https://…"
                onChange={(e) => updateSocial(item.id, { href: e.target.value })}
              />
            </label>
          </>
        )}
      />

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Dienstenkolom</h3>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wider text-white/45">Titel</span>
          <input
            className={inputClass}
            value={footer.servicesTitle}
            onChange={(e) => patch({ servicesTitle: e.target.value })}
          />
        </label>
        <FooterLinksEditor
          links={footer.servicesLinks}
          onChange={(servicesLinks) => patch({ servicesLinks })}
          onUpdate={updateServicesLink}
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Contactkolom</h3>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wider text-white/45">Titel</span>
          <input
            className={inputClass}
            value={footer.contactTitle}
            onChange={(e) => patch({ contactTitle: e.target.value })}
          />
        </label>
        <div className="space-y-3">
          {footer.contactRows.map((row, index) => (
            <div
              key={row.id}
              className="space-y-2.5 rounded-xl border border-white/[0.08] bg-black/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-white/40">#{index + 1}</span>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-white/70 transition hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-200"
                  aria-label={`Contactregel ${index + 1} verwijderen`}
                  onClick={() =>
                    patch({ contactRows: footer.contactRows.filter((r) => r.id !== row.id) })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <label className="block space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-white/45">Type</span>
                <select
                  className={inputClass}
                  value={row.kind}
                  onChange={(e) =>
                    updateContact(row.id, {
                      kind: e.target.value as SiteFooterContactRow["kind"],
                    })
                  }
                >
                  <option value="address">Adres</option>
                  <option value="phone">Telefoon</option>
                  <option value="email">E-mail</option>
                  <option value="text">Tekst</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-white/45">Tekst</span>
                <input
                  className={inputClass}
                  value={row.label}
                  onChange={(e) => updateContact(row.id, { label: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-white/45">
                  Link (optioneel)
                </span>
                <input
                  className={inputClass}
                  value={row.href ?? ""}
                  placeholder="tel:… / mailto:…"
                  onChange={(e) =>
                    updateContact(row.id, {
                      href: e.target.value.trim() ? e.target.value : undefined,
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 py-2.5 text-[12px] font-semibold text-white/75 transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-white"
          onClick={() =>
            patch({ contactRows: [...footer.contactRows, createFooterContactRow()] })
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Contactregel toevoegen
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Keurmerken</h3>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wider text-white/45">Titel</span>
          <input
            className={inputClass}
            value={footer.certsTitle}
            onChange={(e) => patch({ certsTitle: e.target.value })}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wider text-white/45">
            Labels (één per regel)
          </span>
          <textarea
            className={inputClass}
            rows={3}
            value={footer.certs.join("\n")}
            onChange={(e) =>
              patch({
                certs: e.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <h4 className="pt-2 text-xs font-semibold uppercase tracking-wider text-white/50">
          Extra links
        </h4>
        <FooterLinksEditor
          links={footer.extraLinks}
          onChange={(extraLinks) => patch({ extraLinks })}
          onUpdate={updateExtraLink}
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Onderbalk</h3>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wider text-white/45">Copyrightregel</span>
          <input
            className={inputClass}
            value={footer.copyright}
            onChange={(e) => patch({ copyright: e.target.value })}
          />
        </label>
        <FooterLinksEditor
          links={footer.legalLinks}
          onChange={(legalLinks) => patch({ legalLinks })}
          onUpdate={updateLegalLink}
        />
      </section>

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
        </div>
        {statusMessage ? (
          <p
            className={
              statusMessage.tone === "ok" ? "text-xs text-emerald-300" : "text-xs text-red-300"
            }
            role="status"
          >
            {statusMessage.text}
          </p>
        ) : (
          <p className="text-[11px] text-white/40">
            Opslaan synchroniseert de footer naar de storefront (zelfde pad als navigatie).
          </p>
        )}
      </div>
    </div>
  );
}

function FooterLinksEditor({
  links,
  onChange,
  onUpdate,
}: {
  links: SiteFooterLink[];
  onChange: (links: SiteFooterLink[]) => void;
  onUpdate: (id: string, partial: Partial<SiteFooterLink>) => void;
}) {
  return (
    <div className="space-y-3">
      {links.map((item, index) => (
        <div
          key={item.id}
          className="space-y-2.5 rounded-xl border border-white/[0.08] bg-black/20 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/40">#{index + 1}</span>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-white/70 transition hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-200"
              aria-label={`Link ${index + 1} verwijderen`}
              onClick={() => onChange(links.filter((l) => l.id !== item.id))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-white/45">Label</span>
            <input
              className={inputClass}
              value={item.label}
              onChange={(e) => onUpdate(item.id, { label: e.target.value })}
            />
          </label>
          <TypedLinkField
            label="Link"
            value={item.link}
            onChange={(link) => {
              if (!link) return;
              onUpdate(item.id, { link });
            }}
          />
        </div>
      ))}
      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 py-2.5 text-[12px] font-semibold text-white/75 transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-white"
        onClick={() => onChange([...links, createFooterLink()])}
      >
        <Plus className="h-3.5 w-3.5" />
        Link toevoegen
      </button>
    </div>
  );
}

function LinkListEditor<T extends { id: string }>({
  title,
  items,
  onAdd,
  onRemove,
  renderItem,
}: {
  title: string;
  items: T[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">
        {title} ({items.length})
      </h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="space-y-2.5 rounded-xl border border-white/[0.08] bg-black/20 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/40">#{index + 1}</span>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-white/70 transition hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-200"
                aria-label={`Item ${index + 1} verwijderen`}
                onClick={() => onRemove(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {renderItem(item)}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 py-2.5 text-[12px] font-semibold text-white/75 transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-white"
        onClick={onAdd}
      >
        <Plus className="h-3.5 w-3.5" />
        Toevoegen
      </button>
    </section>
  );
}
