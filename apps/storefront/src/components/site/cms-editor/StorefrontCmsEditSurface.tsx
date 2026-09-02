import * as React from "react";
import {
  CmsEditSurfaceProvider,
  ContactFormFieldChromeProvider,
  ContactFormToolbarProvider,
  QuoteFieldChromeProvider,
  type CmsEditSurfaceApi,
  type ContactFormFieldChromeRender,
  type ContactFormToolbarRender,
  type QuoteFieldChromeRender,
} from "@mccoy/cms-renderer";
import type { CmsButton } from "@mccoy/cms-schema";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { WysiwygInlineText } from "@/components/site/cms-editor/WysiwygInlineText";
import { WysiwygButtonEditor, WysiwygMediaFrame } from "@/components/site/cms-editor/WysiwygMediaButton";
import { WysiwygGalleryTileChrome } from "@/components/site/cms-editor/WysiwygGalleryTile";
import { WysiwygQuoteFormFieldChrome } from "@/components/site/cms-editor/WysiwygQuoteFormField";
import {
  WysiwygFormFieldChrome,
  WysiwygFormFieldsToolbar,
} from "@/components/site/cms-editor/WysiwygFormField";

/**
 * Bridges storefront live-edit → cms-renderer Editable* helpers.
 * RegisteredBlockView public API stays untouched; chrome is context-only.
 */
export function StorefrontCmsEditSurface({ children }: { children: React.ReactNode }) {
  const { showEditorChrome, sendMutation, sendUiCommand } = useLiveEditApi();

  const value = React.useMemo<CmsEditSurfaceApi>(
    () => ({
      enabled: showEditorChrome,
      sendBlockPatch: (blockId, patch) => {
        sendMutation({ kind: "block", blockId, patch });
      },
      openMediaPicker: (target) => {
        sendUiCommand({ kind: "openMediaPicker", target });
      },
      renderText: ({ path, value: text, blockId, multiline, as, className }) => (
        <WysiwygInlineText
          value={text}
          as={as}
          className={className}
          multiline={multiline}
          enFieldPath={`block:${blockId}:${path}`}
          target={{
            kind: "block",
            blockId,
            field: path,
          }}
        />
      ),
      renderMedia: ({ path, blockId, image, listItemId, listImageKey, emptyPlaceholder, className, children }) => (
        <WysiwygMediaFrame
          image={image}
          emptyPlaceholder={emptyPlaceholder !== false}
          emptyAspectClass={path === "image" || path === "poster" ? "aspect-video" : "aspect-[4/3]"}
          className={
            className ??
            (listItemId ? "h-full min-h-0 w-full" : undefined)
          }
          target={{
            kind: "block",
            blockId,
            field: path,
            ...(listItemId
              ? { listItemId, listImageKey: listImageKey ?? "image" }
              : {}),
          }}
        >
          {children}
        </WysiwygMediaFrame>
      ),
      renderGalleryMosaicTile: ({ blockId, item, items, spanClass, figure }) => (
        <WysiwygGalleryTileChrome
          item={item}
          items={items}
          spanClass={spanClass}
          listTarget={{ kind: "block", blockId, field: "images" }}
        >
          {figure}
        </WysiwygGalleryTileChrome>
      ),
      renderGalleryMosaicFigcaption: ({ blockId, item, items }) => (
        <>
          <p className="font-display text-lg font-semibold leading-snug tracking-[-0.02em] text-white sm:text-xl">
            <WysiwygInlineText
              as="span"
              label="Titel"
              value={item.title}
              target={{
                kind: "custom",
                onCommit: (next) => {
                  sendMutation({
                    kind: "block",
                    blockId,
                    patch: {
                      images: items.map((g) =>
                        g.id === item.id ? { ...g, title: next } : g,
                      ),
                    },
                  });
                },
              }}
            />
          </p>
          {(item.caption || showEditorChrome) && (
            <p className="mt-1.5 text-sm leading-snug text-white/68">
              <WysiwygInlineText
                as="span"
                multiline
                label="Bijschrift"
                value={item.caption ?? ""}
                target={{
                  kind: "custom",
                  onCommit: (next) => {
                    sendMutation({
                      kind: "block",
                      blockId,
                      patch: {
                        images: items.map((g) =>
                          g.id === item.id ? { ...g, caption: next } : g,
                        ),
                      },
                    });
                  },
                }}
              />
            </p>
          )}
        </>
      ),
      renderCta: ({ path, blockId, button, children }) => (
        <WysiwygButtonEditor
          button={button}
          onChange={(next: CmsButton) => {
            sendMutation({
              kind: "block",
              blockId,
              patch: { [path]: next },
            });
          }}
        >
          {children}
        </WysiwygButtonEditor>
      ),
    }),
    [sendMutation, sendUiCommand, showEditorChrome],
  );

  const quoteFieldChrome = React.useCallback<QuoteFieldChromeRender>(
    ({ field, tab, tabIndex, blockId, className, children }) => (
      <WysiwygQuoteFormFieldChrome
        field={field}
        tab={tab}
        tabIndex={tabIndex}
        blockId={blockId}
        className={className}
      >
        {children}
      </WysiwygQuoteFormFieldChrome>
    ),
    [],
  );

  const contactFormToolbar = React.useCallback<ContactFormToolbarRender>(
    ({ blockId, fields, formColumnsDesktop }) => (
      <WysiwygFormFieldsToolbar
        fields={fields}
        target={{ kind: "block", blockId }}
        formColumnsDesktop={formColumnsDesktop}
        className="mb-5"
      />
    ),
    [],
  );

  const contactFormFieldChrome = React.useCallback<ContactFormFieldChromeRender>(
    ({ field, fields, blockId, className, children }) => (
      <WysiwygFormFieldChrome
        field={field}
        fields={fields}
        target={{ kind: "block", blockId }}
        className={className}
      >
        {children}
      </WysiwygFormFieldChrome>
    ),
    [],
  );

  return (
    <CmsEditSurfaceProvider value={value}>
      <QuoteFieldChromeProvider value={quoteFieldChrome}>
        <ContactFormToolbarProvider value={contactFormToolbar}>
          <ContactFormFieldChromeProvider value={contactFormFieldChrome}>
            {children}
          </ContactFormFieldChromeProvider>
        </ContactFormToolbarProvider>
      </QuoteFieldChromeProvider>
    </CmsEditSurfaceProvider>
  );
}
