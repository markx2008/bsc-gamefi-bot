import { createPublicClient, http, parseAbiItem } from 'viem';
import { bscTestnet } from 'viem/chains';
import * as dotenv from 'dotenv';

dotenv.config();

const VAULT_ADDRESS = process.env.VAULT_ADDRESS as `0x${string}`;
const RPC_URL = process.env.RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(RPC_URL),
});

/**
 * @dev 監聽 Deposit 事件
 */
async function watchDeposits() {
  console.log(`🚀 開始監聽儲值事件於合約: ${VAULT_ADDRESS}`);

  publicClient.watchEvent({
    address: VAULT_ADDRESS,
    event: parseAbiItem('event Deposit(address indexed user, uint256 amount, uint256 timestamp)'),
    onLogs: (logs) => {
      logs.forEach((log) => {
        const { user, amount, timestamp } = log.args;
        console.log(`💎 偵測到新儲值！`);
        console.log(`👤 用戶: ${user}`);
        console.log(`💰 金額: ${Number(amount) / 1e18} USDT`);
        console.log(`⏰ 時間: ${new Date(Number(timestamp) * 1000).toLocaleString()}`);
        
        // TODO: 這裡接下來要串接資料庫，更新該用戶餘額
        updateUserBalance(user, amount);
      });
    },
  });
}

async function updateUserBalance(user: any, amount: any) {
    // 實作資料庫入帳邏輯
    console.log(`[DB] 正在為用戶 ${user} 更新餘額 +${Number(amount) / 1e18}...`);
}

watchDeposits().catch(console.error);
