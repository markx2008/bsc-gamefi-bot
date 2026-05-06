import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  normalizeWalletAddress,
  verifySessionToken,
  verifyWalletBindingSignature,
} from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
    const session = verifySessionToken(token, process.env.JWT_SECRET || "");
    const { walletAddress, signature, message } = await request.json();

    if (!walletAddress || !signature) {
      return NextResponse.json({ error: "walletAddress and signature are required" }, { status: 400 });
    }

    const normalizedWallet = normalizeWalletAddress(walletAddress) as `0x${string}`;
    const signatureHex = signature as `0x${string}`;
    const isValid = await verifyWalletBindingSignature({
      tgId: session.tgId,
      walletAddress: normalizedWallet,
      signature: signatureHex,
      message,
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
