# 《以賭養息：GameFi & DeFi Web 平台開發計畫》

本專案旨在建立一個 browser-first、以錢包登入為核心的 GameFi 平台。產品載體是 Web App，使用者透過 MetaMask 操作 BSC Testnet / BSC 主網資金流，管理員透過 Web 後台審核提現與監控對帳。

## 1. 核心機制：以賭養息 (Bet-to-Earn Equilibrium)
- **莊家優勢：** 遊戲設定 2%~5% 的長期數學優勢，試算預設為 3%，實作時需以長期期望值接近設定值為驗收標準。
- **盈餘分配：** 遊戲正利潤採三池可調模型，分配到平台收益、遊戲金庫與收益寶獎金池；目前 `/simulator` 預設為平台 **5%**、遊戲金庫 **90%**、收益寶 **5%**。
- **動態平衡：** 透過遊戲金庫承受玩家贏錢波動，收益寶以 7 天鎖倉、外部 DeFi 收益與獎金池浮動分紅控制 APY，當資金過多時利潤稀釋。
- **健康條件：** 即時 APY 達營運門檻、提款逾期為 0、遊戲金庫不透支、系統 warning count 為 0，才推薦對應平台抽成；全部不健康時不推薦抽成。
- **試算工具：** Web 前端提供 `/simulator` 純計算頁，用相同 seed 比較不同平台抽成對收益寶 APY、獎金池、遊戲金庫健康、提款延遲與平台收益的影響。

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
- [x] 撰寫 `VaultManager.sol` 合約 (USDT 儲值、提現、平台/金庫/收益寶分配接口)。
- [x] 實作後端監聽器 (Listener)，自動將鏈上儲值同步到資料庫餘額。
- [x] 整合 wallet signature login 與 wallet-first 帳號系統。

### 第 1.5 階段：真實資料串接與營運穩定 (Phase 1.5: Live Data & Ops Hardening)
- [x] 將 Admin Dashboard 財務指標改接資料庫與鏈上合約讀取，移除硬編模擬數據。
- [x] 將提現審核列表與用戶審核頁串接 `WithdrawalRequest`、`User`、`Transaction` 真實資料。
- [x] 將 listener production 啟動改為編譯後 JavaScript，降低 Zeabur runtime 記憶體用量。
- [x] 補齊 Zeabur listener 環境變數檢查文件：`VAULT_ADDRESS`、`RPC_URL`、`DATABASE_URL`、`USDT_DECIMALS`、`LISTENER_START_BLOCK`。

### 第二階段：試算基準與遊戲內部帳務 (Phase 2: Simulator-Aligned Game Ledger)
- [x] 建立 `/simulator` 純前端試算頁，支援三遊戲比例、收益寶進入比例、三池分配、提款延遲與平台抽成 sweep。
- [x] 校正試算模型：長期莊家優勢接近設定值、收益寶不透支、同 seed 可重現、全情境不健康時不推薦抽成。
- [x] 將試算模型轉成 Web 產品規格：遊戲下注使用 DB 內部餘額，不直接觸碰使用者錢包、不連外部訊息平台、不串 `/simulator` 到合約或後端寫入。
- [x] 建立第一版遊戲帳務資料模型與 API：猜硬幣與骰子已支援扣款、結算、玩家輸贏、遊戲金庫變動、平台收益、收益寶獎金池補貼與事件紀錄對帳。
- [ ] 開發三款核心遊戲 Web 介面與結算邏輯：
    - [x] **猜硬幣 (Coin Flip):** 低波動，使用內部餘額立即結算，正利潤進三池 ledger。
    - [x] **骰子比大小 (Dice):** 中波動，使用同一套內部餘額與金庫結算。
    - [ ] **幸運轉盤 (Lucky Spin):** 高波動，下注上限需受遊戲金庫健康限制。
- [ ] 實作公平性驗證：Server Seed + Client Seed + Nonce，並保留每局可驗證紀錄；大額或合約化階段再評估 Chainlink VRF。
- [ ] 實作遊戲風控：下注上下限、連點防護、金庫透支防護、異步結算重試與重複請求冪等。

### 第三階段：收益寶與健康監控 (Phase 3: Earn Vault & Health Controls)
- [ ] 實作 7 天收益寶鎖倉資料流：加入收益寶時鎖定本金，到期後本金與已累積分紅回到非鎖倉可提款餘額。
- [ ] 實作收益來源：收益寶鎖倉本金可配置到外部 DeFi、借貸或收益策略，外部收益收入、遊戲正利潤補貼、初始補貼與獎金池餘額需分開記錄並可追蹤。
- [ ] 實作浮動分紅與 APY cap：每期分紅不得超過單期收益上限，未分配資金留在收益寶獎金池。
- [ ] 實作提款延遲模型：提款申請先進待處理提款，審核延遲後由平台流動性支付；流動性不足時記錄逾期未付提款。
- [ ] 開發動態 APY 與營運健康面板：即時 APY、實現 APY、遊戲金庫、平台收益、獎金池、待處理提款與逾期提款需與 `/simulator` 指標一致。
- [ ] 實作抽成建議規則：只有健康情境才推薦平台收益最高抽成；沒有健康情境時顯示無合格方案。

### 第四階段：Testnet 驗證與上線準備 (Phase 4: Testnet Validation & Launch Readiness)
- [ ] 完成 BSC Testnet 真入金端到端驗證：MetaMask 登入、MockUSDT approve、VaultManager deposit、listener 入帳、提現申請與 Admin 審核。
- [ ] 以 `/simulator` 的健康條件建立營運驗收腳本：長期莊家優勢、收益寶 APY cap、提款逾期、金庫透支與平台收益分配都需可驗證。
- [ ] Web UI 響應式優化、錢包錯誤處理、交易狀態追蹤與 Admin 對帳流程補齊。
- [ ] 壓力測試與安全審計：內部帳務冪等、提款審核、金庫透支防護、隨機公平性與合約權限需列入測試。
- [ ] 部署至 BSC 主網並開啟營運。

## 4. 遊戲視覺風格
- **目標：** 極簡數據感 (Minimalist & Data-driven UI)。
- **參考：** Stake.com 風格。
- **重點：** 加載速度快、反饋即時、操作直接。

---
*Last Updated: 2026-05-16*
