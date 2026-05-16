import { Prisma } from "@prisma/client";
import { getBearerSession } from "@/lib/auth";
import {
  getPendingWithdrawalTotal,
  getUnlockAt,
  parsePositiveDecimal,
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
    const amount = parsePositiveDecimal(body.amount);
    const config = getEarnConfigFromEnv();
    if (amount.lt(new Prisma.Decimal(config.minLockAmount))) {
      throw new Error(`收益寶最低鎖倉金額為 ${config.minLockAmount} USDT。`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { walletAddress: session.walletAddress } });
      if (!user) throw new Error("User not found");

      const pendingWithdrawalTotal = await getPendingWithdrawalTotal(tx, user.id);
      const availableBalance = user.balanceUsdt.minus(pendingWithdrawalTotal);
      if (availableBalance.lt(amount)) throw new Error("Insufficient available balance");

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { balanceUsdt: { decrement: amount } },
      });
      const position = await tx.earnPosition.create({
        data: {
          userId: user.id,
          principal: amount,
          unlockAt: getUnlockAt(new Date(), config),
        },
      });
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "EARN_LOCK",
          amount,
          status: "SUCCESS",
        },
      });

      return {
        position,
        balanceUsdt: updatedUser.balanceUsdt.toString(),
        availableBalanceUsdt: updatedUser.balanceUsdt.minus(pendingWithdrawalTotal).toString(),
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return NextResponse.json({
      position: serializeEarnPosition(result.position),
      user: {
        balanceUsdt: result.balanceUsdt,
        availableBalanceUsdt: result.availableBalanceUsdt,
      },
      config: serializeEarnConfig(config),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}
