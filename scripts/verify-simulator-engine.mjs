import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const sourcePath = path.resolve("src/lib/simulator.ts");
const source = await readFile(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const tempDir = path.join(tmpdir(), "bsc-gamefi-simulator-tests");
await mkdir(tempDir, { recursive: true });
const modulePath = path.join(tempDir, `simulator-${Date.now()}.mjs`);
await writeFile(modulePath, output.outputText, "utf8");

const simulator = await import(`file://${modulePath}`);
const {
  calculateGameProfitDistribution,
  createInitialSimulatorState,
  getDefaultSimulatorConfig,
  normalizeSimulatorConfig,
  runSimulation,
  stepSimulator,
  sweepPlatformFees,
} = simulator;

function almostEqual(actual, expected, tolerance = 0.000001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

function findEffect(event, label) {
  const effect = event.effects?.find((item) => item.label === label);
  assert.ok(effect, `expected event "${event.title}" to include effect label "${label}"`);
  return effect;
}

{
  const config = getDefaultSimulatorConfig();
  assert.equal(config.gameBankrollReservePercent, 20);
  assert.equal(config.stakingPeriodRewardCapPercent, 10);
  const distribution = calculateGameProfitDistribution(100, config);

  almostEqual(distribution.platformCut, 10);
  almostEqual(distribution.gameBankrollReserve, 20);
  almostEqual(distribution.bonusPoolCut, 70);
}

{
  const config = {
    ...getDefaultSimulatorConfig(),
    initialBonusPool: 500,
    withdrawalRequestPercent: 0,
    playerArrivalMin: 0,
    playerArrivalMax: 0,
    tickHours: 24,
    stakingPeriodRewardCapPercent: 10,
  };
  let state = createInitialSimulatorState(config);
  state = {
    ...state,
    lockedPositions: [{ amount: 1000, unlockHour: 168, createdHour: 0, rewardAccrued: 0 }],
    summary: {
      ...state.summary,
      bonusPool: 500,
      lockedPrincipal: 1000,
    },
  };
  state = stepSimulator(config, state);

  almostEqual(state.summary.bonusPool, 400);
  almostEqual(state.summary.rewardsPaid, 100);
  almostEqual(state.lockedPositions[0].rewardAccrued, 100);

  const rewardEvent = state.events.find((event) => event.type === "reward");
  assert.ok(rewardEvent, "capped reward distribution should create an event");
  almostEqual(findEffect(rewardEvent, "收益寶獎金池").amount, -100);
  almostEqual(findEffect(rewardEvent, "鎖倉累積分紅").amount, 100);
}

{
  const config = normalizeSimulatorConfig({
    platformFeePercent: 35,
    gameBankrollReservePercent: 80,
  });
  const distribution = calculateGameProfitDistribution(100, config);

  almostEqual(distribution.platformCut, 35);
  almostEqual(distribution.gameBankrollReserve, 65);
  almostEqual(distribution.bonusPoolCut, 0);
}

{
  const config = normalizeSimulatorConfig({
    seed: 1,
    tickHours: 1,
    initialGameBankroll: 1000,
    initialBonusPool: 0,
    playerArrivalMin: 0,
    playerArrivalMax: 0,
    capitalMin: 0,
    capitalMax: 0,
    betSizeMin: 0,
    betSizeMax: 0,
    gameTrafficPercent: 100,
    stakingTrafficPercent: 0,
    coinFlipPercent: 100,
    dicePercent: 0,
    luckySpinPercent: 0,
    houseEdgePercent: 3,
    platformFeePercent: 10,
    stakingLockDays: 7,
    healthyApyPercent: 20,
  });

  assert.equal(config.withdrawalRequestPercent, getDefaultSimulatorConfig().withdrawalRequestPercent);
  assert.equal(config.withdrawalApprovalDelayHours, getDefaultSimulatorConfig().withdrawalApprovalDelayHours);
  const state = stepSimulator(config, createInitialSimulatorState(config));
  assert.equal(Number.isFinite(state.summary.pendingWithdrawals), true);
}

{
  const config = getDefaultSimulatorConfig();
  const first = runSimulation(config, 120);
  const second = runSimulation(config, 120);

  assert.deepEqual(first.summary, second.summary, "same seed and config should produce repeatable summaries");
  assert.equal(first.history.length, 120);
}

{
  const config = {
    ...getDefaultSimulatorConfig(),
    initialBonusPool: 50,
    withdrawalRequestPercent: 0,
    playerArrivalMin: 1,
    playerArrivalMax: 1,
    gameTrafficPercent: 0,
    stakingTrafficPercent: 100,
    tickHours: 24,
  };
  const result = runSimulation(config, 10);

  assert.equal(result.summary.bonusPool, 0, "floating rewards can spend the available pool");
  assert.ok(result.summary.rewardsPaid <= 50, "floating rewards cannot pay more than the available pool");
  assert.ok(result.summary.lockedPrincipal >= 0, "locked principal never goes negative");
}

{
  const base = {
    ...getDefaultSimulatorConfig(),
    seed: 99,
    gameTrafficPercent: 100,
    stakingTrafficPercent: 0,
    playerArrivalMin: 4,
    playerArrivalMax: 4,
  };
  const ten = runSimulation({ ...base, platformFeePercent: 10 }, 300).summary;
  const twenty = runSimulation({ ...base, platformFeePercent: 20 }, 300).summary;

  assert.ok(twenty.platformRevenue > ten.platformRevenue, "higher platform fee should increase platform revenue on the same positive-profit seed");
  assert.ok(twenty.bonusPool < ten.bonusPool, "higher platform fee should leave less game profit for the bonus pool");
}

{
  const config = {
    ...getDefaultSimulatorConfig(),
    seed: 2,
    initialGameBankroll: 1000,
    initialBonusPool: 0,
    playerArrivalMin: 1,
    playerArrivalMax: 1,
    gameTrafficPercent: 100,
    stakingTrafficPercent: 0,
    coinFlipPercent: 100,
    dicePercent: 0,
    luckySpinPercent: 0,
    betSizeMin: 100,
    betSizeMax: 100,
    withdrawalRequestPercent: 0,
  };
  const state = stepSimulator(config, createInitialSimulatorState(config));
  const gameEvent = state.events.find((event) => event.type === "game");

  assert.ok(gameEvent.amount < 0, "fixed seed should produce a player win");
  almostEqual(state.summary.gameBankroll, 913);
  almostEqual(state.summary.userWithdrawableBalance, 87);
  almostEqual(state.summary.platformLiquidity, 1000);
}

{
  const config = {
    ...getDefaultSimulatorConfig(),
    seed: 7,
    playerArrivalMin: 3,
    playerArrivalMax: 3,
    gameTrafficPercent: 75,
    stakingTrafficPercent: 25,
    healthyApyPercent: 20,
  };
  const sweep = sweepPlatformFees(config, [10, 20], 160);

  assert.equal(sweep.scenarios.length, 2);
  assert.ok([10, 20].includes(sweep.recommendedFeePercent), "sweep recommends one of the tested fee options");
}

{
  const config = {
    ...getDefaultSimulatorConfig(),
    initialBonusPool: 0,
    withdrawalRequestPercent: 0,
    playerArrivalMin: 0,
    playerArrivalMax: 0,
    gameTrafficPercent: 0,
    stakingTrafficPercent: 100,
    tickHours: 24,
  };
  let state = createInitialSimulatorState(config);
  state = {
    ...state,
    lockedPositions: [{ amount: 100, unlockHour: 168, createdHour: 0, rewardAccrued: 10 }],
    summary: {
      ...state.summary,
      lockedPrincipal: 100,
    },
  };
  for (let index = 0; index < 8; index += 1) {
    state = stepSimulator(config, state);
  }

  almostEqual(state.summary.lockedPrincipal, 0);
  almostEqual(state.summary.userWithdrawableBalance, 110);

  const matureEvent = state.events.find((event) => event.type === "mature");
  assert.ok(matureEvent, "maturity should create an event");
  almostEqual(findEffect(matureEvent, "鎖倉本金").amount, -100);
  almostEqual(findEffect(matureEvent, "非鎖倉可提款").amount, 110);
  almostEqual(findEffect(matureEvent, "收益寶 APY").amount, 521.4285714285714);
}

{
  const config = {
    ...getDefaultSimulatorConfig(),
    initialBonusPool: 100,
    playerArrivalMin: 0,
    playerArrivalMax: 0,
    tickHours: 1,
  };
  let state = createInitialSimulatorState(config);
  state = {
    ...state,
    lockedPositions: [{ amount: 1000, unlockHour: 168, createdHour: 0, rewardAccrued: 0 }],
    summary: {
      ...state.summary,
      bonusPool: 100,
      lockedPrincipal: 1000,
    },
  };
  state = stepSimulator(config, state);

  almostEqual(state.summary.instantApyPercent, 3650);
}

{
  const config = {
    ...getDefaultSimulatorConfig(),
    initialBonusPool: 100,
    playerArrivalMin: 0,
    playerArrivalMax: 0,
    tickHours: 1,
  };
  const state = stepSimulator(config, createInitialSimulatorState(config));

  assert.equal(Number.isFinite(state.summary.instantApyPercent), true);
  almostEqual(state.summary.instantApyPercent, 0);
}

{
  const config = {
    ...getDefaultSimulatorConfig(),
    initialBonusPool: 50,
    withdrawalRequestPercent: 0,
    playerArrivalMin: 0,
    playerArrivalMax: 0,
    tickHours: 24,
  };
  let state = createInitialSimulatorState(config);
  state = {
    ...state,
    lockedPositions: [{ amount: 1000, unlockHour: 168, createdHour: 0, rewardAccrued: 0 }],
    summary: {
      ...state.summary,
      bonusPool: 50,
      lockedPrincipal: 1000,
    },
  };
  state = stepSimulator(config, state);

  almostEqual(state.summary.bonusPool, 0);
  almostEqual(state.summary.rewardsPaid, 50);
  almostEqual(state.summary.userWithdrawableBalance, 0);
  almostEqual(state.lockedPositions[0].rewardAccrued, 50);

  const rewardEvent = state.events.find((event) => event.type === "reward");
  assert.ok(rewardEvent, "reward distribution should create an event");
  almostEqual(findEffect(rewardEvent, "收益寶獎金池").amount, -50);
  almostEqual(findEffect(rewardEvent, "鎖倉累積分紅").amount, 50);
}

{
  const config = {
    ...getDefaultSimulatorConfig(),
    playerArrivalMin: 0,
    playerArrivalMax: 0,
    withdrawalRequestPercent: 50,
    withdrawalApprovalDelayHours: 24,
    tickHours: 24,
  };
  let state = createInitialSimulatorState(config);
  state = {
    ...state,
    summary: {
      ...state.summary,
      userWithdrawableBalance: 100,
      platformLiquidity: 1000,
    },
  };
  state = stepSimulator(config, state);

  almostEqual(state.summary.userWithdrawableBalance, 50);
  almostEqual(state.summary.pendingWithdrawals, 50);
  almostEqual(state.summary.withdrawalsPaid, 0);

  const requestEvent = state.events.find((event) => event.title === "提款申請");
  assert.ok(requestEvent, "withdrawal request should create an event");
  almostEqual(findEffect(requestEvent, "非鎖倉可提款").amount, -50);
  almostEqual(findEffect(requestEvent, "待處理提款").amount, 50);

  state = stepSimulator(config, state);

  almostEqual(state.summary.pendingWithdrawals, 25);
  almostEqual(state.summary.withdrawalsPaid, 50);
  almostEqual(state.summary.withdrawalShortfall, 0);

  const paidEvent = state.events.find((event) => event.title === "提款支付");
  assert.ok(paidEvent, "withdrawal payment should create an event");
  almostEqual(findEffect(paidEvent, "待處理提款").amount, -50);
  almostEqual(findEffect(paidEvent, "平台流動性").amount, -50);
}

{
  const config = {
    ...getDefaultSimulatorConfig(),
    playerArrivalMin: 0,
    playerArrivalMax: 0,
    withdrawalRequestPercent: 100,
    withdrawalApprovalDelayHours: 0,
    tickHours: 1,
  };
  let state = createInitialSimulatorState(config);
  state = {
    ...state,
    summary: {
      ...state.summary,
      userWithdrawableBalance: 100,
      platformLiquidity: 20,
    },
  };
  state = stepSimulator(config, state);

  almostEqual(state.summary.withdrawalsPaid, 20);
  almostEqual(state.summary.withdrawalShortfall, 80);
  almostEqual(state.summary.pendingWithdrawals, 80);
  assert.ok(state.summary.warningCount > 0);

  const shortfallEvent = state.events.find((event) => event.title === "逾期未付提款");
  assert.ok(shortfallEvent, "withdrawal shortfall should create an event");
  almostEqual(findEffect(shortfallEvent, "逾期未付提款").amount, 80);

  state = {
    ...state,
    summary: {
      ...state.summary,
      platformLiquidity: 100,
    },
  };
  state = stepSimulator({ ...config, withdrawalRequestPercent: 0 }, state);

  almostEqual(state.summary.withdrawalShortfall, 0);
  almostEqual(state.summary.pendingWithdrawals, 0);
  almostEqual(state.summary.withdrawalsPaid, 100);

  const repayEvent = state.events.find((event) => event.title === "缺口補付");
  assert.ok(repayEvent, "later liquidity should repay unpaid withdrawal shortfall");
  almostEqual(findEffect(repayEvent, "逾期未付提款").amount, -80);
  almostEqual(findEffect(repayEvent, "平台流動性").amount, -80);
}

{
  const config = {
    ...getDefaultSimulatorConfig(),
    initialBonusPool: 0,
    withdrawalRequestPercent: 0,
    playerArrivalMin: 1,
    playerArrivalMax: 1,
    gameTrafficPercent: 0,
    stakingTrafficPercent: 100,
    tickHours: 1,
  };
  const state = stepSimulator(config, createInitialSimulatorState(config));

  const stakeEvent = state.events.find((event) => event.type === "stake");
  assert.ok(stakeEvent, "staking should create an event");
  assert.ok(findEffect(stakeEvent, "鎖倉本金").amount > 0);
  assert.ok(findEffect(stakeEvent, "平台流動性").amount > 0);
}

console.log("Simulator engine verification passed");
