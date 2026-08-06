import * as React from "react";
import {
  FIXED_SECTION_DEFS,
  type AboutMainContent,
  type ContactFormContent,
  type ContactInfoContent,
  type FixedSectionKey,
  type FormPageChromeContent,
  type HomeHeroContent,
  type LegalMainContent,
  type PageSectionContent,
  type PartnersContent,
  type ProductsInfoContent,
  type ProductsMainContent,
  type ServicesCardsContent,
  type ServicesMainContent,
  type StatsContent,
  type VacaturesApplicationContent,
  type WorkGalleryContent,
} from "@mccoy/cms-schema";
import { RegisteredBlockEditor } from "../blocks/RegisteredBlockEditor";
import { VacaturesApplicationInspector } from "../blocks/VacaturesApplicationInspector";
import type { CmsSelection } from "../selection";
import type { ImagePickerProps } from "../inspector-types";
import { HomeHeroInspector } from "./HomeHeroInspector";
import { FormChromeInspector } from "./FormChromeInspector";
import { ContactInfoInspector } from "./ContactInfoInspector";
import { ContactFormInspector } from "./ContactFormInspector";
import { AboutMainInspector } from "./AboutMainInspector";
import { ServicesMainInspector } from "./ServicesMainInspector";
import { ServicesCardsInspector } from "./ServicesCardsInspector";
import { ProductsMainInspector } from "./ProductsMainInspector";
import { ProductsInfoInspector } from "./ProductsInfoInspector";
import { PartnersInspector } from "./PartnersInspector";
import { StatsInspector } from "./StatsInspector";
import { WorkGalleryInspector } from "./WorkGalleryInspector";
import { LegalMainInspector } from "./LegalMainInspector";

export function SelectedSectionInspector({
  selection,
  sectionContent,
  onSectionPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
  blockData,
  blockType,
  onBlockPatch,
  part,
}: {
  selection: CmsSelection;
  sectionContent: PageSectionContent;
  onSectionPatch: (sectionKey: FixedSectionKey, patch: Record<string, unknown>) => void;
  projectImages?: Array<{ path: string; label: string; tags?: string[] }>;
  assetBaseUrl?: string;
  uploadToMediaLibrary?: ImagePickerProps["uploadToMediaLibrary"];
  mediaLibraryItems?: ImagePickerProps["mediaLibraryItems"];
  resolveProjectImage?: ImagePickerProps["resolveProjectImage"];
  blockData?: Record<string, unknown>;
  blockType?: string;
  onBlockPatch?: (patch: Record<string, unknown>) => void;
  /** Composite fixed-section part (e.g. mission / vision). */
  part?: string;
}) {
  if (!selection) {
    return (
      <p className="text-xs text-white/45">
        Selecteer een paginasectie op het canvas of in de sectielijst om inhoud te bewerken.
      </p>
    );
  }

  if (selection.kind === "block") {
    if (!blockData || !onBlockPatch || !blockType) {
      return <p className="text-xs text-amber-300">Blokgegevens niet beschikbaar.</p>;
    }
    return (
      <RegisteredBlockEditor
        presentation="inspector"
        block={{
          id: selection.blockId,
          type: blockType as import("@mccoy/cms-schema").BlockType,
          data: blockData,
        }}
        onChange={(next) => {
          onBlockPatch({ ...next.data, dataVersion: next.dataVersion });
        }}
      />
    );
  }

  const key = selection.sectionKey;
  const content = sectionContent[key];
  if (!content) {
    return <p className="text-xs text-amber-300">Geen inhoud voor {key}.</p>;
  }

  const imageProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };
  const partId = part ?? (selection.kind === "fixed" ? selection.part : undefined);

  if (key === "home.hero") {
    return (
      <HomeHeroInspector
        content={content as HomeHeroContent}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "contact.main" || key === "vacatures.main" || key === "offerte.main") {
    return (
      <FormChromeInspector
        content={content as FormPageChromeContent}
        sectionKey={key}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "contact.info" || key === "offerte.info") {
    return (
      <ContactInfoInspector
        content={content as ContactInfoContent}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "contact.form" || key === "offerte.form") {
    return (
      <ContactFormInspector
        content={content as ContactFormContent}
        onPatch={(patch) => onSectionPatch(key, patch)}
        formLabel={key === "offerte.form" ? "Offerteformulier" : "Contactformulier"}
        sectionKey={key}
      />
    );
  }
  if (key === "vacatures.application") {
    return (
      <VacaturesApplicationInspector
        content={content as VacaturesApplicationContent}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "about.main") {
    return (
      <AboutMainInspector
        content={content as AboutMainContent}
        {...imageProps}
        part={partId}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "services.main") {
    return (
      <ServicesMainInspector
        content={content as ServicesMainContent}
        part={partId}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "services.cards") {
    return (
      <ServicesCardsInspector
        content={content as ServicesCardsContent}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "products.main") {
    return (
      <ProductsMainInspector
        content={content as ProductsMainContent}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "products.info") {
    return (
      <ProductsInfoInspector
        content={content as ProductsInfoContent}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "home.partners") {
    return (
      <PartnersInspector
        content={content as PartnersContent}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "home.stats") {
    return <StatsInspector content={content as StatsContent} onPatch={(patch) => onSectionPatch(key, patch)} />;
  }
  if (key === "home.workGallery") {
    return (
      <WorkGalleryInspector
        content={content as WorkGalleryContent}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "privacy.main" || key === "terms.main") {
    return (
      <LegalMainInspector
        content={content as LegalMainContent}
        sectionKey={key}
        itemNoun={key === "terms.main" ? "Artikel" : "Sectie"}
        itemNounPlural={key === "terms.main" ? "Artikelen" : "Secties"}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }

  const fallbackKey = selection.sectionKey;
  return (
    <p className="text-xs text-white/50">
      Inspector voor <strong>{FIXED_SECTION_DEFS[fallbackKey]?.label ?? fallbackKey}</strong> volgt dezelfde typed
      content API. Gebruik voorlopig de sectielijst voor volgorde/zichtbaarheid.
    </p>
  );
}
