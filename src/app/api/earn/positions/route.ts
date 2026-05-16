import { Prisma } from "@prisma/client";
import { getBearerSession } from "@/lib/auth";
import {
  getEarnBonusPool,
  serializeEarnConfig,
  serializeEarnPosition,
} from "@/lib/earn-service";
import { getEarnConfigFromEnv } from "@/lib/earn-ledger";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ZERO = new Prisma.Decimal(0);

export async function GET(request: Request) {
  const prisma = getPrisma();

  try {
    const session = getBearerSession(request);
    const user = await prisma.user.findUnique({ where: { walletAddress: session.walletAddress } });
    if (!user) throw new Error("User not found");

    const now = new Date();
    const [positions, activeTotals, redeemableTotals, bonusPool] = await prisma.$transaction(async (tx) => {
      const [positions, activeTotals, redeemableTotals, bonusPool] = await Promise.all([
        tx.earnPosition.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        tx.earnPosition.aggregate({
          where: { userId: user.id, status: "ACTIVE" },
          _sum: { principal: true },
          _count: true,
        }),
        tx.earnPosition.aggregate({
          where: { userId: user.id, status: "ACTIVE", unlockAt: { lte: now } },
          _sum: { principal: true },
          _count: true,
        }),
        getEarnBonusPool(tx),
      ]);
      return [positions, activeTotals, redeemableTotals, bonusPool] as const;
    });

    return NextResponse.json({
      positions: positions.map(serializeEarnPosition),
      summary: {
        lockedPrincipal: (activeTotals._sum.principal ?? ZERO).toString(),
        activeCount: activeTotals._count,
        redeemablePrincipal: (redeemableTotals._sum.principal ?? ZERO).toString(),
        redeemableCount: redeemableTotals._count,
        earnBonusPool: bonusPool.toString(),
      },
      config: serializeEarnConfig(getEarnConfigFromEnv()),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
