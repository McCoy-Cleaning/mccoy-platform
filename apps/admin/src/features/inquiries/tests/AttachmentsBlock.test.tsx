import * as React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { FormInboxAttachment } from "@mccoy/email/contracts";

vi.mock("@/lib/api/admin-requests.functions", () => ({
  getAdminFormInboxAttachment: vi.fn(),
}));

import { getAdminFormInboxAttachment } from "@/lib/api/admin-requests.functions";
import { AttachmentImageThumbs } from "../components/AttachmentImageThumbs";
import { AttachmentsBlock } from "../components/AttachmentsBlock";

const getAttachmentMock = vi.mocked(getAdminFormInboxAttachment);
const NativeURL = URL;
let mounted: { container: HTMLDivElement; root: Root } | null = null;

function attachment(filename: string, contentType: string, size = 128): FormInboxAttachment {
  return { filename, contentType, size, omitted: true };
}

function mountNode(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  mounted = { container, root };
  return container;
}

function mountAttachments(attachments: FormInboxAttachment[]) {
  return mountNode(
    <AttachmentsBlock messageId="req:website-requests:request-1" attachments={attachments} />,
  );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  getAttachmentMock.mockReset();
  let nextUrl = 0;
  class TestURL extends NativeURL {}
  Object.defineProperties(TestURL, {
    createObjectURL: {
      configurable: true,
      value: vi.fn(() => `blob:preview-${++nextUrl}`),
    },
    revokeObjectURL: {
      configurable: true,
      value: vi.fn(),
    },
  });
  vi.stubGlobal("URL", TestURL);
});

afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AttachmentsBlock image previews", () => {
  it("loads raster images as compact thumbnails, not full-width previews", async () => {
    getAttachmentMock.mockImplementation(async ({ data }) => ({
      ok: true as const,
      attachment: {
        filename: data.filename,
        contentType: data.filename.endsWith(".png") ? "image/png" : "image/jpeg",
        size: 4,
        contentBase64: btoa("test"),
        omitted: false,
      },
    }));

    const container = mountAttachments([
      attachment("voor.jpg", "image/jpeg"),
      attachment("na.png", "image/png"),
    ]);

    await flushEffects();

    const images = Array.from(container.querySelectorAll("img"));
    expect(images).toHaveLength(2);
    expect(images.map((image) => image.alt)).toEqual(["voor.jpg", "na.png"]);
    expect(images.every((image) => image.className.includes("h-20"))).toBe(true);
    expect(images.some((image) => image.className.includes("max-h-[28rem]"))).toBe(false);
    expect(getAttachmentMock).toHaveBeenCalledTimes(2);
  });

  it("does not fetch a PDF until Download is selected", async () => {
    getAttachmentMock.mockResolvedValue({
      ok: true,
      attachment: {
        filename: "offerte.pdf",
        contentType: "application/pdf",
        size: 8,
        contentBase64: btoa("pdf-test"),
        omitted: false,
      },
    } as never);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const container = mountAttachments([attachment("offerte.pdf", "application/pdf")]);
    expect(getAttachmentMock).not.toHaveBeenCalled();
    expect(container.querySelector("img")).toBeNull();

    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Download"),
    );
    expect(button).toBeTruthy();
    await act(async () => {
      button?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getAttachmentMock).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("shows a recoverable preview state when image bytes are unavailable", async () => {
    getAttachmentMock.mockResolvedValue({
      ok: false,
      error: "Bijlage niet gevonden in de mailbox.",
      code: "not_found",
    } as never);

    const container = mountAttachments([attachment("situatie.jpg", "image/jpeg")]);
    await flushEffects();

    expect(container.textContent).toContain("Voorbeeld niet beschikbaar");
  });

  it("renders images from an Admin-authorized signed URL without Base64", async () => {
    getAttachmentMock.mockResolvedValue({
      ok: true,
      attachment: {
        filename: "large-photo.jpg",
        contentType: "image/jpeg",
        size: 12 * 1024 * 1024,
        contentUrl: "https://storage.example/signed-preview",
        downloadUrl: "https://storage.example/signed-download",
        urlExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        omitted: false,
      },
    } as never);

    const container = mountAttachments([
      attachment("large-photo.jpg", "image/jpeg", 12 * 1024 * 1024),
    ]);
    await flushEffects();

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://storage.example/signed-preview",
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe("AttachmentImageThumbs lightbox", () => {
  it("opens a preview dialog with a download action", async () => {
    getAttachmentMock.mockResolvedValue({
      ok: true,
      attachment: {
        filename: "gevel.jpg",
        contentType: "image/jpeg",
        size: 4,
        contentBase64: btoa("test"),
        omitted: false,
      },
    } as never);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const container = mountNode(
      <AttachmentImageThumbs
        messageId="req:website-requests:request-1"
        attachments={[attachment("gevel.jpg", "image/jpeg")]}
      />,
    );
    await flushEffects();

    const thumb = container.querySelector('button[aria-label="Bekijk gevel.jpg"]');
    expect(thumb).toBeTruthy();
    await act(async () => {
      thumb?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("gevel.jpg");
    const download = Array.from(dialog?.querySelectorAll("button") ?? []).find((candidate) =>
      candidate.getAttribute("aria-label") === "Download gevel.jpg",
    );
    expect(download).toBeTruthy();

    await act(async () => {
      download?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });
});
