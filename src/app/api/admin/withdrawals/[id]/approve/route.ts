import { Prisma, PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { createWalletClient, http, parseAbi, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { assertAdminSession, getBearerSession } from "@/lib/auth";

const prisma = new PrismaClient();
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

export async function POST(request: Request, context: RouteContext) {
  let approvedWithdrawal: ApprovedWithdrawal | null = null;

  try {
    const session = getBearerSession(request);
    assertAdminSession(session);
    const { id } = await context.params;
    const withdrawalId = Number(id);
    if (!Number.isInteger(withdrawalId)) throw new Error("Invalid withdrawal id");

    approvedWithdrawal = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
        include: { user: true },
      });

      if (!withdrawal) throw new Error("Withdrawal not found");
      if (withdrawal.status !== "PENDING") throw new Error("Withdrawal is not pending");
      if (withdrawal.user.balanceUsdt.lt(withdrawal.amount)) throw new Error("Insufficient balance");

      await tx.user.update({
        where: { id: withdrawal.userId },
        data: {
          balanceUsdt: {
            decrement: withdrawal.amount,
          },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: withdrawal.userId,
          type: "WITHDRAW",
          amount: withdrawal.amount,
          status: "PENDING",
        },
      });

      const approved = await tx.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: "APPROVED",
          reviewedBy: session.tgId,
          reviewedAt: new Date(),
        },
      });

      return {
        id: approved.id,
        userId: approved.userId,
        transactionId: transaction.id,
        amount: approved.amount,
        walletAddress: approved.walletAddress,
      };
    });

    const txHash = await executeOnChainWithdrawal(
      approvedWithdrawal.walletAddress as `0x${string}`,
      approvedWithdrawal.amount.toString(),
    );

    const sentWithdrawal = await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: approvedWithdrawal!.transactionId },
        data: {
          txHash,
          status: "SUCCESS",
        },
      });

      return tx.withdrawalRequest.update({
        where: { id: approvedWithdrawal!.id },
        data: {
          status: "SENT",
          txHash,
        },
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
    if (approvedWithdrawal) {
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

    return NextResponse.json({ error: error instanceof Error ? error.message : "Withdrawal failed" }, { status: 400 });
  }
}
