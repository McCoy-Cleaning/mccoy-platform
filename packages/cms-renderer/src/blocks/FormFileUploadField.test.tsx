// @vitest-environment jsdom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormFileUploadField, mergeSelectedFormFiles } from "./FormFileUploadField";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("FormFileUploadField", () => {
  let container: HTMLDivElement;
  let root: Root;
  const createObjectUrl = vi.fn((file: File) => `blob:preview-${file.name}`);
  const revokeObjectUrl = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("accumulates distinct selections without duplicating the same file", () => {
    const first = new File(["one"], "voor.png", { type: "image/png", lastModified: 1 });
    const second = new File(["two"], "na.png", { type: "image/png", lastModified: 2 });
    expect(mergeSelectedFormFiles([first], [first, second])).toEqual([first, second]);
  });

  it("shows image previews and lets the user remove a selected photo", async () => {
    function Harness() {
      const [files, setFiles] = React.useState<File[]>([]);
      return (
        <FormFileUploadField
          id="photos"
          name="photos"
          files={files}
          onFilesChange={setFiles}
          inputClassName="input"
        />
      );
    }

    await act(async () => root.render(<Harness />));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const photo = new File(["image"], "situatie.png", {
      type: "image/png",
      lastModified: 10,
    });
    Object.defineProperty(input, "files", { configurable: true, value: [photo] });

    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));

    const preview = container.querySelector('img[alt="Voorbeeld van situatie.png"]');
    expect(preview?.getAttribute("src")).toBe("blob:preview-situatie.png");
    expect(container.textContent).toContain("situatie.png");

    const remove = container.querySelector(
      'button[aria-label="Verwijder situatie.png"]',
    ) as HTMLButtonElement;
    await act(async () => remove.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).not.toContain("situatie.png");
  });
});
