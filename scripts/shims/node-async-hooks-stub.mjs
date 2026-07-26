/** Stub AsyncLocalStorage for client bundles that transitively import Start server helpers. */

export class AsyncLocalStorage {
  disable() {}
  getStore() {
    return undefined;
  }
  run(store, callback, ...args) {
    return callback(...args);
  }
  enterWith() {}
  exit(callback, ...args) {
    return callback(...args);
  }
}

export class AsyncResource {
  static bind(fn) {
    return fn;
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.apply(thisArg, args);
  }
  emitDestroy() {}
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
}

export function createHook() {
  return { enable() {}, disable() {} };
}

export function executionAsyncId() {
  return 0;
}

export function triggerAsyncId() {
  return 0;
}

export default {
  AsyncLocalStorage,
  AsyncResource,
  createHook,
  executionAsyncId,
  triggerAsyncId,
};
