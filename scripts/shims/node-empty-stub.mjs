/** Empty / no-op stub for Node builtins that must not execute in the browser bundle.
 * Named exports must cover every static import Rollup sees from server packages
 * analyzed during the client build (fs, fs/promises, crypto, process, buffer, util, …).
 */

function noop() {
  return undefined;
}

async function asyncNoop() {
  return undefined;
}

function rejectedAsync() {
  return Promise.reject(new Error("node builtin stubbed in client bundle"));
}

const emptyStat = () => ({
  isFile: () => false,
  isDirectory: () => false,
  isSymbolicLink: () => false,
  size: 0,
  mtimeMs: 0,
  ctimeMs: 0,
  atimeMs: 0,
  mode: 0,
});

// --- fs / fs/promises ---
export const readFile = asyncNoop;
export const readFileSync = noop;
export const writeFile = asyncNoop;
export const writeFileSync = noop;
export const appendFile = asyncNoop;
export const appendFileSync = noop;
export const rename = asyncNoop;
export const renameSync = noop;
export const mkdir = asyncNoop;
export const mkdirSync = noop;
export const rmdir = asyncNoop;
export const rmdirSync = noop;
export const rm = asyncNoop;
export const rmSync = noop;
export const unlink = asyncNoop;
export const unlinkSync = noop;
export const copyFile = asyncNoop;
export const copyFileSync = noop;
export const readdir = async () => [];
export const readdirSync = () => [];
export const stat = async () => emptyStat();
export const statSync = emptyStat;
export const lstat = async () => emptyStat();
export const lstatSync = emptyStat;
export const access = asyncNoop;
export const accessSync = noop;
export const existsSync = () => false;
export const realpath = asyncNoop;
export const realpathSync = (p) => p;
export const chmod = asyncNoop;
export const chmodSync = noop;
export const chown = asyncNoop;
export const chownSync = noop;
export const open = rejectedAsync;
export const close = asyncNoop;
export const truncate = asyncNoop;
export const truncateSync = noop;
export const watch = () => ({ close: noop, on: noop, off: noop });
export const watchFile = noop;
export const unwatchFile = noop;
export const createReadStream = () => ({
  on: noop,
  once: noop,
  pipe: noop,
  destroy: noop,
  close: noop,
});
export const createWriteStream = () => ({
  on: noop,
  once: noop,
  write: noop,
  end: noop,
  destroy: noop,
  close: noop,
});
export const constants = Object.freeze({});
export const promises = {
  readFile,
  writeFile,
  appendFile,
  rename,
  mkdir,
  rmdir,
  rm,
  unlink,
  copyFile,
  readdir,
  stat,
  lstat,
  access,
  realpath,
  chmod,
  chown,
  open,
  close,
  truncate,
};

// --- crypto ---
export const createHash = () => ({ update: () => ({ digest: () => "" }) });
export const randomBytes = () => new Uint8Array(0);
export const randomUUID = () => "00000000-0000-4000-8000-000000000000";
export const createHmac = createHash;
export const createCipheriv = noop;
export const createDecipheriv = noop;
export const createSign = noop;
export const createVerify = noop;
export const pbkdf2 = (_p, _s, _i, _k, _d, cb) => {
  if (typeof cb === "function") cb(null, new Uint8Array(0));
};
export const pbkdf2Sync = () => new Uint8Array(0);
export const scrypt = (_p, _s, _k, _o, cb) => {
  if (typeof cb === "function") cb(null, new Uint8Array(0));
};
export const scryptSync = () => new Uint8Array(0);
export const timingSafeEqual = (a, b) => {
  const left = a instanceof Uint8Array ? a : new TextEncoder().encode(String(a));
  const right = b instanceof Uint8Array ? b : new TextEncoder().encode(String(b));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
};
export const getRandomValues = (typedArray) => typedArray;
export const webcrypto = globalThis.crypto;
export const subtle = globalThis.crypto?.subtle;

// --- process ---
export const env = {};
export const cwd = () => "/";
export const chdir = noop;
export const nextTick = (fn) => Promise.resolve().then(fn);
export const version = "";
export const versions = {};
export const platform = "browser";
export const arch = "x64";
export const pid = 0;
export const ppid = 0;
export const title = "";
export const argv = [];
export const execPath = "";
export const exit = noop;
export const stdout = { write: noop, on: noop };
export const stderr = { write: noop, on: noop };
export const stdin = { on: noop };
export const on = noop;
export const once = noop;
export const off = noop;
export const emit = noop;
export const hrtime = Object.assign(() => [0, 0], { bigint: () => 0n });
export const memoryUsage = () => ({
  rss: 0,
  heapTotal: 0,
  heapUsed: 0,
  external: 0,
  arrayBuffers: 0,
});
export const uptime = () => 0;

// --- buffer ---
export class Buffer {
  static from() {
    return new Uint8Array(0);
  }
  static alloc(size = 0) {
    return new Uint8Array(size);
  }
  static allocUnsafe(size = 0) {
    return new Uint8Array(size);
  }
  static isBuffer() {
    return false;
  }
  static concat() {
    return new Uint8Array(0);
  }
  static byteLength(value) {
    return typeof value === "string" ? value.length : 0;
  }
}

// --- util ---
export const promisify = (fn) => fn;
export const inspect = (value) => String(value);
export const format = (...args) => args.map(String).join(" ");
export const deprecate = (fn) => fn;
export const inherits = noop;
export const types = {
  isDate: () => false,
  isRegExp: () => false,
  isNativeError: () => false,
  isPromise: () => false,
  isTypedArray: () => false,
};
export const TextEncoder =
  globalThis.TextEncoder ??
  class {
    encode(s = "") {
      return new Uint8Array([...String(s)].map((c) => c.charCodeAt(0)));
    }
  };
export const TextDecoder =
  globalThis.TextDecoder ??
  class {
    decode() {
      return "";
    }
  };

// --- events ---
export class EventEmitter {
  on() {
    return this;
  }
  once() {
    return this;
  }
  off() {
    return this;
  }
  emit() {
    return false;
  }
  removeListener() {
    return this;
  }
  removeAllListeners() {
    return this;
  }
  addListener() {
    return this;
  }
  setMaxListeners() {
    return this;
  }
}

// --- os ---
export const hostname = () => "localhost";
export const homedir = () => "/";
export const tmpdir = () => "/tmp";
export const type = () => "Browser";
export const release = () => "";
export const cpus = () => [];
export const networkInterfaces = () => ({});
export const endianness = () => "LE";

// --- child_process ---
export const spawn = noop;
export const spawnSync = () => ({ status: 1, stdout: "", stderr: "" });
export const exec = noop;
export const execSync = noop;
export const execFile = noop;
export const execFileSync = noop;
export const fork = noop;

// --- url (only if empty shim is ever used; path/url usually have dedicated stubs) ---
export const fileURLToPath = (u) => String(u);
export const pathToFileURL = (p) => ({ href: String(p) });
export const URL = globalThis.URL;

export default {
  // fs
  readFile,
  readFileSync,
  writeFile,
  writeFileSync,
  appendFile,
  appendFileSync,
  rename,
  renameSync,
  mkdir,
  mkdirSync,
  rmdir,
  rmdirSync,
  rm,
  rmSync,
  unlink,
  unlinkSync,
  copyFile,
  copyFileSync,
  readdir,
  readdirSync,
  stat,
  statSync,
  lstat,
  lstatSync,
  access,
  accessSync,
  existsSync,
  realpath,
  realpathSync,
  chmod,
  chmodSync,
  chown,
  chownSync,
  open,
  close,
  truncate,
  truncateSync,
  watch,
  watchFile,
  unwatchFile,
  createReadStream,
  createWriteStream,
  constants,
  promises,
  // crypto
  createHash,
  randomBytes,
  randomUUID,
  createHmac,
  createCipheriv,
  createDecipheriv,
  createSign,
  createVerify,
  pbkdf2,
  pbkdf2Sync,
  scrypt,
  scryptSync,
  timingSafeEqual,
  getRandomValues,
  webcrypto,
  subtle,
  // process
  env,
  cwd,
  chdir,
  nextTick,
  version,
  versions,
  platform,
  arch,
  pid,
  ppid,
  title,
  argv,
  execPath,
  exit,
  stdout,
  stderr,
  stdin,
  on,
  once,
  off,
  emit,
  hrtime,
  memoryUsage,
  uptime,
  // buffer
  Buffer,
  // util
  promisify,
  inspect,
  format,
  deprecate,
  inherits,
  types,
  TextEncoder,
  TextDecoder,
  // events
  EventEmitter,
  // os
  hostname,
  homedir,
  tmpdir,
  type,
  release,
  cpus,
  networkInterfaces,
  endianness,
  // child_process
  spawn,
  spawnSync,
  exec,
  execSync,
  execFile,
  execFileSync,
  fork,
  // url
  fileURLToPath,
  pathToFileURL,
  URL,
};
