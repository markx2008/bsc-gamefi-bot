export type AdminHealthStatus = "HEALTHY" | "WARNING" | "UNHEALTHY";

export type AdminHealthWarning =
  | "APY_BELOW_THRESHOLD"
  | "WITHDRAWAL_SHORTFALL"
  | "GAME_BANKROLL_NEGATIVE"
  | "NO_ACTIVE_EARN_PRINCIPAL";

export type RedeemedEarnPositionInput = {
  principal: string | number;
  rewardAmount: string | number;
  lockedAt: string | Date;
  redeemedAt: string | Date | null;
};

export type AdminHealthInput = {
  activeLockedPrincipal: string | number;
  earnBonusPool: string | number;
  apyCapPercent: string | number;
  lockDays: string | number;
  healthyApyThresholdPercent: string | number;
  pendingWithdrawalTotal: string | number;
  availableLiquidity: string | number;
  gameBankroll: string | number;
  redeemedPositions: RedeemedEarnPositionInput[];
};

export type AdminHealthResult = {
  overallStatus: AdminHealthStatus;
  instantApyPercent: string;
  realizedApyPercent: string;
  healthyApyThresholdPercent: string;
  withdrawalShortfall: string;
  isApyHealthy: boolean;
  isWithdrawalHealthy: boolean;
  isGameBankrollHealthy: boolean;
  warnings: AdminHealthWarning[];
};

export function calculateAdminHealth(input: AdminHealthInput): AdminHealthResult {
  const activeLockedPrincipal = nonNegativeNumber(input.activeLockedPrincipal);
  const earnBonusPool = nonNegativeNumber(input.earnBonusPool);
  const apyCapPercent = nonNegativeNumber(input.apyCapPercent);
  const lockDays = Math.max(1 / 24, nonNegativeNumber(input.lockDays));
  const healthyApyThresholdPercent = nonNegativeNumber(input.healthyApyThresholdPercent);
  const pendingWithdrawalTotal = nonNegativeNumber(input.pendingWithdrawalTotal);
  const availableLiquidity = nonNegativeNumber(input.availableLiquidity);
  const gameBankroll = finiteNumber(input.gameBankroll);

  const instantApyPercent = calculateInstantApyPercent({
    activeLockedPrincipal,
    earnBonusPool,
    apyCapPercent,
    lockDays,
  });
  const realizedApyPercent = calculateRealizedApyPercent(input.redeemedPositions);
  const withdrawalShortfall = Math.max(0, pendingWithdrawalTotal - availableLiquidity);

  const warnings: AdminHealthWarning[] = [];
  if (activeLockedPrincipal <= 0) warnings.push("NO_ACTIVE_EARN_PRINCIPAL");
  if (instantApyPercent < healthyApyThresholdPercent) warnings.push("APY_BELOW_THRESHOLD");
  if (withdrawalShortfall > 0) warnings.push("WITHDRAWAL_SHORTFALL");
  if (gameBankroll < 0) warnings.push("GAME_BANKROLL_NEGATIVE");

  const isApyHealthy = instantApyPercent >= healthyApyThresholdPercent;
  const isWithdrawalHealthy = withdrawalShortfall <= 0;
  const isGameBankrollHealthy = gameBankroll >= 0;
  const overallStatus = getOverallStatus({
    isApyHealthy,
    isWithdrawalHealthy,
    isGameBankrollHealthy,
  });

  return {
    overallStatus,
    instantApyPercent: formatNumber(instantApyPercent),
    realizedApyPercent: formatNumber(realizedApyPercent),
    healthyApyThresholdPercent: formatNumber(healthyApyThresholdPercent),
    withdrawalShortfall: formatNumber(withdrawalShortfall),
    isApyHealthy,
    isWithdrawalHealthy,
    isGameBankrollHealthy,
    warnings,
  };
}

function calculateInstantApyPercent(params: {
  activeLockedPrincipal: number;
  earnBonusPool: number;
  apyCapPercent: number;
  lockDays: number;
}) {
  if (params.activeLockedPrincipal <= 0) return 0;
  const periodCapRate = (params.apyCapPercent / 100) * (params.lockDays / 365);
  const poolSupportedPeriodRate = params.earnBonusPool / params.activeLockedPrincipal;
  const instantPeriodRate = Math.min(periodCapRate, poolSupportedPeriodRate);
  return instantPeriodRate * (365 / params.lockDays) * 100;
}

function calculateRealizedApyPercent(positions: RedeemedEarnPositionInput[]) {
  let rewardTotal = 0;
  let weightedPrincipalDays = 0;

  for (const position of positions) {
    if (!position.redeemedAt) continue;
    const principal = nonNegativeNumber(position.principal);
    const rewardAmount = nonNegativeNumber(position.rewardAmount);
    const lockedAt = new Date(position.lockedAt).getTime();
    const redeemedAt = new Date(position.redeemedAt).getTime();
    if (!Number.isFinite(lockedAt) || !Number.isFinite(redeemedAt)) continue;
    const lockedDays = Math.max(1 / 24, (redeemedAt - lockedAt) / 86_400_000);
    rewardTotal += rewardAmount;
    weightedPrincipalDays += principal * lockedDays;
  }

  if (weightedPrincipalDays <= 0) return 0;
  return (rewardTotal / weightedPrincipalDays) * 365 * 100;
}

function getOverallStatus(params: {
  isApyHealthy: boolean;
  isWithdrawalHealthy: boolean;
  isGameBankrollHealthy: boolean;
}): AdminHealthStatus {
  if (!params.isWithdrawalHealthy || !params.isGameBankrollHealthy) return "UNHEALTHY";
  if (params.isApyHealthy) return "HEALTHY";
  return "WARNING";
}

function nonNegativeNumber(value: string | number) {
  return Math.max(0, finiteNumber(value));
}

function finiteNumber(value: string | number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatNumber(value: number) {
  return roundMoney(value).toString();
}

function roundMoney(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
