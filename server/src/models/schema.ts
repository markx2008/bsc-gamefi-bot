export interface User {
    id: number;
    tg_id: string;
    wallet_address: string;
    balance_usdt: bigint; // 使用 bigint 處理 18 位精度
    created_at: Date;
}

export interface Transaction {
    id: number;
    user_id: number;
    type: 'DEPOSIT' | 'WITHDRAW' | 'REWARD';
    amount: bigint;
    tx_hash: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REJECTED';
    created_at: Date;
}
