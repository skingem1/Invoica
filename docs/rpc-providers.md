Live tests conducted: 2026-03-03 from Hetzner VPS IP

## Polygon

| Provider | Chain | Status | Notes |
|----------|-------|--------|-------|
| https://polygon-bor-rpc.publicnode.com | Polygon | ✅ PASS | Returned valid blockNumber |
| https://polygon.gateway.tenderly.co | Polygon | ✅ PASS | Returned valid blockNumber |
| https://polygon.meowrpc.com | Polygon | ❌ FAIL | JSON-RPC parse error: "Failed to parse request" |
| https://1rpc.io/matic | Polygon | ❌ FAIL | curl -sf returned no output / connection failed |

**Recommended:** Primary: `polygon-bor-rpc.publicnode.com` | Fallback: `polygon.gateway.tenderly.co`

## Solana

| Provider | Chain | Status | Notes |
|----------|-------|--------|-------|
| https://api.mainnet-beta.solana.com | Solana | ✅ PASS | Returned slot 403909499 |
| https://solana-mainnet.rpc.extrnode.com | Solana | ❌ FAIL | curl -sf returned no output / connection failed |

**Recommended:** Primary: `api.mainnet-beta.solana.com` | Fallback: None available