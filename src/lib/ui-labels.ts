const transactionTypeLabels: Record<string, string> = {
  DEPOSIT: "入金",
  WITHDRAW: "提現",
  GAME_WIN: "遊戲獲利",
  GAME_LOSS: "遊戲虧損",
  REWARD: "獎勵",
};

const statusLabels: Record<string, string> = {
  PENDING: "待處理",
  SUCCESS: "成功",
  FAILED: "失敗",
  APPROVED: "已核准",
  REJECTED: "已拒絕",
  SENT: "已送出",
};

const riskLabels: Record<string, string> = {
  HIGH: "高風險",
  NORMAL: "一般",
};

const errorLabels: Record<string, string> = {
  "Admin privileges required": "目前錢包沒有管理員權限。",
  "ADMIN_PRIVATE_KEY is required": "伺服器尚未設定 ADMIN_PRIVATE_KEY。",
  "ADMIN_WALLET_ADDRESS is required": "伺服器尚未設定 ADMIN_WALLET_ADDRESS。",
  "Amount must be > 0": "金額必須大於 0。",
  "Bad request": "請求格式不正確。",
  "Bet amount must be > 0": "下注金額必須大於 0。",
  "Game bankroll is insufficient": "遊戲金庫不足，暫停派彩風險過高的下注。",
  "Insufficient available balance": "可用餘額不足。",
  "Insufficient balance": "餘額不足。",
  "Invalid coin flip choice": "猜硬幣選項不正確。",
  "Invalid dice choice": "骰子選項不正確。",
  "Invalid session signature": "登入簽章無效，請重新登入。",
  "Invalid session token": "登入狀態無效，請重新登入。",
  "Invalid user id": "使用者編號不正確。",
  "Invalid wallet address": "錢包地址格式不正確。",
  "Invalid wallet signature": "錢包簽章驗證失敗。",
  "Invalid withdrawal id": "提現申請編號不正確。",
  "JWT_SECRET is required": "伺服器尚未設定 JWT_SECRET。",
  "On-chain withdrawal reverted": "鏈上提現交易已回滾。",
  "Session expired": "登入已過期，請重新登入。",
  "Unauthorized": "未授權，請重新登入。",
  "User not found": "找不到使用者。",
  "VAULT_ADDRESS is required": "伺服器尚未設定 VAULT_ADDRESS。",
  "Withdrawal broadcast but receipt is not confirmed": "提現交易已廣播，但尚未確認收據。",
  "Withdrawal failed": "提現失敗。",
  "Withdrawal is not pending": "提現申請不是待審狀態。",
  "Withdrawal not found": "找不到提現申請。",
  "walletAddress and signature are required": "缺少錢包地址或簽章。",
};

export function transactionTypeLabel(value: string) {
  return transactionTypeLabels[value] || value;
}

export function statusLabel(value: string) {
  return statusLabels[value] || value;
}

export function riskLabel(value: string | null | undefined) {
  if (!value) return "-";
  return riskLabels[value] || value;
}

export function translateUiError(value: string) {
  return errorLabels[value] || value;
}
