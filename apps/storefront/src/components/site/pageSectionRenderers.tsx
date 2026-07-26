import type { PageSectionRenderers } from "./PageLayoutRenderer";
import { homeSectionRenderers } from "./homeSectionRenderers";
import { About, Services, Products } from "./sections/SitePageSections";
import { ContactMainChrome, VacaturesMainChrome, OfferteMainChrome } from "./FormPageChrome";
import { ContactFormSection, ContactInfoSection, OfferteInfoSection } from "./sections/ContactSections";
import { OfferteFormSection } from "./sections/OfferteSections";

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
    "products.main": Products,
  },
  contact: {
    "contact.main": ContactMainChrome,
    "contact.info": ContactInfoSection,
    "contact.form": ContactFormSection,
  },
  vacatures: {
    "vacatures.main": VacaturesMainChrome,
  },
  offerte: {
    "offerte.main": OfferteMainChrome,
    "offerte.info": OfferteInfoSection,
    "offerte.form": OfferteFormSection,
  },
};
