# Web 資金基礎設施 (Vault Infrastructure) 實作計畫

> Historical implementation notes. Current project direction is web-only and wallet-first.

**Goal:** 建立一個安全的半託管 USDT 儲值與提現系統，包含鏈上合約、後端帳號管理與對帳機制。

**Architecture:** 使用 Node.js (Viem) 監聽鏈上合約事件，將餘額同步至 PostgreSQL 資料庫。使用者以 wallet signature 登入，提現需管理員錢包 session 審核。

**Tech Stack:** Solidity, Hardhat, Next.js, Node.js, Viem, PostgreSQL.

---

### 已完成重點

- `VaultManager.sol` 支援 USDT 儲值與提現執行。
- listener 監聽 `Deposit` event，依 wallet address 對帳入帳。
- Web MVP 提供 wallet login、資金流驗證頁、Admin Dashboard。
- Admin API 以 `ADMIN_WALLET_ADDRESS` 判斷管理員權限。

### 後續任務

- [ ] 強化 wallet login message 的 nonce 與過期時間。
- [ ] 補齊端到端測試：登入、入金、listener 入帳、提現審核。
- [ ] 將營運告警接到正式通知渠道。
- [ ] 在 BSC Testnet 完成真入金端到端驗證。
