import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  CmsAiAssistProvider,
  InspectTextField,
  requestCmsOverwriteConfirm,
  type CmsAiAssistApi,
  type CmsConfirmationRequest,
} from "./ai-assist";

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function mount(children: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(children);
  });
  mounted = { container, root };
  return container;
}

afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
  vi.restoreAllMocks();
});

function createAi(overrides: Partial<CmsAiAssistApi> = {}): CmsAiAssistApi {
  const store: Record<string, string> = { "field:title": "Bestaande EN" };
  return {
    configured: true,
    generateDutch: async () => ({ ok: false, error: "n/a" }),
    translateToEn: async () => ({
      ok: true,
      text: "New English",
      fields: { text: "New English" },
      warnings: [],
    }),
    generateSection: async () => ({ ok: false, error: "n/a" }),
    getEnDraft: (path) => store[path] ?? "",
    setEnDraft: (path, value) => {
      store[path] = value;
    },
    setEnDrafts: (patch) => {
      Object.assign(store, patch);
    },
    confirmOverwrite: async () => true,
    ...overrides,
  };
}

async function translateAndApply(container: HTMLDivElement) {
  const translateBtn = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Titel: Vertaal naar Engels"]',
  );
  expect(translateBtn).toBeTruthy();
  await act(async () => {
    translateBtn!.click();
  });
  const applyBtn = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Toepassen",
  );
  expect(applyBtn).toBeTruthy();
  await act(async () => {
    applyBtn!.click();
  });
}

describe("requestCmsOverwriteConfirm", () => {
  const request: CmsConfirmationRequest = {
    title: "Overschrijven?",
    description: "Er staat al tekst.",
    confirmLabel: "Overschrijven",
    cancelLabel: "Annuleren",
    tone: "warning",
  };

  it("returns false when confirmOverwrite is missing", async () => {
    const ai = createAi();
    delete (ai as { confirmOverwrite?: unknown }).confirmOverwrite;
    await expect(requestCmsOverwriteConfirm(ai, request)).resolves.toBe(false);
  });

  it("returns false when ai is null", async () => {
    await expect(requestCmsOverwriteConfirm(null, request)).resolves.toBe(false);
  });

  it("returns false when confirmOverwrite returns false", async () => {
    const ai = createAi({ confirmOverwrite: async () => false });
    await expect(requestCmsOverwriteConfirm(ai, request)).resolves.toBe(false);
  });

  it("returns true when confirmOverwrite returns true", async () => {
    const ai = createAi({ confirmOverwrite: async () => true });
    await expect(requestCmsOverwriteConfirm(ai, request)).resolves.toBe(true);
  });

  it("returns false when confirmOverwrite throws", async () => {
    const ai = createAi({
      confirmOverwrite: async () => {
        throw new Error("dialog failed");
      },
    });
    await expect(requestCmsOverwriteConfirm(ai, request)).resolves.toBe(false);
  });

  it("never calls window.confirm", async () => {
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const ai = createAi({ confirmOverwrite: async () => true });
    await requestCmsOverwriteConfirm(ai, request);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("InspectTextField EN apply confirmation", () => {
  it("aborts overwrite when confirmOverwrite returns false", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const setEnDraft = vi.fn();
    const confirmOverwrite = vi.fn<(req: CmsConfirmationRequest) => Promise<boolean>>(
      async () => false,
    );
    const ai = createAi({ setEnDraft, confirmOverwrite });
    const container = mount(
      <CmsAiAssistProvider value={ai}>
        <InspectTextField
          label="Titel"
          value="Nederlandse titel"
          onChange={() => {}}
          fieldPath="field:title"
        />
      </CmsAiAssistProvider>,
    );

    await translateAndApply(container);

    expect(confirmOverwrite).toHaveBeenCalledTimes(1);
    expect(confirmOverwrite.mock.calls[0]?.[0]).toMatchObject({
      title: "Engelse concepttekst overschrijven?",
      confirmLabel: "Overschrijven",
      cancelLabel: "Annuleren",
      tone: "warning",
    });
    expect(setEnDraft).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("applies overwrite when confirmOverwrite returns true", async () => {
    const setEnDraft = vi.fn();
    const confirmOverwrite = vi.fn(async () => true);
    const ai = createAi({ setEnDraft, confirmOverwrite });
    const container = mount(
      <CmsAiAssistProvider value={ai}>
        <InspectTextField
          label="Titel"
          value="Nederlandse titel"
          onChange={() => {}}
          fieldPath="field:title"
        />
      </CmsAiAssistProvider>,
    );

    await translateAndApply(container);

    expect(confirmOverwrite).toHaveBeenCalledTimes(1);
    expect(setEnDraft).toHaveBeenCalledWith("field:title", "New English");
  });

  it("fail-closes when confirmOverwrite is missing", async () => {
    const setEnDraft = vi.fn();
    const ai = createAi({ setEnDraft });
    delete (ai as { confirmOverwrite?: unknown }).confirmOverwrite;

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const container = mount(
      <CmsAiAssistProvider value={ai}>
        <InspectTextField
          label="Titel"
          value="Nederlandse titel"
          onChange={() => {}}
          fieldPath="field:title"
        />
      </CmsAiAssistProvider>,
    );

    await translateAndApply(container);

    expect(setEnDraft).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
