// node_modules/@arkstrongholdrl/ark-play-core/src/site-worker.mjs
import { register } from "node:module";

// node_modules/@arkstrongholdrl/ark-play-core/src/combat.mjs
var positive = (n) => Number.isFinite(n) && n > 0 ? n : 0;
var measures = ["damage", "taken", "healing"];
var empty = () => ({ damage: 0, taken: 0, healing: 0 });
var add = (to, from) => {
  for (const k of measures) to[k] += positive(from[k]);
};
var shares = (row, total) => Object.fromEntries(measures.map((k) => [k, total[k] > 0 ? row[k] / total[k] : 0]));
var order = (a, b) => b.damage - a.damage || b.taken - a.taken || b.healing - a.healing || a.key.localeCompare(b.key);
function ownerOf(unit) {
  const seen = /* @__PURE__ */ new Set();
  while (unit?.kind === "token" && unit.ownerUnit && !seen.has(unit)) {
    seen.add(unit);
    unit = unit.ownerUnit;
  }
  return unit;
}
function readCombat(battle) {
  const rows = /* @__PURE__ */ new Map();
  for (const player of battle.players || []) for (const unit of player.units || []) {
    if (unit.side !== "ally") continue;
    const owner = ownerOf(unit);
    const playerId2 = owner?.ownerId ?? unit.ownerId;
    if (playerId2 == null) continue;
    const key = JSON.stringify([playerId2, owner.uid != null ? ["uid", owner.uid] : ["unowned", owner.kind, owner.defId ?? owner.id]]);
    if (!rows.has(key)) rows.set(key, {
      key,
      playerId: playerId2,
      uid: owner.uid ?? null,
      id: owner.defId ?? null,
      name: String(owner.name || owner.defId || "\u672A\u547D\u540D\u5355\u4F4D").slice(0, 120),
      kind: owner.kind,
      ...empty(),
      kills: 0,
      attacks: 0
    });
    const row = rows.get(key), stats = unit.stats || {};
    row.damage += positive(stats.dmg);
    row.taken += positive(stats.taken);
    row.healing += positive(stats.heal);
    row.kills += positive(stats.kills);
    row.attacks += positive(stats.attacks);
  }
  return { playerIds: (battle.players || []).map((p) => p.playerId), seconds: positive(battle.time), rows: [...rows.values()].sort(order) };
}
var CombatHistory = class {
  constructor(limit = 64, rowLimit = 256) {
    this.limit = limit;
    this.rowLimit = rowLimit;
    this.records = /* @__PURE__ */ new Map();
    this.evicted = 0;
  }
  clear() {
    this.records.clear();
    this.evicted = 0;
  }
  record(entry, reason = "local_finished") {
    const old = this.records.get(entry.id);
    const observed = entry.battle ? readCombat(entry.battle) : { playerIds: [], seconds: 0, rows: [] };
    const complete = !!entry.battle?.finished && reason !== "takeover" && !entry.reconstructed && !entry.interrupted && !entry.battle.errorCount;
    const record = {
      battleId: entry.id,
      fieldId: entry.fieldId,
      round: entry.round,
      kind: entry.kind,
      seconds: observed.seconds,
      complete,
      reason,
      available: !!entry.battle,
      reconstructed: !!entry.reconstructed,
      interrupted: !!entry.interrupted,
      playerIds: observed.playerIds,
      errors: positive(entry.battle?.errorCount),
      rows: observed.rows
    };
    if (old && old.seconds > record.seconds) {
      record.rows = old.rows;
      record.seconds = old.seconds;
      record.playerIds = old.playerIds;
    }
    this.records.delete(entry.id);
    this.records.set(entry.id, record);
    while (this.records.size > this.limit) {
      this.records.delete(this.records.keys().next().value);
      this.evicted++;
    }
  }
  read({ scope = "last", throughRound = 0, playerId: playerId2 }) {
    const all = [...this.records.values()].filter((r) => r.round <= throughRound);
    const selected = scope === "last" ? all.filter((r) => r.round === throughRound) : all;
    const records = selected.filter((r) => r.available);
    const players = /* @__PURE__ */ new Map();
    for (const record of records) for (const id of record.playerIds) if (!players.has(id)) players.set(id, { playerId: id, isSelf: id === playerId2, ...empty(), seconds: 0, units: /* @__PURE__ */ new Map() });
    for (const record of records) for (const unit of record.rows) {
      if (!players.has(unit.playerId)) players.set(unit.playerId, { playerId: unit.playerId, isSelf: unit.playerId === playerId2, ...empty(), seconds: 0, units: /* @__PURE__ */ new Map() });
      const player = players.get(unit.playerId);
      add(player, unit);
      if (!player.units.has(unit.key)) player.units.set(unit.key, { ...unit, ...empty(), kills: 0, attacks: 0 });
      const row = player.units.get(unit.key);
      Object.assign(row, { name: unit.name, id: unit.id });
      add(row, unit);
      row.kills += unit.kills;
      row.attacks += unit.attacks;
    }
    for (const player of players.values()) player.seconds = records.filter((r) => r.playerIds.includes(player.playerId)).reduce((n, r) => n + r.seconds, 0);
    const totals = empty();
    for (const p of players.values()) add(totals, p);
    const visible = [...players.values()].map((p) => {
      const units = [...p.units.values()].sort(order);
      return {
        ...p,
        shares: shares(p, totals),
        dps: p.seconds > 0 ? p.damage / p.seconds : 0,
        hps: p.seconds > 0 ? p.healing / p.seconds : 0,
        units: units.slice(0, this.rowLimit).map(({ key, playerId: playerId3, ...u }) => ({ ...u, shares: shares(u, p) })),
        omittedUnits: Math.max(0, units.length - this.rowLimit)
      };
    });
    const missingRounds = Array.from({ length: Math.min(throughRound, 100) }, (_, i) => i + 1).filter((n) => !all.some((r) => r.round === n));
    const complete = selected.length > 0 && selected.every((r) => r.complete) && (scope !== "match" || this.evicted === 0 && !missingRounds.length);
    return {
      schema: "ark-play-combat/v1",
      status: records.length ? "available" : "unavailable",
      scope,
      round: scope === "last" ? throughRound : null,
      throughRound,
      source: "local-native-simulation",
      coverage: "own locally simulated fields; paired allies included when present",
      complete,
      ...scope === "match" ? { missingRounds } : {},
      historyEvicted: this.evicted,
      battles: selected.map(({ rows, ...r }) => r),
      totals,
      players: visible,
      shareBasis: "player shares / observed field totals; unit shares / that player totals; zero denominator => 0",
      accounting: "effective enemy HP damage and actual healing from native unit counters; taken includes native self/friendly HP loss; summons credited to their owning operator",
      ...!selected.length ? { reason: "no_observed_battle_for_completed_round" } : {}
    };
  }
};

// node_modules/@arkstrongholdrl/ark-play-core/src/site-worker.mjs
import { parentPort, workerData } from "node:worker_threads";
var { origin, headers, index, raw, playerId } = workerData;
var hashes = { ...index.simFiles };
var traits = Object.values(raw.garrisons || {}).filter((g) => g.operatorTrait).map((g) => g.operatorTrait.runtime);
if (traits.length) {
  if (traits.some((h) => !/^[a-f0-9]{64}$/.test(h) || h !== traits[0])) throw new Error("Upstream trait runtime pins differ");
  hashes["js/battle/operatorTraits.js"] = traits[0];
}
register(new URL("./site-loader.mjs", import.meta.url), { parentURL: import.meta.url, data: { origin, headers, hashes } });
var [identity, protocol, constants, simdata, spec, support, bounds, placement, camera] = await Promise.all([
  "shared/plugins/identity.js",
  "shared/protocol.js",
  "shared/constants.js",
  "sim/simdata.js",
  "sim/spec.js",
  "sim/content/support/index.js",
  "shared/plugins/officialBounds.js",
  "js/ui/gameLogic/placement.js",
  "js/ui/gameLogic/camera.js"
].map((path) => import(origin + "/" + path)));
if (identity.simHashOf(index.simFiles) !== index.sim || identity.contentHashOf({
  app: index.app,
  sim: index.sim,
  data: Object.fromEntries(Object.entries(index.data).map(([k, v]) => [k, v.sha256])),
  plugins: index.plugins,
  settings: index.settings
}) !== index.cs) throw new Error("Upstream content identity mismatch");
if (constants.PROTOCOL_VERSION !== 1 || !["0.3.0", "0.3.1", "0.3.2", "0.3.3"].includes(constants.APP_VERSION) || constants.APP_VERSION !== index.app) throw new Error("Unsupported upstream protocol/application version");
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) freeze(v);
  }
  return value;
}
freeze(raw);
simdata.setSimData(raw);
support.setGameData(null);
bounds.rememberOfficialBounds(raw);
if (traits.length) await (await import(origin + "/js/battle/operatorTraits.js")).installOperatorTraits(raw, origin + "/sim/");
var ds = new simdata.DataSource(raw, null);
var battles = /* @__PURE__ */ new Map();
var combat = new CombatHistory();
var paused = false;
var post = (type, payload = {}) => parentPort.postMessage({ type, ...payload });
function report(entry, final = false, resend = false) {
  if (!entry.authoritative || entry.ended) return;
  post("report", { battleId: entry.id, message: { t: "b.progress", battleId: entry.id, ...spec.battleProgress(entry.battle) } });
  if (final && (!entry.reported || resend)) {
    combat.record(entry);
    entry.reported = true;
    let result = spec.compactResult(entry.battle.result());
    if (spec.fitResult) result = spec.fitResult(result, { bossLike: ["boss", "hidden"].includes(entry.kind), battleId: entry.id });
    post("report", { battleId: entry.id, message: { t: "b.result", battleId: entry.id, cs: index.cs, result } });
  }
}
function pump(entry) {
  if (entry.ended || !entry.authoritative || paused) return;
  const b = entry.battle, boss = ["boss", "hidden"].includes(entry.kind);
  const target = boss ? Math.max(0, entry.elapsed + (Date.now() - entry.started) / 1e3 * entry.speed) : Infinity;
  let count = 0;
  while (!b.finished && count++ < 120 && b.time < target) b.step();
  b.drainEvents();
  if (b.finished) {
    report(entry, true);
    return;
  }
  if (Date.now() - entry.lastReport >= (boss ? 250 : 1e3)) {
    entry.lastReport = Date.now();
    report(entry);
  }
  entry.timer = setTimeout(() => pump(entry), boss ? 16 : 0);
}
parentPort.on("message", async (q) => {
  try {
    if (q.op === "combat") return post("reply", { id: q.id, result: combat.read({ ...q.query, playerId }) });
    if (q.op === "interrupt") {
      for (const e of battles.values()) e.interrupted = true;
      return;
    }
    if (q.op === "resetCombat") {
      combat.clear();
      for (const e of battles.values()) {
        e.ended = true;
        clearTimeout(e.timer);
      }
      battles.clear();
      return;
    }
    if (q.op === "validate") return post("reply", { id: q.id, result: protocol.validateC2S(q.message) || null });
    if (q.op === "map") {
      const field = camera.deployFieldOf(q.pub, q.myId), stage = raw.stages[q.pub.stageId];
      if (!stage) throw new Error("Unknown public stage");
      const overrides = placement.stageOverrides(q.own, (id) => raw.effects[id]);
      const cells = [...placement.deployMap(stage, { ...overrides, field })].map(([key, kind]) => {
        const [row, col] = key.split(",").map(Number);
        return { row, col, kind };
      });
      return post("reply", { id: q.id, result: { field, cells } });
    }
    if (q.op === "pause") {
      const next = !!q.on;
      if (next !== paused) {
        if (next) for (const e of battles.values()) {
          e.elapsed += (Date.now() - e.started) / 1e3 * e.speed;
          clearTimeout(e.timer);
        }
        paused = next;
        if (!paused) for (const e of battles.values()) {
          e.started = Date.now();
          pump(e);
        }
      }
      return;
    }
    if (q.op === "pool") {
      for (const e of battles.values()) if (e.battle.sharedBoss?.sync) e.battle.sharedBoss.sync(q.message.hp, q.message.acked?.[e.fieldId] || 0);
      return;
    }
    if (q.op === "end") {
      const e = battles.get(q.message.battleId);
      if (e) {
        combat.record(e, q.message.reason || "server_end");
        e.ended = true;
        clearTimeout(e.timer);
        battles.delete(e.id);
      }
      return;
    }
    if (q.op === "start") {
      const m = q.message;
      if (m.watch || !m.spec?.players?.some((p) => p.playerId === playerId)) return;
      if (!m.authoritative || m.done) {
        if (!combat.records.has(m.battleId)) combat.record({ id: m.battleId, fieldId: m.fieldId, kind: m.kind, round: m.spec.round }, "not_locally_simulated");
        return;
      }
      if (m.spec?.cs !== index.cs) throw new Error("Battle content differs from loaded site content");
      const old = battles.get(m.battleId);
      if (old) {
        if (old.reported) report(old, true, true);
        return;
      }
      for (const e2 of battles.values()) {
        if (!e2.battle.finished) combat.record(e2, "replaced_before_finish");
        e2.ended = true;
        clearTimeout(e2.timer);
      }
      battles.clear();
      const battle = spec.createBattleFromSpec(m.spec, ds, { recordEvents: false, logger: { warn() {
      }, error() {
      }, info() {
      } } });
      spec.attachLpMeter(battle);
      const e = {
        id: m.battleId,
        fieldId: m.fieldId,
        kind: m.kind,
        round: m.spec.round,
        battle,
        authoritative: true,
        ended: false,
        reported: false,
        reconstructed: (m.elapsed || 0) > 0,
        started: Date.now(),
        elapsed: m.elapsed || 0,
        speed: m.speed || 2,
        lastReport: Date.now()
      };
      battles.set(e.id, e);
      pump(e);
      return;
    }
  } catch (error) {
    if (q.id) post("reply", { id: q.id, error: String(error.message) });
    else post("failure", { error: String(error.message) });
  }
});
post("ready", { app: index.app, protocol: constants.PROTOCOL_VERSION, content: index.cs, capabilities: Object.keys(protocol.C2S) });
