#!/usr/bin/env node

// node_modules/@arkstrongholdrl/ark-play-core/tools/configure.mjs
import { existsSync as existsSync2, mkdirSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";

// node_modules/@arkstrongholdrl/ark-play-core/src/config.mjs
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
var DEFAULT_SITE_URL = "https://ark.minyako.top";
function normalizeSiteUrl(value) {
  const input = String(value ?? "").trim();
  if (!input) return "";
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("\u8BF7\u8F93\u5165\u5B8C\u6574\u7684\u6E38\u620F\u7AD9\u7F51\u5740\uFF0C\u4F8B\u5982 " + DEFAULT_SITE_URL);
  }
  if (url.username || url.password || url.search || url.hash || !["/", "/ws", "/ws/"].includes(url.pathname)) throw new Error("\u6E38\u620F\u7AD9\u5730\u5740\u53EA\u652F\u6301\u7AD9\u70B9\u6839\u8DEF\u5F84\u6216 /ws\uFF0C\u4E0D\u80FD\u5305\u542B\u8D26\u53F7\u3001\u67E5\u8BE2\u53C2\u6570\u6216\u7247\u6BB5");
  const protocol = { https: "wss:", http: "ws:", wss: "wss:", ws: "ws:" }[url.protocol.slice(0, -1)];
  if (!protocol) throw new Error("\u6E38\u620F\u7AD9\u5730\u5740\u9700\u8981 https:// \u6216 wss://");
  if (protocol === "ws:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("\u8FDC\u7A0B\u6E38\u620F\u7AD9\u5FC5\u987B\u4F7F\u7528 HTTPS / WSS\uFF1BHTTP / WS \u4EC5\u9650\u672C\u673A\u56DE\u73AF\u5730\u5740");
  return protocol + "//" + url.host + "/ws";
}
function normalizeRoomCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  if (code && !/^[A-Z0-9]{4}$/.test(code)) throw new Error("\u623F\u95F4\u53F7\u987B\u4E3A\u56DB\u4F4D\u5B57\u6BCD\u6216\u6570\u5B57");
  return code;
}
function configPath(config = {}, env = process.env) {
  return config.configFile || env.ARK_AGENT_CONFIG_FILE || join(homedir(), ".config/ark-play/client.json");
}
function readConfig(file) {
  if (!existsSync(file)) return {};
  const value = JSON.parse(readFileSync(file, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Client configuration must be an object");
  return value;
}

// node_modules/@arkstrongholdrl/ark-play-core/tools/configure.mjs
var args = process.argv.slice(2);
var flags = /* @__PURE__ */ new Set(["--url", "--room-code", "--headers-file", "--token-file", "--session-file", "--out"]);
var options = {};
var update = false;
if (args.includes("--help")) {
  console.log("node configure.mjs [--url https://ark.minyako.top] [--room-code AB12] [--update] [--headers-file private.json] [--token-file site-bearer-token] [--session-file native-session-token] [--out client.json]");
  console.log("No --url: use the saved site when updating, otherwise " + DEFAULT_SITE_URL + ". Empty --room-code opens solo games. --update preserves other saved fields.");
} else {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--update") {
      update = true;
      continue;
    }
    if (!flags.has(args[i])) throw new Error("Unknown configuration option: " + args[i]);
    const flag = args[i], value = args[++i];
    if (value === void 0 || value.startsWith("--")) throw new Error("Missing value for " + flag);
    options[flag] = value;
  }
  const target = resolve(options["--out"] || configPath());
  const previous = update ? readConfig(target) : {};
  const url = normalizeSiteUrl(options["--url"] ?? previous.url ?? DEFAULT_SITE_URL);
  const roomCode = normalizeRoomCode(options["--room-code"] ?? previous.roomCode);
  const extra = {};
  for (const [key, flag] of [["headersFile", "--headers-file"], ["tokenFile", "--token-file"], ["sessionFile", "--session-file"]]) {
    if (options[flag] !== void 0) {
      const path = resolve(options[flag]);
      if (!existsSync2(path)) throw new Error(flag + " does not exist");
      extra[key] = path;
    }
  }
  const content = JSON.stringify({ ...previous, url, roomCode, ...extra }, null, 2) + "\n";
  mkdirSync(dirname(target), { recursive: true, mode: 448 });
  if (update) {
    const temporary = target + "." + randomUUID() + ".tmp";
    try {
      writeFileSync(temporary, content, { mode: 384, flag: "wx" });
      renameSync(temporary, target);
    } finally {
      rmSync(temporary, { force: true });
    }
  } else writeFileSync(target, content, { mode: 384, flag: "wx" });
  console.log((update ? "Updated " : "Created ") + target + "; no credentials printed. Settings apply to the next game session.");
}
