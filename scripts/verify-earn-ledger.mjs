import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const sourcePath = path.resolve("src/lib/earn-ledger.ts");
const source = await readFile(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const tempDir = path.join(tmpdir(), "bsc-gamefi-earn-ledger-tests");
await mkdir(tempDir, { recursive: true });
const modulePath = path.join(tempDir, `earn-ledger-${Date.now()}.mjs`);
await writeFile(modulePath, output.outputText, "utf8");

const earn = await import(`file://${modulePath}`);
const {
  calculateEarnRedeemAmounts,
  calculateExternalYield,
  calculatePeriodRewardCap,
  getDefaultEarnConfig,
} = earn;

function almostEqual(actual, expected, tolerance = 0.000001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

{
  const config = getDefaultEarnConfig();
  assert.equal(config.lockDays, 7);
  assert.equal(config.minLockAmount, 10);
  assert.equal(config.apyCapPercent, 15);
  assert.equal(config.externalApyPercent, 8);
}

{
  const config = getDefaultEarnConfig();
  almostEqual(calculateExternalYield(1000, config), 1000 * 0.08 * (7 / 365));
  almostEqual(calculatePeriodRewardCap(1000, config), 1000 * 0.15 * (7 / 365));
}

{
  const result = calculateEarnRedeemAmounts({
    principal: 1000,
    bonusPoolBeforeExternalYield: 100,
    config: getDefaultEarnConfig(),
  });

  almostEqual(result.externalYieldAmount, 1.534247);
  almostEqual(result.rewardAmount, 2.876712);
  almostEqual(result.bonusPoolRewardAmount, 2.876712);
  almostEqual(result.userBalanceCredit, 1002.876712);
  almostEqual(result.bonusPoolDelta, -1.342466);
  almostEqual(result.bonusPoolAfterRedeem, 98.657534);
}

{
  const result = calculateEarnRedeemAmounts({
    principal: 1000,
    bonusPoolBeforeExternalYield: 0,
    config: { ...getDefaultEarnConfig(), externalApyPercent: 0 },
  });

  almostEqual(result.externalYieldAmount, 0);
  almostEqual(result.rewardAmount, 0);
  almostEqual(result.userBalanceCredit, 1000);
  almostEqual(result.bonusPoolDelta, 0);
  almostEqual(result.bonusPoolAfterRedeem, 0);
}

{
  const result = calculateEarnRedeemAmounts({
    principal: 1000,
    bonusPoolBeforeExternalYield: 1,
    config: { ...getDefaultEarnConfig(), externalApyPercent: 0 },
  });

  almostEqual(result.rewardAmount, 1);
  almostEqual(result.userBalanceCredit, 1001);
  almostEqual(result.bonusPoolAfterRedeem, 0);
}

assert.throws(() => calculateEarnRedeemAmounts({
  principal: 0,
  bonusPoolBeforeExternalYield: 100,
  config: getDefaultEarnConfig(),
}), /Principal must be > 0/);

console.log("Earn ledger checks passed");
