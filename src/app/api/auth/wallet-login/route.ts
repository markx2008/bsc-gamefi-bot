import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  assertWalletAddress,
  isAdminWalletAddress,
  signSessionToken,
  verifyWalletLoginSignature,
} from "@/lib/auth";

async function resolvePendingDepositsForUser(
  tx: Prisma.TransactionClient,
  user: { id: number; walletAddress: string },
) {
  const pendingDeposits = await tx.pendingDeposit.findMany({
    where: { walletAddress: user.walletAddress, status: "PENDING" },
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

  return pendingDeposits.length;
}

export async function POST(request: Request) {
  const prisma = getPrisma();

  try {
    const { walletAddress, signature } = await request.json();
    if (!walletAddress || !signature) {
      return NextResponse.json({ error: "walletAddress and signature are required" }, { status: 400 });
    }

    const normalizedWallet = assertWalletAddress(walletAddress);
    const isValid = await verifyWalletLoginSignature({
      walletAddress: normalizedWallet,
      signature: signature as `0x${string}`,
    });
    if (!isValid) return NextResponse.json({ error: "Invalid wallet signature" }, { status: 401 });

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { walletAddress: normalizedWallet },
        create: { walletAddress: normalizedWallet },
        update: {},
      });
      const resolvedDeposits = await resolvePendingDepositsForUser(tx, user);
      return { user, resolvedDeposits };
    });

    const token = signSessionToken({ walletAddress: result.user.walletAddress }, process.env.JWT_SECRET || "");

    return NextResponse.json({
      token,
      user: {
        id: result.user.id,
        walletAddress: result.user.walletAddress,
        balanceUsdt: result.user.balanceUsdt.toString(),
        isAdmin: isAdminWalletAddress(result.user.walletAddress),
      },
      resolvedDeposits: result.resolvedDeposits,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
