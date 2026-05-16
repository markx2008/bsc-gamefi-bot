import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const sourcePath = path.resolve("src/lib/game-ledger.ts");
const source = await readFile(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const tempDir = path.join(tmpdir(), "bsc-gamefi-game-ledger-tests");
await mkdir(tempDir, { recursive: true });
const modulePath = path.join(tempDir, `game-ledger-${Date.now()}.mjs`);
await writeFile(modulePath, output.outputText, "utf8");

const ledger = await import(`file://${modulePath}`);
const {
  calculateCoinFlipSettlement,
  getDefaultGameLedgerConfig,
  normalizeCoinFlipChoice,
} = ledger;

function almostEqual(actual, expected, tolerance = 0.000001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

{
  const config = getDefaultGameLedgerConfig();
  assert.equal(config.houseEdgePercent, 3);
  assert.equal(config.platformFeePercent, 5);
  assert.equal(config.gameBankrollReservePercent, 90);
}

{
  assert.equal(normalizeCoinFlipChoice("heads"), "HEADS");
  assert.equal(normalizeCoinFlipChoice("TAILS"), "TAILS");
  assert.throws(() => normalizeCoinFlipChoice("edge"), /Invalid coin flip choice/);
}

{
  const settlement = calculateCoinFlipSettlement({
    betAmount: 100,
    playerChoice: "HEADS",
    outcome: "HEADS",
    config: getDefaultGameLedgerConfig(),
  });

  assert.equal(settlement.result, "PLAYER_WIN");
  almostEqual(settlement.playerProfit, 94);
  almostEqual(settlement.userBalanceDelta, 94);
  almostEqual(settlement.houseProfit, -94);
  almostEqual(settlement.payoutAmount, 194);
  almostEqual(settlement.platformCut, 0);
  almostEqual(settlement.bonusPoolCut, 0);
  almostEqual(settlement.gameBankrollDelta, -94);
}

{
  const settlement = calculateCoinFlipSettlement({
    betAmount: 100,
    playerChoice: "HEADS",
    outcome: "TAILS",
    config: getDefaultGameLedgerConfig(),
  });

  assert.equal(settlement.result, "HOUSE_WIN");
  almostEqual(settlement.userBalanceDelta, -100);
  almostEqual(settlement.houseProfit, 100);
  almostEqual(settlement.payoutAmount, 0);
  almostEqual(settlement.platformCut, 5);
  almostEqual(settlement.gameBankrollDelta, 90);
  almostEqual(settlement.bonusPoolCut, 5);
}

{
  const settlement = calculateCoinFlipSettlement({
    betAmount: 100,
    playerChoice: "TAILS",
    outcome: "HEADS",
    config: {
      ...getDefaultGameLedgerConfig(),
      platformFeePercent: 35,
      gameBankrollReservePercent: 80,
    },
  });

  assert.equal(settlement.result, "HOUSE_WIN");
  almostEqual(settlement.platformCut, 35);
  almostEqual(settlement.gameBankrollDelta, 65);
  almostEqual(settlement.bonusPoolCut, 0);
}

assert.throws(() => calculateCoinFlipSettlement({
  betAmount: 0,
  playerChoice: "HEADS",
  outcome: "TAILS",
  config: getDefaultGameLedgerConfig(),
}), /Bet amount must be > 0/);

console.log("Game ledger checks passed");
