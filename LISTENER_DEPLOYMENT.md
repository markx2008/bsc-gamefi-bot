# Listener Deployment Notes

The deposit listener is a long-running worker service. In production it should run compiled JavaScript, not `ts-node`, to reduce runtime memory use and avoid TypeScript loader warnings.

## Required Environment Variables

- `DATABASE_URL`: PostgreSQL connection string used by Prisma.
- `VAULT_ADDRESS`: deployed `VaultManager` contract address to watch for `Deposit` events.
- `RPC_URL`: BSC RPC endpoint. If omitted, the listener uses the BSC testnet public RPC fallback.
- `USDT_DECIMALS`: token decimals. Defaults to `18`.
- `LISTENER_START_BLOCK`: optional first block for backfill. If omitted, the listener starts from the current block and saves a checkpoint.
- `LISTENER_BLOCK_CHUNK_SIZE`: optional backfill chunk size. Defaults to `2000` blocks.

## Zeabur Service Command

Use the package script:

```bash
npm run server
```

The Docker build runs `npm run build`, which now also compiles the listener into `dist/server/src/services/listener.js`. The `server` script runs that compiled file with `node`.

For local development only, use:

```bash
npm run server:dev
```

## Memory Guidance

The previous `ts-node` runtime could exceed small worker limits. Allocate at least `512Mi` memory for the listener worker; `1Gi` is recommended while backfill is active.
