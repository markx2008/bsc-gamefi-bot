# 《以賭養息：GameFi & DeFi 平台開發計畫》

本專案旨在建立一個基於 Telegram Mini App 的高度流暢、公平且具備自我平衡機制的 GameFi 平台。

## 1. 核心機制：以賭養息 (Bet-to-Earn Equilibrium)
- **莊家優勢：** 遊戲設定 2%~5% 的固定數學優勢。
- **盈餘分配：** 遊戲純利的 **80%** 進入收益寶獎金池，**20%** 作為平台營運利潤。
- **動態平衡：** 透過 7 天鎖倉與浮動 APY，當投資者過多時利潤稀釋，促使資金流向遊戲區，達成系統循環。

## 2. 技術棧 (Tech Stack)
- **區塊鏈層 (Blockchain):** BSC (Solidity, OpenZeppelin)
- **隨機數公平性 (Fairness):** 
    - 儲值模式：Server Seed + Client Seed + Nonce (Provably Fair)
    - 關鍵操作：Chainlink VRF (選配，用於大額結算)
- **後端引擎 (Backend):** Node.js (高速處理遊戲扣款與分紅)
- **數據緩衝 (Cache):** Redis (處理秒級下注扣款)
- **前端框架 (Frontend):** Next.js + Tailwind CSS (極簡數據風格)
- **平台載體 (Platform):** Telegram Mini App (TMA)
- **錢包連結 (Web3):** RainbowKit + Wagmi

## 3. 分階段開發計畫

### 第一階段：資金基礎設施 (Phase 1: Financial Infrastructure)
- [ ] 撰寫 `Vault.sol` 合約 (USDT 儲值、提現、80/20 分紅接口)。
- [ ] 實作後端監聽器 (Listener)，自動將鏈上儲值同步到資料庫餘額。
- [ ] 整合 Telegram OAuth 與錢包綁定帳號系統。

### 第二階段：極簡遊戲模組 (Phase 2: Minimalist Games)
- [ ] 實作「公平性驗證演算法」。
- [ ] 開發三款核心遊戲：
    - **猜硬幣 (Coin Flip)**
    - **骰子比大小 (Dice)**
    - **幸運轉盤 (Lucky Spin)**
- [ ] 實作連點防護與異步扣款機制。

### 第三階段：收益寶 DeFi 模組 (Phase 3: Staking & APY)
- [ ] 實作 `Staking.sol` 7 天鎖倉合約。
- [ ] 開發動態 APY 顯示組件。
- [ ] 實作每週自動獎金結算與發放邏輯。

### 第四階段：Telegram 適配與主網部署 (Phase 4: Optimization & Mainnet)
- [ ] Telegram Mini App UI 適配 (深色模式、手勢優化)。
- [ ] 壓力測試與安全審計。
- [ ] 部署至 BSC 主網並開啟營運。

## 4. 遊戲視覺風格
- **目標：** 極簡數據感 (Minimalist & Data-driven UI)。
- **參考：** Stake.com 風格。
- **重點：** 加載速度快、反饋即時、操作直接。

---
*Last Updated: 2026-05-05*
