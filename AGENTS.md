# Agent Instructions

This repository is a web-only BSC GameFi / DeFi application.

Do not add Telegram Bot or Telegram Mini App integrations. Do not introduce bot commands, initData auth, chat callbacks, or TMA SDK dependencies. The active product direction is browser web only.

Use wallet address as the primary user identity. Web users authenticate by signing a wallet login message, and admin access is controlled by `ADMIN_WALLET_ADDRESS`.

The `/simulator` route is a frontend-only planning and stress-testing tool for the three games and Earn vault model. Keep it disconnected from contracts, wallets, server writes, and external messaging platforms unless the product direction explicitly changes.

When updating documentation or plans, keep README, DEVELOPMENT_PLAN, and this file aligned with the web-only direction.
