/* Quick sanity checks for the Ludo engine rule changes. Run: npx tsx scripts/test-engine.ts */
import { LudoEngine } from "../src/lib/game/ludo-engine";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

function newGame(mode: "CLASSIC" | "RUSH" = "CLASSIC") {
  return new LudoEngine(
    [
      { id: "p0", userId: "u0", color: "RED", position: 0 },
      { id: "p1", userId: "u1", color: "BLUE", position: 1 },
    ],
    mode
  );
}

// Force a dice value by stubbing Math.random.
function withDice(value: number, fn: () => void) {
  const orig = Math.random;
  Math.random = () => (value - 1) / 6 + 1e-9;
  try {
    fn();
  } finally {
    Math.random = orig;
  }
}

console.log("CLASSIC: rolling a 6 keeps the turn");
{
  const e = newGame();
  withDice(6, () => e.rollDice("p0"));
  withDice(6, () => e.movePiece("p0", 0)); // bring piece out
  const s = e.getState();
  check("still player 0's turn", s.currentTurn === 0);
  check("lastMove.bonusRoll true", s.lastMove?.bonusRoll === true);
  check("hasRolled reset for bonus", s.players[0].hasRolled === false);
}

console.log("CLASSIC: non-6 with no bonus advances turn");
{
  const e = newGame();
  withDice(6, () => e.rollDice("p0"));
  withDice(6, () => e.movePiece("p0", 0)); // out at progress 0
  withDice(3, () => e.rollDice("p0"));
  withDice(3, () => e.movePiece("p0", 0)); // 0 -> 3, no capture
  const s = e.getState();
  check("advanced to player 1", s.currentTurn === 1);
  check("bonusRoll false", s.lastMove?.bonusRoll === false);
}

console.log("CLASSIC: capturing an opponent grants a bonus roll");
{
  const e = newGame();
  // Put BLUE piece on RED's path so RED can land on it.
  // RED progress p -> outer index p. BLUE progress q -> outer index (13+q)%52.
  // We want RED to move from 0 by 5 to outer index 5; BLUE must be at outer 5 => q such that (13+q)%52 = 5 => q = 44.
  const st = e.getState();
  st.players[0].pieces[0] = { id: 0, position: 0, color: "RED", isHome: false, isFinished: false };
  st.players[1].pieces[0] = { id: 0, position: 44, color: "BLUE", isHome: false, isFinished: false };
  st.players[0].hasRolled = false;
  st.currentTurn = 0;
  e.setState(st);
  withDice(5, () => e.rollDice("p0"));
  withDice(5, () => e.movePiece("p0", 0));
  const s = e.getState();
  check("captured flag set", s.lastMove?.captured === true);
  check("bonus roll granted", s.lastMove?.bonusRoll === true);
  check("still RED's turn", s.currentTurn === 0);
  check("BLUE piece sent home", s.players[1].pieces[0].isHome === true);
}

console.log("CLASSIC: reaching final home square grants a bonus roll");
{
  const e = newGame();
  const st = e.getState();
  // progress 56 == finished; put piece at 53 and roll a 3.
  st.players[0].pieces[0] = { id: 0, position: 53, color: "RED", isHome: false, isFinished: false };
  st.players[0].hasRolled = false;
  st.currentTurn = 0;
  e.setState(st);
  withDice(3, () => e.rollDice("p0"));
  const finished = withDiceReturn(3, () => e.movePiece("p0", 0));
  const s = e.getState();
  check("piece finished", s.players[0].pieces[0].isFinished === true);
  check("bonus roll granted", s.lastMove?.bonusRoll === true);
  check("still RED's turn", s.currentTurn === 0);
  check("game not over (other pieces remain)", finished === false);
}

console.log("Turn-timer auto-advance plays or skips the turn");
{
  const e = newGame();
  const before = e.getState().currentTurn;
  const r = e.autoAdvanceForTimeout("p0");
  const s = e.getState();
  check("auto rolled the dice", typeof r.rolled === "number");
  check(
    "turn resolved (advanced or bonus)",
    s.currentTurn !== before || s.lastMove?.bonusRoll === true || r.skipped
  );
}

function withDiceReturn<T>(value: number, fn: () => T): T {
  const orig = Math.random;
  Math.random = () => (value - 1) / 6 + 1e-9;
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
