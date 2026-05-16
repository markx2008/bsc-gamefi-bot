import { Prisma } from "@prisma/client";
import {
  calculateEarnRedeemAmounts,
  getEarnConfigFromEnv,
  type EarnConfig,
} from "@/lib/earn-ledger";

const ZERO = new Prisma.Decimal(0);

export function decimalFromNumber(value: number) {
  return new Prisma.Decimal(value.toFixed(6));
}

export function parsePositiveDecimal(value: unknown) {
  const amount = new Prisma.Decimal(String(value || "0"));
  if (amount.lte(0)) throw new Error("Amount must be > 0");
  return amount;
}

export function getUnlockAt(now = new Date(), config = getEarnConfigFromEnv()) {
  return new Date(now.getTime() + config.lockDays * 24 * 60 * 60 * 1000);
}

export async function getEarnBonusPool(tx: {
  platformLedgerEntry: {
    aggregate: (args: { where: { pool: "EARN_BONUS_POOL" }; _sum: { amount: true } }) => Promise<{ _sum: { amount: Prisma.Decimal | null } }>;
  };
}) {
  const totals = await tx.platformLedgerEntry.aggregate({
    where: { pool: "EARN_BONUS_POOL" },
    _sum: { amount: true },
  });
  return totals._sum.amount ?? ZERO;
}

export async function getPendingWithdrawalTotal(tx: {
  withdrawalRequest: {
    aggregate: (args: { where: { userId: number; status: "PENDING" }; _sum: { amount: true } }) => Promise<{ _sum: { amount: Prisma.Decimal | null } }>;
  };
}, userId: number) {
  const pendingWithdrawals = await tx.withdrawalRequest.aggregate({
    where: { userId, status: "PENDING" },
    _sum: { amount: true },
  });
  return pendingWithdrawals._sum.amount ?? ZERO;
}

export function serializeEarnPosition(position: {
  id: number;
  principal: Prisma.Decimal;
  status: string;
  lockedAt: Date;
  unlockAt: Date;
  redeemedAt: Date | null;
  externalYieldAmount: Prisma.Decimal;
  bonusPoolRewardAmount: Prisma.Decimal;
  rewardAmount: Prisma.Decimal;
}) {
  return {
    id: position.id,
    principal: position.principal.toString(),
    status: position.status,
    lockedAt: position.lockedAt,
    unlockAt: position.unlockAt,
    redeemedAt: position.redeemedAt,
    externalYieldAmount: position.externalYieldAmount.toString(),
    bonusPoolRewardAmount: position.bonusPoolRewardAmount.toString(),
    rewardAmount: position.rewardAmount.toString(),
  };
}

export function serializeEarnConfig(config: EarnConfig) {
  return {
    lockDays: config.lockDays,
    minLockAmount: config.minLockAmount,
    apyCapPercent: config.apyCapPercent,
    externalApyPercent: config.externalApyPercent,
  };
}

export function calculateRedeemDecimals(params: {
  principal: Prisma.Decimal;
  bonusPool: Prisma.Decimal;
  config: EarnConfig;
}) {
  const amounts = calculateEarnRedeemAmounts({
    principal: Number(params.principal.toString()),
    bonusPoolBeforeExternalYield: Number(params.bonusPool.toString()),
    config: params.config,
  });

  return {
    amounts,
    externalYieldAmount: decimalFromNumber(amounts.externalYieldAmount),
    rewardAmount: decimalFromNumber(amounts.rewardAmount),
    bonusPoolRewardAmount: decimalFromNumber(amounts.bonusPoolRewardAmount),
    userBalanceCredit: decimalFromNumber(amounts.userBalanceCredit),
  };
}
