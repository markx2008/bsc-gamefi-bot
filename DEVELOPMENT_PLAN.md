# 《以賭養息：GameFi & DeFi Web 平台開發計畫》

本專案旨在建立一個 browser-first、以錢包登入為核心的 GameFi 平台。產品載體是 Web App，使用者透過 MetaMask 操作 BSC Testnet / BSC 主網資金流，管理員透過 Web 後台審核提現與監控對帳。

## 1. 核心機制：以賭養息 (Bet-to-Earn Equilibrium)
- **莊家優勢：** 遊戲設定 2%~5% 的固定數學優勢。
- **盈餘分配：** 遊戲純利的 **90%** 進入收益寶獎金池，**10%** 作為平台營運利潤。
- **動態平衡：** 透過 7 天鎖倉與浮動 APY，當投資者過多時利潤稀釋，促使資金流向遊戲區，達成系統循環。
- **試算工具：** Web 前端提供 `/simulator` 純計算頁，用相同 seed 比較 10%、20% 等平台抽成對收益寶 APY、獎金池與平台收益的影響。

## 2. 技術棧 (Tech Stack)
- **區塊鏈層 (Blockchain):** BSC (Solidity, OpenZeppelin)
- **隨機數公平性 (Fairness):**
    - 儲值模式：Server Seed + Client Seed + Nonce (Provably Fair)
    - 關鍵操作：Chainlink VRF (選配，用於大額結算)
- **後端引擎 (Backend):** Next.js API Routes + Node.js listener，後續可拆分為獨立服務。
- **數據緩衝 (Cache):** Redis (後續處理秒級下注扣款)
- **前端框架 (Frontend):** Next.js (TypeScript) + Tailwind CSS
- **管理後台:** Admin Web Dashboard，以管理員錢包地址驗證權限。
- **平台載體 (Platform):** Web App
- **錢包連結 (Web3):** MetaMask browser provider + Viem，後續可加 RainbowKit + Wagmi。

## 3. 分階段開發計畫

### 第一階段：資金基礎設施 (Phase 1: Financial Infrastructure)
- [x] 撰寫 `VaultManager.sol` 合約 (USDT 儲值、提現、90/10 分紅接口)。
- [x] 實作後端監聽器 (Listener)，自動將鏈上儲值同步到資料庫餘額。
- [x] 整合 wallet signature login 與 wallet-first 帳號系統。

### 第 1.5 階段：真實資料串接與營運穩定 (Phase 1.5: Live Data & Ops Hardening)
- [x] 將 Admin Dashboard 財務指標改接資料庫與鏈上合約讀取，移除硬編模擬數據。
- [x] 將提現審核列表與用戶審核頁串接 `WithdrawalRequest`、`User`、`Transaction` 真實資料。
- [x] 將 listener production 啟動改為編譯後 JavaScript，降低 Zeabur runtime 記憶體用量。
- [x] 補齊 Zeabur listener 環境變數檢查文件：`VAULT_ADDRESS`、`RPC_URL`、`DATABASE_URL`、`USDT_DECIMALS`、`LISTENER_START_BLOCK`。

### 第二階段：極簡遊戲模組 (Phase 2: Minimalist Games)
- [x] 建立三遊戲與收益寶池子前端試算頁，支援遊戲/收益寶比例與平台抽成 sweep。
- [ ] 實作「公平性驗證演算法」。
- [ ] 開發三款核心遊戲：
    - **猜硬幣 (Coin Flip)**
    - **骰子比大小 (Dice)**
    - **幸運轉盤 (Lucky Spin)**
- [ ] 實作連點防護與異步扣款機制。

### 第三階段：收益寶 DeFi 模組 (Phase 3: Staking & APY)
- [ ] 實作 `StakingVault.sol` 7 天鎖倉合約。
- [ ] 開發動態 APY 顯示組件。
- [ ] 實作每週自動獎金結算與發放邏輯。

### 第四階段：Web 上線與主網部署 (Phase 4: Web Production & Mainnet)
- [ ] Web UI 響應式優化、錢包錯誤處理與交易狀態追蹤。
- [ ] 壓力測試與安全審計。
- [ ] 部署至 BSC 主網並開啟營運。

## 4. 遊戲視覺風格
- **目標：** 極簡數據感 (Minimalist & Data-driven UI)。
- **參考：** Stake.com 風格。
- **重點：** 加載速度快、反饋即時、操作直接。

---
*Last Updated: 2026-05-15*
