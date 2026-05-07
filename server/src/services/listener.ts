import { createPublicClient, formatUnits, http, parseAbiItem } from 'viem';
import { bscTestnet } from 'viem/chains';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { ensureDatabaseUrl } from '../../../src/lib/databaseUrl';

dotenv.config();

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Set ${name} in Zeabur service environment variables.`);
  }
  return value;
}

ensureDatabaseUrl();
const VAULT_ADDRESS = requireEnv('VAULT_ADDRESS') as `0x${string}`;
const prisma = new PrismaClient();
const RPC_URL = process.env.RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';
const TOKEN_DECIMALS = Number(process.env.USDT_DECIMALS || 18);
const CHECKPOINT_ID = 'vault-deposit-listener';
const DEPOSIT_EVENT = parseAbiItem('event Deposit(address indexed user, uint256 amount, uint256 timestamp)');
const BLOCK_CHUNK_SIZE = BigInt(process.env.LISTENER_BLOCK_CHUNK_SIZE || 2000);

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(RPC_URL),
});

export function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.toLowerCase();
}

export function tokenAmountToDecimalString(amount: bigint, decimals = TOKEN_DECIMALS) {
  return formatUnits(amount, decimals);
}

async function getLastProcessedBlock() {
  const checkpoint = await prisma.chainCheckpoint.findUnique({
    where: { id: CHECKPOINT_ID },
  });

  if (checkpoint) return BigInt(checkpoint.blockNumber.toString());

  if (process.env.LISTENER_START_BLOCK) {
    return BigInt(process.env.LISTENER_START_BLOCK) - 1n;
  }

  const currentBlock = await publicClient.getBlockNumber();
  await saveLastProcessedBlock(currentBlock);
  return currentBlock;
}

async function saveLastProcessedBlock(blockNumber: bigint) {
  await prisma.chainCheckpoint.upsert({
    where: { id: CHECKPOINT_ID },
    create: { id: CHECKPOINT_ID, blockNumber },
    update: { blockNumber },
  });
}

/**
 * @dev 啟動儲值監聽器，先補掃遺漏區塊再監聽新事件。
 */
async function watchDeposits() {
  console.log(`🚀 [LISTENER] 啟動成功，監控合約: ${VAULT_ADDRESS}`);
  await backfillDeposits();

  publicClient.watchEvent({
    address: VAULT_ADDRESS,
    event: DEPOSIT_EVENT,
    onLogs: async (logs) => {
      for (const log of logs) {
        const { user, amount } = log.args;
        const txHash = log.transactionHash;
        const blockNumber = log.blockNumber;

        if (!user || !amount || !txHash) continue;

        console.log(`💎 [DEPOSIT] 偵測到鏈上事件: ${txHash}`);
        await handleDeposit(user as string, amount as bigint, txHash, blockNumber);
        if (blockNumber) await saveLastProcessedBlock(blockNumber);
      }
    },
    onError: (error) => {
      console.error('❌ [LISTENER] 監聽事件失敗:', error);
    },
  });
}

async function backfillDeposits() {
  if (!VAULT_ADDRESS) return;

  const latestBlock = await publicClient.getBlockNumber();
  let fromBlock = (await getLastProcessedBlock()) + 1n;

  if (fromBlock > latestBlock) return;

  console.log(`🔁 [BACKFILL] 補掃區塊 ${fromBlock.toString()} -> ${latestBlock.toString()}`);

  while (fromBlock <= latestBlock) {
    const toBlock = fromBlock + BLOCK_CHUNK_SIZE - 1n > latestBlock ? latestBlock : fromBlock + BLOCK_CHUNK_SIZE - 1n;
    const logs = await publicClient.getLogs({
      address: VAULT_ADDRESS,
      event: DEPOSIT_EVENT,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      const { user, amount } = log.args;
      if (!user || !amount || !log.transactionHash) continue;
      await handleDeposit(user as string, amount as bigint, log.transactionHash, log.blockNumber);
    }

    await saveLastProcessedBlock(toBlock);
    fromBlock = toBlock + 1n;
  }
}

/**
 * @dev 處理儲值入帳邏輯 (原子化操作)
 */
export async function handleDeposit(walletAddress: string, amount: bigint, txHash: string, blockNumber?: bigint) {
  const normalizedWallet = normalizeWalletAddress(walletAddress);
  const amountUsdt = tokenAmountToDecimalString(amount);

  try {
    const existingTx = await prisma.transaction.findUnique({
      where: { txHash },
    });

    if (existingTx) {
      console.log(`⚠️ [SKIP] 交易 ${txHash} 已處理過，跳過。`);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: normalizedWallet },
    });

    if (!user) {
      await prisma.pendingDeposit.upsert({
        where: { txHash },
        create: {
          walletAddress: normalizedWallet,
          amount: amountUsdt,
          txHash,
          blockNumber,
          status: 'PENDING',
        },
        update: {
          walletAddress: normalizedWallet,
          amount: amountUsdt,
          blockNumber,
        },
      });
      console.log(`⚠️ [PENDING] 找不到綁定地址 ${normalizedWallet}，已建立待分配入金。`);
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'DEPOSIT',
          amount: amountUsdt,
          txHash,
          status: 'SUCCESS',
          blockNumber,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          balanceUsdt: {
            increment: amountUsdt,
          },
        },
      });
    });

    console.log(`✅ [SUCCESS] 用戶 ${user.tgId} 儲值入帳成功: +${amountUsdt} USDT`);
  } catch (error) {
    console.error(`🔥 [CRITICAL] 處理儲值失敗: ${txHash}`, error);
  }
}

watchDeposits().catch(console.error);
