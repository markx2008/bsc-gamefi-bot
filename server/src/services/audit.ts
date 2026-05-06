import { PrismaClient } from '@prisma/client';
import { createPublicClient, http } from 'viem';
import { bscTestnet } from 'viem/chains';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const VAULT_ADDRESS = process.env.VAULT_ADDRESS as `0x${string}`;
const USDT_ADDRESS = process.env.USDT_ADDRESS as `0x${string}`;

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(process.env.RPC_URL),
});

const USDT_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
];

/**
 * @dev 執行系統對帳 (每小時一次)
 */
export async function performSystemAudit() {
  console.log('🔍 [AUDIT] 啟動系統財務審計...');

  try {
    // 1. 計算資料庫中所有用戶的可用餘額總和 (系統負債)
    const result = await prisma.user.aggregate({
      _sum: {
        balanceUsdt: true,
      },
    });
    const totalUserDebt = result._sum.balanceUsdt || 0;

    // 2. 查詢鏈上金庫合約的實際 USDT 餘額 (系統資產)
    const onChainBalance = await publicClient.readContract({
      address: USDT_ADDRESS,
      abi: USDT_ABI,
      functionName: 'balanceOf',
      args: [VAULT_ADDRESS],
    }) as bigint;
    const realAsset = Number(onChainBalance) / 1e18;

    // 3. 比對數據
    const difference = realAsset - Number(totalUserDebt);

    console.log(`📊 [AUDIT] 報表:`);
    console.log(`- 系統負債 (用戶總額): ${totalUserDebt} USDT`);
    console.log(`- 系統資產 (鏈上餘額): ${realAsset} USDT`);
    console.log(`- 資金冗餘 (Buffer): ${difference.toFixed(4)} USDT`);

    if (difference < 0) {
      console.error(`🔥 [ALARM] 警報！資金缺口偵測到: ${Math.abs(difference)} USDT!`);
      // 這裡未來可以串接 Telegram Bot API 發送訊息
      await notifyAdmin(`🚨 財務警告：鏈上資金缺口 ${Math.abs(difference)} USDT! 請立即檢查！`);
    } else {
      console.log('✅ [AUDIT] 財務對帳通過，數據一致。');
    }

  } catch (error) {
    console.error('❌ [AUDIT] 審計過程中發生錯誤:', error);
  }
}

async function notifyAdmin(message: string) {
    console.log(`[TELEGRAM NOTIFY] Admin: ${message}`);
}
