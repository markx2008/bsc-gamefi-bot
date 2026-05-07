import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  assertWalletAddress,
  getBearerSession,
  verifyWalletBindingSignature,
} from "@/lib/auth";
export async function POST(request: Request) {
  const prisma = getPrisma();
  try {
    const session = getBearerSession(request);
    const { walletAddress, signature } = await request.json();

    if (!walletAddress || !signature) {
      return NextResponse.json({ error: "walletAddress and signature are required" }, { status: 400 });
    }

    const normalizedWallet = assertWalletAddress(walletAddress);
    const signatureHex = signature as `0x${string}`;
    const isValid = await verifyWalletBindingSignature({
      tgId: session.tgId,
      walletAddress: normalizedWallet,
      signature: signatureHex,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid wallet signature" }, { status: 401 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { tgId: session.tgId },
        data: { walletAddress: normalizedWallet },
      });

      const pendingDeposits = await tx.pendingDeposit.findMany({
        where: { walletAddress: normalizedWallet, status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });

      for (const deposit of pendingDeposits) {
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "DEPOSIT",
            amount: deposit.amount,
            txHash: deposit.txHash,
            status: "SUCCESS",
            blockNumber: deposit.blockNumber,
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            balanceUsdt: {
              increment: deposit.amount,
            },
          },
        });

        await tx.pendingDeposit.update({
          where: { id: deposit.id },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        });
      }

      return { user, resolvedDeposits: pendingDeposits.length };
    });

    return NextResponse.json({
      user: {
        id: result.user.id,
        tgId: result.user.tgId,
        walletAddress: result.user.walletAddress,
        balanceUsdt: result.user.balanceUsdt.toString(),
      },
      resolvedDeposits: result.resolvedDeposits,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
