// Only these known opponent PREP display fields are irrelevant to local intents.
// Keep unknown fields, roster/liveness/readiness and every own/global field.
export function sameDecisionPublic(before, after, myId, own) {
  if (!myId || own?.playerId !== myId || own.personalChoice || before?.phase !== 'PREP' || after?.phase !== 'PREP' ||
      before.round !== after.round || !Array.isArray(before.players) || !Array.isArray(after.players) ||
      !before.players.some(p => p.playerId === myId) || !after.players.some(p => p.playerId === myId)) return false;
  const scope = pub => ({...pub, players: pub.players.map(player => {
    if (player.playerId === myId) return player;
    const {shopLevel, boardCount, bonds, ...guarded} = player;
    return guarded;
  })});
  return JSON.stringify(scope(before)) === JSON.stringify(scope(after));
}
