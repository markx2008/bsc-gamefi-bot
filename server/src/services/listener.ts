import { createPublicClient, http, parseAbiItem } from 'viem';
import { bscTestnet } from 'viem/chains';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const VAULT_ADDRESS = process.env.VAULT_ADDRESS as `0x${string}`;
const RPC_URL = process.env.RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(RPC_URL),
});

/**
 * @dev 啟動儲值監聽器
 */
async function watchDeposits() {
  console.log(`🚀 [LISTENER] 啟動成功，監控合約: ${VAULT_ADDRESS}`);

  publicClient.watchEvent({
    address: VAULT_ADDRESS,
    event: parseAbiItem('event Deposit(address indexed user, uint256 amount, uint256 timestamp)'),
    onLogs: async (logs) => {
      for (const log of logs) {
        const { user, amount, timestamp } = log.args;
        const txHash = log.transactionHash;

        if (!user || !amount || !txHash) continue;

        console.log(`💎 [DEPOSIT] 偵測到鏈上事件: ${txHash}`);
        await handleDeposit(user as string, amount as bigint, txHash);
      }
    },
  });
}

/**
 * @dev 處理儲值入帳邏輯 (原子化操作)
 */
async function handleDeposit(walletAddress: string, amount: bigint, txHash: string) {
  try {
    // 1. 檢查該交易是否已處理過
    const existingTx = await prisma.transaction.findUnique({
      where: { txHash }
    });

    if (existingTx) {
      console.log(`⚠️ [SKIP] 交易 ${txHash} 已處理過，跳過。`);
      return;
    }

    // 2. 尋找對應的用戶
    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() }
    });

    if (!user) {
      console.log(`❌ [ERROR] 找不到綁定地址為 ${walletAddress} 的用戶，無法入帳。`);
      // 這裡可以考慮存入一個 "待分配" 表，等用戶未來綁定後再入帳
      return;
    }

    // 3. 執行資料庫事務：建立交易紀錄並增加餘額
    await prisma.$transaction(async (tx) => {
      // 建立交易紀錄
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'DEPOSIT',
          amount: Number(amount) / 1e18, // 轉為人類可讀的 Decimal
          txHash: txHash,
          status: 'SUCCESS'
        }
      });

      // 更新用戶餘額
      await tx.user.update({
        where: { id: user.id },
        data: {
          balanceUsdt: {
            increment: Number(amount) / 1e18
          }
        }
      });
    });

    console.log(`✅ [SUCCESS] 用戶 ${user.tgId} 儲值入帳成功: +${Number(amount) / 1e18} USDT`);
  } catch (error) {
    console.error(`🔥 [CRITICAL] 處理儲值失敗: ${txHash}`, error);
  }
}

watchDeposits().catch(console.error);
