# 設計規格書：Web 資金基礎設施與對帳系統

- **日期:** 2026-05-05
- **更新:** 2026-05-15
- **主題:** 實現 web-only 的半託管 USDT 儲值、提現與後端對帳平衡系統。
- **狀態:** 方向已調整為 wallet-first Web App

## 1. 業務需求 (Business Requirements)
- **登入:** 使用者以 MetaMask 簽署登入訊息，後端驗簽後用 wallet address 建立 session。
- **儲值:** 使用者登入後往全局金庫 (Vault) 轉帳，後端自動入帳。
- **提現:** 使用者申請提現，管理員手動審核後，後端熱錢包發起鏈上轉帳。
- **分紅:** 每日 00:00 自動將遊戲盈餘進行兩方分配：
    - 90% 撥入 `StakingVault` (收益寶)。
    - 10% 撥入 `PlatformTreasury` (平台國庫，用於營運與利潤)。
- **對帳:** 系統必須具備自我審計能力，確保每一分錢的流向都可追蹤且數據一致。

## 2. 系統架構 (System Architecture)

### 2.1 儲值監聽流程 (Deposit Listener)
1. **監控器:** Node.js 服務使用 `viem` 監聽 BSC 鏈上 `VaultManager.sol` 的 `Deposit` 事件。
2. **校驗:**
    - 檢查 `from` 是否為已登入建立過的 wallet address。
    - 檢查 `tx_hash` 是否已存在資料庫（防止重複入帳）。
    - 等待指定區塊確認後，更新使用者餘額。
3. **待處理入金:** 如果鏈上入金先於登入發生，listener 先建立 `PendingDeposit`，使用者錢包登入後再自動解析。

### 2.2 管理員與營運 UI (Admin & Ops Dashboard)
1. **角色分權:**
    - **Admin:** 由 `ADMIN_WALLET_ADDRESS` 指定，可審核提現、調整分紅參數、監控全站。
    - **Ops:** 後續可由資料庫角色擴充。
2. **安全性:** 透過 wallet signature session 驗證錢包地址與角色權限。

### 2.3 對帳平衡邏輯 (Reconciliation Logic)
系統每 1 小時執行一次 `AuditSync`：
- **公式:** `Current_Total_Liabilities (用戶總餘額) == Total_Deposits - Total_Withdrawals - Total_Net_Game_Profit`
- **操作:**
    - 若公式不成立，立即發送營運告警並進入「唯讀模式」。
    - 每日生成對帳報告存入日誌。

## 3. 資料庫表定義 (Key Schema)

### Users Table
- `id`: Primary Key
- `wallet_address`: 使用者錢包地址，唯一識別
- `usdt_balance`: 平台內可用餘額 (Decimal 18)
- `created_at`: 註冊時間

### Transactions Table
- `id`: Primary Key
- `user_id`: 關聯 User
- `type`: DEPOSIT / WITHDRAW / REWARD
- `amount`: 金額
- `tx_hash`: 鏈上交易哈希
- `status`: PENDING / SUCCESS / FAILED / REJECTED

## 4. 安全約束 (Security Constraints)
- **冷熱錢包分離:** `VaultManager.sol` 合約中僅存放少量用於自動賠付/提現的資金，其餘資金定期歸集到冷錢包。
- **簽名校驗:** 登入與管理員操作都必須以錢包 session 驗證。
- **管理權限:** Admin API 只接受 `ADMIN_WALLET_ADDRESS` 對應 session。
