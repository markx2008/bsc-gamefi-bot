# 設計規格書：資金基礎設施與對帳系統 (Vault & Audit System)

- **日期:** 2026-05-05
- **主題:** 實現基於 Telegram Mini App 的半託管 USDT 儲值、提現與後端對帳平衡系統。
- **狀態:** 已獲用戶批准

## 1. 業務需求 (Business Requirements)
- **儲值:** 用戶綁定錢包後，往全局金庫 (Vault) 轉帳，後端自動入帳。
- **提現:** 用戶申請提現，管理員手動審核後，後端熱錢包發起鏈上轉帳。
- **分紅:** 每日 00:00 自動將遊戲盈餘進行兩方分配：
    - 90% 撥入 `StakingVault` (收益寶)。
    - 10% 撥入 `PlatformTreasury` (平台國庫，用於運營與利潤)。
- **對帳:** 系統必須具備自我審計能力，確保每一分錢的流向都可追蹤且數據一致。

## 2. 系統架構 (System Architecture)

### 2.1 儲值監聽流程 (Deposit Listener)
1.  **監控器:** Node.js 服務使用 `viem` 或 `ethers.js` 監聽 BSC 鏈上 `Vault.sol` 的 `Received` 事件。
2.  **校驗:** 
    - 檢查 `from` 是否為已綁定用戶。
    - 檢查 `tx_hash` 是否已存在資料庫（防止重複入帳）。
    - 等待 12 個區塊確認後，更新用戶餘額。

### 2.2 管理員與運營 UI (Admin & Ops Dashboard)
1.  **角色分權:**
    - **Admin (您):** 審核用戶提現、調整分紅參數、全站監控。
    - **Ops (運營人員):** 查看個人獎金餘額、點擊「Claim」提現獎金。
2.  **安全性:** 透過 `SIWE (Sign-In with Ethereum)` 驗證錢包地址與角色權限。

### 2.3 對帳平衡邏輯 (Reconciliation Logic)
系統每 1 小時執行一次 `AuditSync`：
- **公式:** `Current_Total_Liabilities (用戶總餘額) == Total_Deposits - Total_Withdrawals - Total_Net_Game_Profit`
- **操作:** 
    - 若公式不成立，立即發送 Telegram 警報給管理員並進入「唯讀模式」。
    - 每日生成對帳報告存入日誌。

## 3. 資料庫表定義 (Key Schema)

### Users Table
- `id`: Primary Key
- `tg_id`: Telegram 唯一標識
- `wallet_address`: 綁定的錢包地址
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
- **冷熱錢包分離:** `Vault.sol` 合約中僅存放少量用於自動賠付/提現的資金，其餘資金定期歸集到冷錢包。
- **簽名校驗:** 所有提現操作必須具備後端服務器的私鑰簽名驗證。

---
*這份設計文件已通過 Brainstorming 階段，準備進入 Implementation Planning。*
