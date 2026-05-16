import { Prisma } from "@prisma/client";
import { getBearerSession } from "@/lib/auth";
import {
  calculateRedeemDecimals,
  getEarnBonusPool,
  serializeEarnConfig,
  serializeEarnPosition,
} from "@/lib/earn-service";
import { getEarnConfigFromEnv } from "@/lib/earn-ledger";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const prisma = getPrisma();

  try {
    const session = getBearerSession(request);
    const body = await request.json();
    const positionId = Number(body.positionId);
    if (!Number.isInteger(positionId)) throw new Error("Invalid earn position id");
    const config = getEarnConfigFromEnv();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { walletAddress: session.walletAddress } });
      if (!user) throw new Error("User not found");

      const position = await tx.earnPosition.findUnique({ where: { id: positionId } });
      if (!position || position.userId !== user.id) throw new Error("Earn position not found");
      if (position.status !== "ACTIVE") throw new Error("Earn position is not active");
      if (position.unlockAt > new Date()) throw new Error("Earn position is not matured");

      const bonusPool = await getEarnBonusPool(tx);
      const redeem = calculateRedeemDecimals({
        principal: position.principal,
        bonusPool,
        config,
      });

      if (redeem.externalYieldAmount.gt(0)) {
        await tx.platformLedgerEntry.create({
          data: {
            pool: "EARN_BONUS_POOL",
            source: "EARN_EXTERNAL_YIELD",
            sourceId: position.id,
            amount: redeem.externalYieldAmount,
            note: "External DeFi yield returned to earn bonus pool",
          },
        });
      }
      if (redeem.rewardAmount.gt(0)) {
        await tx.platformLedgerEntry.create({
          data: {
            pool: "EARN_BONUS_POOL",
            source: "EARN_REWARD_RELEASE",
            sourceId: position.id,
            amount: redeem.rewardAmount.neg(),
            note: "Earn reward released from bonus pool",
          },
        });
      }

      const updatedPosition = await tx.earnPosition.update({
        where: { id: position.id },
        data: {
          status: "REDEEMED",
          redeemedAt: new Date(),
          externalYieldAmount: redeem.externalYieldAmount,
          bonusPoolRewardAmount: redeem.bonusPoolRewardAmount,
          rewardAmount: redeem.rewardAmount,
        },
      });
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          balanceUsdt: {
            increment: redeem.userBalanceCredit,
          },
        },
      });
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "EARN_REDEEM",
          amount: position.principal,
          status: "SUCCESS",
        },
      });
      if (redeem.rewardAmount.gt(0)) {
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "REWARD",
            amount: redeem.rewardAmount,
            status: "SUCCESS",
          },
        });
      }

      return {
        position: updatedPosition,
        balanceUsdt: updatedUser.balanceUsdt.toString(),
        rewardAmount: redeem.rewardAmount.toString(),
        externalYieldAmount: redeem.externalYieldAmount.toString(),
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return NextResponse.json({
      position: serializeEarnPosition(result.position),
      user: {
        balanceUsdt: result.balanceUsdt,
      },
      redeem: {
        rewardAmount: result.rewardAmount,
        externalYieldAmount: result.externalYieldAmount,
      },
      config: serializeEarnConfig(config),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}
