export interface User {
  id: number;
  tgId: string;
  walletAddress: string | null;
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
