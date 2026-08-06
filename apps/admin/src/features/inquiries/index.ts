export { InquiriesPage } from "./components/InquiriesPage";
export { validateInquiriesSearch } from "./types/search";
export type { InquiriesSearch, KindFilter, ScopeFilter } from "./types/search";
export { formatWhen, relativeWhen } from "./lib/format";
export { KIND_FILTERS, kindMeta, SCOPE_TAB_LIMIT } from "./lib/filters";
export {
  isFullWidthFormField,
  shouldCollapseFormField,
  COLLAPSE_CHAR_THRESHOLD,
} from "./lib/form-fields";
