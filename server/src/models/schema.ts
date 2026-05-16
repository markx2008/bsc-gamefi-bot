export interface User {
  id: number;
  walletAddress: string;
  balanceUsdt: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: number;
  userId: number;
  type: 'DEPOSIT' | 'WITHDRAW' | 'REWARD' | 'GAME_LOSS' | 'GAME_WIN';
  amount: string;
  txHash: string | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REJECTED';
  blockNumber?: bigint | null;
  createdAt: Date;
}

export interface PendingDeposit {
  id: number;
  walletAddress: string;
  amount: string;
  txHash: string;
  blockNumber?: bigint | null;
  status: 'PENDING' | 'RESOLVED';
  createdAt: Date;
  resolvedAt?: Date | null;
}

export interface WithdrawalRequest {
  id: number;
  userId: number;
  amount: string;
  walletAddress: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT' | 'FAILED';
  txHash?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameRound {
  id: number;
  userId: number;
  game: 'COIN_FLIP' | 'DICE' | 'LUCKY_SPIN';
  betAmount: string;
  playerChoice: string;
  outcome: string;
  result: 'PLAYER_WIN' | 'HOUSE_WIN';
  payoutAmount: string;
  userBalanceDelta: string;
  houseProfit: string;
  platformCut: string;
  gameBankrollDelta: string;
  bonusPoolCut: string;
  serverSeedHash?: string | null;
  serverSeed?: string | null;
  clientSeed?: string | null;
  nonce?: number | null;
  randomDigest?: string | null;
  createdAt: Date;
}

export interface GameFairnessCommitment {
  id: number;
  userId: number;
  serverSeed: string;
  serverSeedHash: string;
  nonce: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformLedgerEntry {
  id: number;
  pool: 'GAME_BANKROLL' | 'PLATFORM_REVENUE' | 'EARN_BONUS_POOL';
  source: 'GAME_ROUND' | 'EARN_EXTERNAL_YIELD' | 'ADMIN_ADJUSTMENT';
  sourceId?: number | null;
  gameRoundId?: number | null;
  amount: string;
  note?: string | null;
  createdAt: Date;
}
