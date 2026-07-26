/** Minimal Node `stream` surface for client bundles that transitively import SSR helpers. */

export class Readable {
  static from() {
    throw new Error("node:stream Readable is unavailable in the browser bundle");
  }
  pipe() {
    return this;
  }
  destroy() {}
}

export class Writable {
  write() {
    return true;
  }
  end() {}
  destroy() {}
}

export class Transform extends Writable {}
export class PassThrough extends Transform {}
export class Duplex extends Transform {}

export function pipeline() {
  throw new Error("node:stream pipeline is unavailable in the browser bundle");
}

export function finished() {
  throw new Error("node:stream finished is unavailable in the browser bundle");
}

export default {
  Readable,
  Writable,
  Transform,
  PassThrough,
  Duplex,
  pipeline,
  finished,
};
