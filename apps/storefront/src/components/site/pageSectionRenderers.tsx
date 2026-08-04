import type { PageSectionRenderers } from "./PageLayoutRenderer";
import { homeSectionRenderers } from "./homeSectionRenderers";
import { About, Services, ProductsMain, ProductsInfo } from "./sections/SitePageSections";
import { ContactMainChrome, VacaturesMainChrome, OfferteMainChrome } from "./FormPageChrome";
import { ContactFormSection, ContactInfoSection, OfferteInfoSection } from "./sections/ContactSections";
import { OfferteFormSection } from "./sections/OfferteSections";
import { VacaturesApplicationSection } from "./sections/VacaturesApplicationSection";
import { PrivacyMainSection, TermsMainSection } from "./sections/LegalSections";

/** Full builtin-page renderer map (about/services/products/forms + home). */
export const pageSectionRenderers: PageSectionRenderers = {
  ...homeSectionRenderers,
  about: {
    "about.main": About,
  },
  services: {
    "services.main": Services,
  },
  products: {
    "products.main": ProductsMain,
    "products.info": ProductsInfo,
  },
  contact: {
    "contact.main": ContactMainChrome,
    "contact.info": ContactInfoSection,
    "contact.form": ContactFormSection,
  },
  vacatures: {
    "vacatures.main": VacaturesMainChrome,
    "vacatures.application": VacaturesApplicationSection,
  },
  offerte: {
    "offerte.main": OfferteMainChrome,
    "offerte.info": OfferteInfoSection,
    "offerte.form": OfferteFormSection,
  },
  privacy: {
    "privacy.main": PrivacyMainSection,
  },
  terms: {
    "terms.main": TermsMainSection,
  },
};
