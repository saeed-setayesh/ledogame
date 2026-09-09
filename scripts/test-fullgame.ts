/* Simulate a complete 2-player CLASSIC game through the engine to a real win. */
import { LudoEngine } from "../src/lib/game/ludo-engine";

const e = new LudoEngine(
  [
    { id: "p0", userId: "u0", color: "RED", position: 0 },
    { id: "p1", userId: "u1", color: "BLUE", position: 1 },
  ],
  "CLASSIC"
);

let guard = 0;
let winner: string | null = null;
while (!winner && guard++ < 5000) {
  const st = e.getState();
  if (st.gameStatus === "FINISHED") { winner = st.winnerId; break; }
  const cur = st.players[st.currentTurn];
  if (!cur.hasRolled) {
    e.rollDice(cur.id);
    continue;
  }
  const moves = e.getAvailableMoves(cur.id);
  if (moves.length === 0) {
    // engine auto-advances on move; simulate a skip
    e.skipTurn?.();
    // if skipTurn didn't advance (dice still set), force it
    const s2 = e.getState();
    if (s2.diceValue !== null && s2.currentTurn === st.currentTurn) {
      e.forceNextTurn();
    }
    continue;
  }
  // Move furthest piece (prefer finishing)
  const st2 = e.getState();
  const p = st2.players[st2.currentTurn];
  const pieces = p.pieces.filter((x) => moves.includes(x.id));
  pieces.sort((a, b) => b.position - a.position);
  const done = e.movePiece(cur.id, pieces[0].id);
  if (done) { winner = e.getState().winnerId; break; }
}

const final = e.getState();
console.log(`turns simulated: ${guard}`);
console.log(`gameStatus: ${final.gameStatus}`);
console.log(`winnerId: ${winner}`);
const w = final.players.find((p) => p.userId === winner);
console.log(`winner pieces all finished: ${w?.pieces.every((x) => x.isFinished)}`);

const ok =
  final.gameStatus === "FINISHED" &&
  !!winner &&
  w?.pieces.every((x) => x.isFinished);
console.log(ok ? "\n✓ full game reaches a valid win" : "\n✗ game did not finish correctly");
process.exit(ok ? 0 : 1);
