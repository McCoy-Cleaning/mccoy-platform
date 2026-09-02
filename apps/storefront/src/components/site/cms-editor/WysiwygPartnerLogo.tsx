import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { type PartnerItem, type PartnersContent } from "@mccoy/cms-schema";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";

/**
 * On-canvas partner logo chrome: replace / remove without Secties drawer.
 * Uses a floating control so the logo itself stays visible (E10 overlay pattern).
 */
export function WysiwygPartnerLogoChrome({
  item,
  items,
  children,
}: {
  item: PartnerItem;
  items: PartnerItem[];
  children: React.ReactNode;
}) {
  const { showEditorChrome, sendMutation, sendUiCommand } = useLiveEditApi();
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  if (!showEditorChrome) return <>{children}</>;

  const patchItems = (next: PartnerItem[]) => {
    sendMutation({
      kind: "section",
      sectionKey: "home.partners",
      patch: { items: next } satisfies Partial<PartnersContent>,
    });
  };

  return (
    <div
      className="relative"
      data-cms-partner-logo=""
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        if (!open) setHovered(false);
      }}
    >
      {children}
      {(hovered || open) && (
        <div
          data-cms-editor-chrome
          className="absolute inset-x-0 bottom-1 z-20 flex justify-center"
        >
          <button
            type="button"
            data-cms-inline-edit=""
            aria-expanded={open}
            aria-label={`Partnerlogo bewerken: ${item.name}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg hover:bg-sky-600"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            <ImagePlus className="h-3 w-3" aria-hidden />
            Logo
          </button>
        </div>
      )}
      {open ? (
        <div
          data-cms-editor-chrome
          role="dialog"
          aria-label="Partnerlogo"
          className="absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-xl border border-white/15 bg-[#0d1017] p-3 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-sky-300/80">
            {item.name || "Partner"}
          </p>
          <button
            type="button"
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
            onClick={() => {
              sendUiCommand({
                kind: "openMediaPicker",
                target: {
                  kind: "section",
                  sectionKey: "home.partners",
                  field: "items",
                  listItemId: item.id,
                  listImageKey: "image",
                },
              });
              setOpen(false);
            }}
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            Logo vervangen
          </button>
          <div className="mt-2 flex justify-between gap-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-300/90 hover:bg-red-500/15"
              onClick={() => {
                patchItems(items.filter((p) => p.id !== item.id));
                setOpen(false);
              }}
            >
              <Trash2 className="h-3 w-3" aria-hidden />
              Verwijderen
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-white/50 hover:text-white"
              onClick={() => {
                setOpen(false);
                setHovered(false);
              }}
            >
              Sluiten
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WysiwygPartnerAddButton({ items }: { items: PartnerItem[] }) {
  const { showEditorChrome, sendUiCommand } = useLiveEditApi();
  if (!showEditorChrome) return null;
  void items;

  return (
    <button
      type="button"
      data-cms-editor-chrome
      className="partner-logo-card inline-flex shrink-0 flex-col items-center justify-center gap-1 border border-dashed border-sky-400/40 bg-sky-500/5 px-4 text-xs font-semibold text-sky-200 hover:border-sky-400/70"
      onClick={() => {
        sendUiCommand({
          kind: "openMediaPicker",
          target: {
            kind: "section",
            sectionKey: "home.partners",
            field: "items",
            listAppend: true,
            listImageKey: "image",
          },
        });
      }}
    >
      <ImagePlus className="h-4 w-4" aria-hidden />
      Logo
    </button>
  );
}
