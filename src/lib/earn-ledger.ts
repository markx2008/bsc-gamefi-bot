export type EarnConfig = {
  lockDays: number;
  minLockAmount: number;
  apyCapPercent: number;
  externalApyPercent: number;
};

export type EarnRedeemInput = {
  principal: number;
  bonusPoolBeforeExternalYield: number;
  config: EarnConfig;
};

export type EarnRedeemAmounts = {
  externalYieldAmount: number;
  rewardCapAmount: number;
  bonusPoolRewardAmount: number;
  rewardAmount: number;
  userBalanceCredit: number;
  bonusPoolDelta: number;
  bonusPoolAfterRedeem: number;
};

export function getDefaultEarnConfig(): EarnConfig {
  return {
    lockDays: 7,
    minLockAmount: 10,
    apyCapPercent: 15,
    externalApyPercent: 8,
  };
}

export function getEarnConfigFromEnv(): EarnConfig {
  const defaults = getDefaultEarnConfig();
  return {
    lockDays: numberFromEnv("EARN_LOCK_DAYS", defaults.lockDays),
    minLockAmount: numberFromEnv("EARN_MIN_LOCK_USDT", defaults.minLockAmount),
    apyCapPercent: numberFromEnv("EARN_APY_CAP_PERCENT", defaults.apyCapPercent),
    externalApyPercent: numberFromEnv("EARN_EXTERNAL_APY_PERCENT", defaults.externalApyPercent),
  };
}

export function calculateExternalYield(principal: number, config: EarnConfig) {
  assertPositivePrincipal(principal);
  return roundMoney(principal * (safePercent(config.externalApyPercent) / 100) * (safeLockDays(config.lockDays) / 365));
}

export function calculatePeriodRewardCap(principal: number, config: EarnConfig) {
  assertPositivePrincipal(principal);
  return roundMoney(principal * (safePercent(config.apyCapPercent) / 100) * (safeLockDays(config.lockDays) / 365));
}

export function calculateEarnRedeemAmounts(input: EarnRedeemInput): EarnRedeemAmounts {
  assertPositivePrincipal(input.principal);
  const bonusPoolBeforeExternalYield = Math.max(0, safeNumber(input.bonusPoolBeforeExternalYield, 0));
  const externalYieldAmount = calculateExternalYield(input.principal, input.config);
  const rewardCapAmount = calculatePeriodRewardCap(input.principal, input.config);
  const bonusPoolAfterExternalYield = bonusPoolBeforeExternalYield + externalYieldAmount;
  const rewardAmount = roundMoney(Math.min(rewardCapAmount, bonusPoolAfterExternalYield));
  const bonusPoolAfterRedeem = roundMoney(bonusPoolAfterExternalYield - rewardAmount);

  return {
    externalYieldAmount,
    rewardCapAmount,
    bonusPoolRewardAmount: rewardAmount,
    rewardAmount,
    userBalanceCredit: roundMoney(input.principal + rewardAmount),
    bonusPoolDelta: roundMoney(externalYieldAmount - rewardAmount),
    bonusPoolAfterRedeem,
  };
}

function assertPositivePrincipal(principal: number) {
  if (!Number.isFinite(principal) || principal <= 0) throw new Error("Principal must be > 0");
}

function numberFromEnv(name: string, fallback: number) {
  return safeNumber(Number(process.env[name]), fallback);
}

function safeNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function safePercent(value: number) {
  return Math.max(0, safeNumber(value, 0));
}

function safeLockDays(value: number) {
  return Math.max(1 / 24, safeNumber(value, 7));
}

function roundMoney(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
