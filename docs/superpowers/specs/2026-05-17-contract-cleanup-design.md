# Contract Cleanup Design

## Context

The current product direction is browser web only. Games run through backend API routes and DB ledger settlement:

- `/api/games/coin-flip/play`
- `/api/games/dice/play`
- `/api/games/lucky-spin/play`

The frontend does not call a game smart contract. Game results use the backend provably-fair Server Seed + Client Seed + Nonce flow, then write `GameRound`, `Transaction`, and `PlatformLedgerEntry` records.

`contracts/CoinFlip.sol` is an older on-chain game prototype. Its Chainlink VRF support files under `contracts/vrf/` are only referenced by that contract.

## Goal

Remove clearly unused on-chain game contracts so the active contract surface matches the current product:

- Keep contracts used for deposits, withdrawals, and test tokens.
- Remove the obsolete on-chain Coin Flip contract and its local VRF stubs.
- Make docs and verification reflect that games are backend/API ledger flows, not chain game contracts.

## Delete

- `contracts/CoinFlip.sol`
- `contracts/vrf/VRFConsumerBaseV2.sol`
- `contracts/vrf/VRFCoordinatorV2Interface.sol`
- The empty `contracts/vrf/` directory if no files remain.

## Keep

- `contracts/VaultManager.sol`
  - Used by frontend deposits via `deposit`.
  - Used by Admin withdrawal approval via `executeWithdrawal`.
  - Used by listener through `Deposit` events.

- `contracts/MockUSDT.sol`
  - Used by testnet/local testing and `/test` MockUSDT mint flow.

- `contracts/StakingVault.sol`
  - Not used by the current DB Earn MVP, but still referenced by deploy script and contract tests.
  - Keep for now as future/on-chain Earn infrastructure until a separate StakingVault cleanup decision is made.

## Documentation Changes

Update README contract descriptions so `/contracts` does not imply active game contracts.

Update the development plan to state:

- Current three games are backend internal-balance games.
- No active on-chain game contract is part of the current MVP.
- Chainlink VRF or chain games can be reconsidered later for large-settlement or fully on-chain modes.

## Verification

Add or update route/project verification to assert:

- `contracts/CoinFlip.sol` does not exist.
- `contracts/vrf/VRFConsumerBaseV2.sol` does not exist.
- `contracts/vrf/VRFCoordinatorV2Interface.sol` does not exist.
- `README.md` does not describe active game contracts.

Required commands:

```bash
npm run compile:contracts
npm run test:contracts
npm run test:web-mvp
npm run build
```

## Non-Goals

- Do not modify backend game settlement.
- Do not modify frontend game UI.
- Do not remove `VaultManager.sol`.
- Do not remove `MockUSDT.sol`.
- Do not remove or refactor `StakingVault.sol` in this cleanup.
- Do not add new contracts.
