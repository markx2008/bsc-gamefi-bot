import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseAbi, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { assertAdminSession, getBearerSession } from "@/lib/auth";

const VAULT_ABI = parseAbi(["function executeWithdrawal(address user, uint256 amount) external"]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ApprovedWithdrawal = {
  id: number;
  userId: number;
  transactionId: number;
  amount: Prisma.Decimal;
  walletAddress: string;
  txHash?: `0x${string}`;
};

async function executeOnChainWithdrawal(walletAddress: `0x${string}`, amount: string) {
  const privateKey = process.env.ADMIN_PRIVATE_KEY as `0x${string}` | undefined;
  const vaultAddress = process.env.VAULT_ADDRESS as `0x${string}` | undefined;
  if (!privateKey) throw new Error("ADMIN_PRIVATE_KEY is required");
  if (!vaultAddress) throw new Error("VAULT_ADDRESS is required");

  const decimals = Number(process.env.USDT_DECIMALS || 18);
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: bscTestnet,
    transport: http(process.env.RPC_URL),
  });

  return walletClient.writeContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "executeWithdrawal",
    args: [walletAddress, parseUnits(amount, decimals)],
  });
}

async function waitForOnChainWithdrawal(txHash: `0x${string}`) {
  const publicClient = createPublicClient({
    chain: bscTestnet,
    transport: http(process.env.RPC_URL),
  });

  return publicClient.waitForTransactionReceipt({ hash: txHash });
}

export async function POST(request: Request, context: RouteContext) {
  const prisma = getPrisma();
  let approvedWithdrawal: ApprovedWithdrawal | null = null;

  try {
    const session = getBearerSession(request);
    assertAdminSession(session);
    const { id } = await context.params;
    const withdrawalId = Number(id);
    if (!Number.isInteger(withdrawalId)) throw new Error("Invalid withdrawal id");

    approvedWithdrawal = await prisma.$transaction(async (tx) => {
      const claimedWithdrawal = await tx.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
      });

      if (!claimedWithdrawal) throw new Error("Withdrawal not found");
      if (claimedWithdrawal.status !== "PENDING") throw new Error("Withdrawal is not pending");

      const claim = await tx.withdrawalRequest.updateMany({
        where: { id: withdrawalId, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedBy: session.tgId,
          reviewedAt: new Date(),
        },
      });
      if (claim.count !== 1) throw new Error("Withdrawal is not pending");

      const debit = await tx.user.updateMany({
        where: {
          id: claimedWithdrawal.userId,
          balanceUsdt: { gte: claimedWithdrawal.amount },
        },
        data: {
          balanceUsdt: {
            decrement: claimedWithdrawal.amount,
          },
        },
      });
      if (debit.count !== 1) throw new Error("Insufficient balance");

      const transaction = await tx.transaction.create({
        data: {
          userId: claimedWithdrawal.userId,
          type: "WITHDRAW",
          amount: claimedWithdrawal.amount,
          status: "PENDING",
        },
      });

      return {
        id: claimedWithdrawal.id,
        userId: claimedWithdrawal.userId,
        transactionId: transaction.id,
        amount: claimedWithdrawal.amount,
        walletAddress: claimedWithdrawal.walletAddress,
      };
    });

    const txHash = await executeOnChainWithdrawal(
      approvedWithdrawal.walletAddress as `0x${string}`,
      approvedWithdrawal.amount.toString(),
    );
    approvedWithdrawal.txHash = txHash;

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: approvedWithdrawal!.transactionId },
        data: {
          txHash,
          status: "PENDING",
        },
      });

      await tx.withdrawalRequest.update({
        where: { id: approvedWithdrawal!.id },
        data: {
          txHash,
        },
      });
    });

    let receipt;
    try {
      receipt = await waitForOnChainWithdrawal(txHash);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Withdrawal broadcast but receipt is not confirmed",
          withdrawal: {
            id: approvedWithdrawal.id,
            status: "APPROVED",
            txHash,
          },
        },
        { status: 202 },
      );
    }

    if (receipt.status !== "success") {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: approvedWithdrawal!.userId },
          data: {
            balanceUsdt: {
              increment: approvedWithdrawal!.amount,
            },
          },
        });
        await tx.transaction.update({
          where: { id: approvedWithdrawal!.transactionId },
          data: { status: "FAILED" },
        });
        await tx.withdrawalRequest.update({
          where: { id: approvedWithdrawal!.id },
          data: { status: "FAILED" },
        });
      });

      return NextResponse.json(
        {
          error: "On-chain withdrawal reverted",
          withdrawal: {
            id: approvedWithdrawal.id,
            status: "FAILED",
            txHash,
          },
        },
        { status: 400 },
      );
    }

    const sentWithdrawal = await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: approvedWithdrawal!.transactionId },
        data: { status: "SUCCESS" },
      });

      return tx.withdrawalRequest.update({
        where: { id: approvedWithdrawal!.id },
        data: { status: "SENT" },
      });
    });

    return NextResponse.json({
      withdrawal: {
        id: sentWithdrawal.id,
        status: sentWithdrawal.status,
        txHash: sentWithdrawal.txHash,
      },
    });
  } catch (error) {
    if (approvedWithdrawal && !approvedWithdrawal.txHash) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: approvedWithdrawal!.userId },
          data: {
            balanceUsdt: {
              increment: approvedWithdrawal!.amount,
            },
          },
        });
        await tx.transaction.update({
          where: { id: approvedWithdrawal!.transactionId },
          data: { status: "FAILED" },
        });
        await tx.withdrawalRequest.update({
          where: { id: approvedWithdrawal!.id },
          data: { status: "FAILED" },
        });
      });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Withdrawal failed",
        txHash: approvedWithdrawal?.txHash,
      },
      { status: approvedWithdrawal?.txHash ? 202 : 400 },
    );
  }
}
