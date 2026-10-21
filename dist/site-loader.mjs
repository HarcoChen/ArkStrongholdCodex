// node_modules/@arkstrongholdrl/ark-play-core/src/site-loader.mjs
import { createHash } from "node:crypto";
var origin;
var headers;
var hashes;
var sources = /* @__PURE__ */ new Map();
async function initialize(options) {
  ({ origin, headers, hashes } = options);
  const paths = Object.keys(hashes);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(8, paths.length) }, async () => {
    for (; ; ) {
      const path = paths[cursor++];
      if (path === void 0) return;
      const url = new URL(path, origin + "/");
      if (url.origin !== origin || url.username || url.password || url.search || url.hash || url.pathname.slice(1) !== path)
        throw new Error("Invalid upstream manifest module path");
      sources.set(url.href, await fetchModule(url.href));
    }
  }));
}
var remote = (url) => /^https?:/.test(url);
async function resolve(specifier, context, next) {
  if (remote(specifier) || remote(context.parentURL || "")) {
    const url = new URL(specifier, context.parentURL || origin);
    if (url.origin !== origin || url.username || url.password || url.hash) throw new Error("Cross-site module import refused");
    const path = url.pathname.slice(1);
    if (!hashes[path] && !/^js\/(ui\/gameLogic\/|ui\/facing\.js$|render\/prepfield\.js$)/.test(path)) throw new Error("Unsupported upstream client dependency: " + path);
    return { url: url.href, shortCircuit: true };
  }
  return next(specifier, context);
}
async function load(url, context, next) {
  if (!remote(url)) return next(url, context);
  const source = sources.get(url) || await fetchModule(url);
  return { format: "module", source, shortCircuit: true };
}
async function fetchModule(url) {
  const u = new URL(url);
  if (u.origin !== origin) throw new Error("Cross-site module load refused");
  const response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(3e4) });
  if (!response.ok) throw new Error("Upstream module unavailable: " + u.pathname + " HTTP " + response.status);
  const chunks = [];
  let length = 0;
  for await (const bytes of response.body) {
    length += bytes.length;
    if (length > 3 * 1024 * 1024) throw new Error("Upstream module too large");
    chunks.push(bytes);
  }
  const source = Buffer.concat(chunks), expected = hashes[u.pathname.slice(1)];
  if (expected && createHash("sha256").update(source).digest("hex") !== expected) throw new Error("Upstream module hash mismatch: " + u.pathname);
  return source;
}
export {
  initialize,
  load,
  resolve
};
