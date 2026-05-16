import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const sourcePath = path.resolve("src/lib/admin-health.ts");
const source = await readFile(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const tempDir = path.join(tmpdir(), "bsc-gamefi-admin-health-tests");
await mkdir(tempDir, { recursive: true });
const modulePath = path.join(tempDir, `admin-health-${Date.now()}.mjs`);
await writeFile(modulePath, output.outputText, "utf8");

const health = await import(`file://${modulePath}`);
const { calculateAdminHealth } = health;

function almostEqual(actual, expected, tolerance = 0.000001) {
  assert.ok(Math.abs(Number(actual) - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "1000",
    earnBonusPool: "10",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "100",
    availableLiquidity: "500",
    gameBankroll: "1000",
    redeemedPositions: [],
  });

  assert.equal(result.overallStatus, "HEALTHY");
  assert.equal(result.isApyHealthy, true);
  assert.equal(result.isWithdrawalHealthy, true);
  assert.equal(result.isGameBankrollHealthy, true);
  almostEqual(result.instantApyPercent, 25);
  assert.deepEqual(result.warnings, []);
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "1000",
    earnBonusPool: "1",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "100",
    availableLiquidity: "500",
    gameBankroll: "1000",
    redeemedPositions: [],
  });

  assert.equal(result.overallStatus, "WARNING");
  assert.equal(result.isApyHealthy, false);
  assert.ok(result.warnings.includes("APY_BELOW_THRESHOLD"));
  almostEqual(result.instantApyPercent, 5.214285714285714);
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "1000",
    earnBonusPool: "10",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "600",
    availableLiquidity: "500",
    gameBankroll: "1000",
    redeemedPositions: [],
  });

  assert.equal(result.overallStatus, "UNHEALTHY");
  assert.equal(result.isWithdrawalHealthy, false);
  assert.equal(result.withdrawalShortfall, "100");
  assert.ok(result.warnings.includes("WITHDRAWAL_SHORTFALL"));
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "1000",
    earnBonusPool: "10",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "100",
    availableLiquidity: "500",
    gameBankroll: "-1",
    redeemedPositions: [],
  });

  assert.equal(result.overallStatus, "UNHEALTHY");
  assert.equal(result.isGameBankrollHealthy, false);
  assert.ok(result.warnings.includes("GAME_BANKROLL_NEGATIVE"));
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "0",
    earnBonusPool: "10",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "0",
    availableLiquidity: "500",
    gameBankroll: "1000",
    redeemedPositions: [],
  });

  assert.equal(result.overallStatus, "WARNING");
  assert.equal(result.instantApyPercent, "0");
  assert.ok(result.warnings.includes("NO_ACTIVE_EARN_PRINCIPAL"));
}

{
  const result = calculateAdminHealth({
    activeLockedPrincipal: "1000",
    earnBonusPool: "10",
    apyCapPercent: 25,
    lockDays: 7,
    healthyApyThresholdPercent: 20,
    pendingWithdrawalTotal: "0",
    availableLiquidity: "500",
    gameBankroll: "1000",
    redeemedPositions: [
      {
        principal: "1000",
        rewardAmount: "10",
        lockedAt: "2026-05-01T00:00:00.000Z",
        redeemedAt: "2026-05-08T00:00:00.000Z",
      },
    ],
  });

  almostEqual(result.realizedApyPercent, 52.142857142857146);
}

console.log("Admin health checks passed");
