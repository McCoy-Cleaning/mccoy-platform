/**
 * @mccoy/cms-editor — public barrel (re-exports only).
 * Component bodies live in sibling modules; do not add implementations here.
 */
export { RegisteredBlockEditor } from "./blocks/RegisteredBlockEditor";
export { ObjectListEditor } from "./blocks/ObjectListEditor";
export { StringListEditor } from "./blocks/StringListEditor";
export { RoadmapBlockEditor } from "./blocks/RoadmapBlockEditor";
export { PlansBlockEditor } from "./blocks/PlansBlockEditor";
export { HeroBlockEditor } from "./blocks/HeroBlockEditor";
export { TextImageBlockEditor } from "./blocks/TextImageBlockEditor";
export { CtaBlockEditor } from "./blocks/CtaBlockEditor";
export { FeatureGridBlockEditor } from "./blocks/FeatureGridBlockEditor";
export { CarouselBlockEditor, GalleryBlockEditor } from "./blocks/GalleryBlockEditor";
export { JobsBlockEditor, TeamGridBlockEditor } from "./blocks/TeamJobsBlockEditor";
export {
  StructuredLinkField,
  PAGE_DESTINATION_LINK_KINDS,
} from "./blocks/StructuredLinkField";
export { CmsButtonEditor } from "./blocks/shared-fields";
export {
  PopupContentTypeChooser,
  PopupContentTypePicker,
} from "./blocks/PopupContentTypePicker";
export { SectionTypeThumbnail } from "./blocks/SectionTypeThumbnail";
export {
  blockEditorRegistry,
  getRegisteredBlockEditor,
  getBlockEditorDefinition,
  listBlockTypesMissingDedicatedEditor,
  listUnsupportedPublishableBlockTypes,
} from "./blocks/blockEditorRegistry";
export {
  CTA_SUPPORTED_PATHS,
  imageSupportedPaths,
} from "./blocks/editor-definition";
export type { BlockEditorDefinition, EditorQuality } from "./blocks/editor-definition";
export { BulkImageAddButton, ImageStripPreview } from "./BulkImageAdd";
export type { CmsImagePickerProps } from "./image-picker-props";

export {
  CMS_MAX_IMAGE_UPLOAD_BYTES,
  CMS_MAX_SOURCE_IMAGE_BYTES,
  CMS_MAX_STORED_IMAGE_BYTES,
  compressProfileFromTags,
  prepareCmsImageUpload,
  validateImageUploadFile,
  type CmsImageCompressProfile,
  type PrepareCmsImageResult,
} from "./compress-image";

export {
  CmsAiAssistProvider,
  InspectTextField,
  ManualEnDraftField,
  SectionAiToolbar,
  collectShallowStringFields,
  defaultMaxCharsForField,
  isTranslatableFieldKey,
  requestCmsOverwriteConfirm,
  useCmsAiAssist,
  type CmsAiAssistApi,
  type CmsAiGenerateRequest,
  type CmsAiGenerateResponse,
  type CmsAiGenerateSectionRequest,
  type CmsAiGenerateSectionResponse,
  type CmsAiTone,
  type CmsAiTranslateRequest,
  type CmsAiTranslateResponse,
  type CmsConfirmationRequest,
} from "./ai-assist";

export type { CmsSelection } from "./selection";
export { buildSectionMutation } from "./selection";
export { EditInteractionGuard } from "./EditInteractionGuard";
export { SectionSelectFrame } from "./SectionSelectFrame";
export { PrototypeImageField, TypedLinkField } from "./PrototypeImageField";
export {
  HomeHeroInspector,
  FormChromeInspector,
  ContactInfoInspector,
  ContactFormInspector,
  AboutMainInspector,
  ServicesMainInspector,
  ServicesCardsInspector,
  ProductsMainInspector,
  ProductsInfoInspector,
  PartnersInspector,
  StatsInspector,
  WorkGalleryInspector,
  BlockDataInspector,
  LegalMainInspector,
  SelectedSectionInspector,
} from "./inspectors";

export { HomeHeroView, FormPageChromeView } from "@mccoy/cms-renderer";
export { ContentAlignControl } from "./ContentAlignControl";
