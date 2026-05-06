import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * @dev 獲取用戶完整的盈虧明細
 */
export async function getUserRiskProfile(userId: number) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
  });

  let totalDeposit = 0;
  let totalWithdraw = 0;
  let gameProfit = 0;
  let stakingReward = 0;

  transactions.forEach(tx => {
    const amount = Number(tx.amount);
    if (tx.status !== 'SUCCESS' && tx.status !== 'PENDING') return;

    switch (tx.type) {
      case 'DEPOSIT':
        totalDeposit += amount;
        break;
      case 'WITHDRAW':
        totalWithdraw += amount;
        break;
      case 'GAME_WIN':
        gameProfit += amount;
        break;
      case 'GAME_LOSS':
        gameProfit -= amount;
        break;
      case 'REWARD':
        stakingReward += amount;
        break;
    }
  });

  const currentBalance = totalDeposit + gameProfit + stakingReward - totalWithdraw;

  return {
    totalDeposit,
    totalWithdraw,
    gameProfit,
    stakingReward,
    currentBalance,
    riskLevel: gameProfit > (totalDeposit * 2) ? 'HIGH' : 'NORMAL' // 如果遊戲賺超過本金兩倍，標記高風險
  };
}
