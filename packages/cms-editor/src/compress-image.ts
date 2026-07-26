/**
 * Re-export browser image prep helpers from cms-schema so editor consumers can
 * keep importing from @mccoy/cms-editor when already loaded.
 */
export {
  CMS_MAX_IMAGE_UPLOAD_BYTES,
  CMS_MAX_SOURCE_IMAGE_BYTES,
  CMS_MAX_STORED_IMAGE_BYTES,
  compressProfileFromTags,
  estimateDataUrlBytes,
  pickOutputMime,
  prepareCmsImageUpload,
  scaleToMaxEdge,
  validateImageUploadFile,
  type CmsImageCompressProfile,
  type PrepareCmsImageResult,
} from "@mccoy/cms-schema";
