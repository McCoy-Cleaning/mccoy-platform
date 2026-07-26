/** Prefer the Web Streams API already available in modern browsers. */

export const ReadableStream = globalThis.ReadableStream;
export const WritableStream = globalThis.WritableStream;
export const TransformStream = globalThis.TransformStream;

export default {
  ReadableStream,
  WritableStream,
  TransformStream,
};
