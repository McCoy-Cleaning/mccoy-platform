import * as React from "react";
import type { Block, BlockType, CmsState, Page } from "./types";
import { getTemplate } from "./templates";

const KEY = "mccoy_cms_v1";
const EVENT = "mccoy-cms-change";

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const SEED_PAGES: Page[] = [
  {
    id: "page_home",
    slug: "/",
    title: "Home",
    description: "McCoy Cleaning — professioneel schoonmaakbedrijf in Twente.",
    isCustom: false,
    inNav: true,
    updatedAt: Date.now(),
    blocks: [
      {
        id: uid("b"),
        type: "hero",
        data: {
          eyebrow: "Schoonmaakbedrijf Twente",
          title: "Professionele schoonmaak, één vast team",
          subtitle: "Kantoor, horeca, glasbewassing en meer — met McCoy weet je waar je aan toe bent.",
          ctaLabel: "Vraag offerte aan",
          ctaHref: "/offerte",
          image: "",
          align: "left",
        },
      },
      {
        id: uid("b"),
        type: "featureGrid",
        data: {
          title: "Waarom McCoy",
          features: [
            { icon: "sparkles", title: "Vakmanschap", body: "Getraind eigen team." },
            { icon: "shield", title: "Betrouwbaar", body: "Vaste gezichten." },
            { icon: "clock", title: "Flexibel", body: "Op jouw agenda." },
            { icon: "leaf", title: "Duurzaam", body: "Verantwoorde middelen." },
          ],
        },
      },
      { id: uid("b"), type: "cta", data: getTemplate("cta")!.defaultData },
    ],
  },
  {
    id: "page_about",
    slug: "/about",
    title: "Over ons",
    description: "Over McCoy Cleaning — ons verhaal, team en waarden.",
    isCustom: false,
    inNav: true,
    updatedAt: Date.now(),
    blocks: [
      { id: uid("b"), type: "hero", data: { ...getTemplate("hero")!.defaultData, title: "Over McCoy", subtitle: "Ons verhaal begint bij vakmanschap." } },
      { id: uid("b"), type: "values", data: getTemplate("values")!.defaultData },
      { id: uid("b"), type: "timeline", data: getTemplate("timeline")!.defaultData },
    ],
  },
  {
    id: "page_services",
    slug: "/services",
    title: "Diensten",
    description: "Ons volledige aanbod aan schoonmaakdiensten.",
    isCustom: false,
    inNav: true,
    updatedAt: Date.now(),
    blocks: [
      { id: uid("b"), type: "hero", data: { ...getTemplate("hero")!.defaultData, title: "Onze diensten", subtitle: "Één partij voor al je schoonmaak." } },
      { id: uid("b"), type: "featureGrid", data: getTemplate("featureGrid")!.defaultData },
      { id: uid("b"), type: "steps", data: getTemplate("steps")!.defaultData },
    ],
  },
  {
    id: "page_products",
    slug: "/products",
    title: "Producten",
    description: "McCoy Products — hygiënepapier, zepen en meer.",
    isCustom: false,
    inNav: true,
    updatedAt: Date.now(),
    blocks: [
      { id: uid("b"), type: "hero", data: { ...getTemplate("hero")!.defaultData, title: "Producten", subtitle: "Groothandel in professionele reinigingsproducten." } },
      { id: uid("b"), type: "columns", data: getTemplate("columns")!.defaultData },
    ],
  },
  {
    id: "page_contact",
    slug: "/contact",
    title: "Contact",
    description: "Neem contact op met McCoy Cleaning.",
    isCustom: false,
    inNav: true,
    updatedAt: Date.now(),
    blocks: [
      { id: uid("b"), type: "centered", data: { title: "Neem contact op", body: "We reageren binnen 24 uur.", ctaLabel: "", ctaHref: "" } },
      { id: uid("b"), type: "contactForm", data: getTemplate("contactForm")!.defaultData },
    ],
  },
  {
    id: "page_vacatures",
    slug: "/vacatures",
    title: "Vacatures",
    description: "Werken bij McCoy Cleaning.",
    isCustom: false,
    inNav: true,
    updatedAt: Date.now(),
    blocks: [
      { id: uid("b"), type: "hero", data: { ...getTemplate("hero")!.defaultData, title: "Werken bij McCoy", subtitle: "Word onderdeel van ons team." } },
      { id: uid("b"), type: "jobs", data: getTemplate("jobs")!.defaultData },
    ],
  },
];

function initial(): CmsState {
  return { pages: SEED_PAGES, saved: {}, draft: {}, version: 2 };
}

function read(): CmsState {
  if (typeof window === "undefined") return initial();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw) as CmsState;
    if (!parsed?.pages) return initial();
    if (!parsed.saved) parsed.saved = {};
    if (!parsed.draft) parsed.draft = {};
    return parsed;
  } catch {
    return initial();
  }
}

function write(state: CmsState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    cachedSnapshot = null;
    window.dispatchEvent(new Event(EVENT));
  } catch (e) {
    console.error("CMS write failed (localStorage quota?):", e);
    alert("Kon niet opslaan — mogelijk te veel afbeeldingen. Verwijder wat en probeer opnieuw.");
  }
}

let cachedSnapshot: CmsState | null = null;
function getSnapshot(): CmsState {
  if (cachedSnapshot === null) cachedSnapshot = read();
  return cachedSnapshot;
}
const serverSnapshot = initial();
function getServerSnapshot(): CmsState {
  return serverSnapshot;
}

export const cms = {
  getState: read,
  getPage(id: string) {
    return read().pages.find((p) => p.id === id);
  },
  updatePage(id: string, patch: Partial<Page>) {
    const s = read();
    s.pages = s.pages.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p));
    write(s);
  },
  addPage(input: { title: string; slug: string }) {
    const s = read();
    const customCount = s.pages.filter((p) => p.isCustom).length;
    if (customCount >= 4) throw new Error("Maximum 4 aangepaste pagina's bereikt.");
    const slug = input.slug.startsWith("/") ? input.slug : `/${input.slug}`;
    if (s.pages.some((p) => p.slug === slug)) throw new Error("Slug bestaat al.");
    const page: Page = {
      id: uid("page"),
      slug,
      title: input.title,
      description: `${input.title} — McCoy Cleaning`,
      isCustom: true,
      inNav: false,
      blocks: [],
      updatedAt: Date.now(),
      isDraftOnly: true,
    };
    s.pages.push(page);
    write(s);
    return page;
  },
  deletePage(id: string) {
    const s = read();
    const page = s.pages.find((p) => p.id === id);
    if (!page || !page.isCustom) throw new Error("Alleen aangepaste pagina's kunnen verwijderd worden.");
    s.pages = s.pages.filter((p) => p.id !== id);
    write(s);
  },
  addBlock(pageId: string, type: BlockType, index?: number) {
    const s = read();
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return;
    const tpl = getTemplate(type);
    if (!tpl) return;
    const block: Block = { id: uid("b"), type, data: structuredClone(tpl.defaultData) };
    if (index === undefined || index >= page.blocks.length) page.blocks.push(block);
    else page.blocks.splice(index, 0, block);
    page.updatedAt = Date.now();
    write(s);
  },
  updateBlock(pageId: string, blockId: string, patch: Record<string, any>) {
    const s = read();
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return;
    page.blocks = page.blocks.map((b) => (b.id === blockId ? { ...b, data: { ...b.data, ...patch } } : b));
    page.updatedAt = Date.now();
    write(s);
  },
  deleteBlock(pageId: string, blockId: string) {
    const s = read();
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return;
    page.blocks = page.blocks.filter((b) => b.id !== blockId);
    page.updatedAt = Date.now();
    write(s);
  },
  moveBlock(pageId: string, blockId: string, dir: -1 | 1) {
    const s = read();
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return;
    const idx = page.blocks.findIndex((b) => b.id === blockId);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= page.blocks.length) return;
    const arr = page.blocks.slice();
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    page.blocks = arr;
    page.updatedAt = Date.now();
    write(s);
  },
  reset() {
    write(initial());
  },

  /* ============ Overrides (draft / saved) ============ */
  getDraft(pageId: string) {
    const s = read();
    return { ...(s.saved[pageId] || {}), ...(s.draft[pageId] || {}) };
  },
  getSaved(pageId: string) {
    const s = read();
    return { ...(s.saved[pageId] || {}) };
  },
  setDraft(pageId: string, key: string, value: string) {
    const s = read();
    s.draft[pageId] = { ...(s.draft[pageId] || {}), [key]: value };
    write(s);
  },
  hasDraft(pageId: string) {
    const s = read();
    return !!s.draft[pageId] && Object.keys(s.draft[pageId]).length > 0;
  },
  savePage(pageId: string) {
    const s = read();
    const draft = s.draft[pageId] || {};
    s.saved[pageId] = { ...(s.saved[pageId] || {}), ...draft };
    delete s.draft[pageId];
    const page = s.pages.find((p) => p.id === pageId);
    if (page?.isDraftOnly) {
      page.isDraftOnly = false;
      page.inNav = true;
    }
    if (page) page.updatedAt = Date.now();
    write(s);
  },
  discardDraft(pageId: string) {
    const s = read();
    delete s.draft[pageId];
    // If custom page never saved, remove it entirely.
    const page = s.pages.find((p) => p.id === pageId);
    if (page?.isDraftOnly) {
      s.pages = s.pages.filter((p) => p.id !== pageId);
    }
    write(s);
  },
};

export function useCms(): CmsState {
  const subscribe = React.useCallback((cb: () => void) => {
    const handler = () => {
      cachedSnapshot = null;
      cb();
    };
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}