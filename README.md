# BSC GameFi & DeFi Telegram Mini App

這是一個結合機率遊戲與投資收益寶的 Web3 平台，專為 Telegram Mini App (TMA) 設計，運行於 Binance Smart Chain (BSC)。

## 核心機制：以賭養息 (Bet-to-Earn Equilibrium)
- **遊戲盈餘：** 透過 3% 莊家優勢產生。
- **利息補貼：** 80% 遊戲獲利進入獎金池，分配給鎖倉 7 天的投資者。
- **平台收益：** 20% 遊戲獲利作為平台運作費用。

## 技術棧 (Tech Stack)
- **Blockchain:** BSC (Solidity, Hardhat)
- **Frontend:** Next.js, Tailwind CSS (Telegram Mini App UI)
- **Wallet:** WalletConnect / RainbowKit (Supporting BSC)
- **Security:** Chainlink VRF (Randomness)

## 目錄結構
- `/contracts`: 智能合約 (Vault, Games, Staking)
- `/src`: Telegram Mini App 前端代碼
- `/scripts`: 合約部署與腳本測試

## 開發進度
- [x] 專案初始化
- [ ] 核心國庫合約 (VaultManager.sol) 開發
- [ ] 7 天鎖倉收益寶合約 (StakingVault.sol) 開發
- [ ] 機率遊戲合約 (CoinFlip, Dice) 開發
- [ ] Telegram Mini App 前端介面整合
- [ ] BSC Testnet 部署與測試
