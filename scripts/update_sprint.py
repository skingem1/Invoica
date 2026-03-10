import json

SPRINT_FILE = "/home/invoica/apps/Invoica/sprints/week-21.json"

with open(SPRINT_FILE, "r") as f:
    data = json.load(f)

tasks = data["tasks"]

# Build a lookup by id for easy access
task_map = {t["id"]: t for t in tasks}

# STEP 1: Mark CHAIN-001 as done
task_map["CHAIN-001"]["status"] = "done"

# STEP 2: Update CHAIN-002 deliverables and context
task_map["CHAIN-002"]["deliverables"] = ["backend/src/lib/chain-validator.ts"]
task_map["CHAIN-002"]["context"] = """Create backend/src/lib/chain-validator.ts — a focused validation helper that wraps chain-registry for use in Express middleware.

Export one function:

```typescript
import { getSupportedChains, ChainConfig, getChain } from ./chain-registry;

/**
 * Validates that a chain ID is supported. Throws 400 if not.
 * Use this in route handlers instead of the old hardcoded SUPPORTED_CHAINS check.
 */
export function validateChain(chainId: unknown): string {
  if (typeof chainId \!== string || \!chainId) {
    throw Object.assign(new Error(chain is required), { status: 400 });
  }
  const supported = getSupportedChains();
  if (\!supported.includes(chainId)) {
    throw Object.assign(
      new Error(`Unsupported chain: ${chainId}. Supported: ${supported.join(, )}`),
      { status: 400 }
    );
  }
  return chainId;
}

export { getSupportedChains, getChain };
```

Max 40 lines. No external dependencies beyond chain-registry."""

# STEP 3: Build CHAIN-002b
chain_002b = {
    "id": "CHAIN-002b",
    "agent": "backend-core",
    "type": "bugfix",
    "priority": "critical",
    "dependencies": ["CHAIN-001", "CHAIN-002"],
    "status": "pending",
    "description": "Wire chain-validator into invoice routes",
    "deliverables": ["backend/src/routes/invoices.ts"],
    "context": """Update backend/src/routes/invoices.ts to use the new chain-validator module.

The file currently has a hardcoded SUPPORTED_CHAINS validation. You need to make exactly these changes:

1. Add import at top (after existing imports):
   import { validateChain } from ../lib/chain-validator;

2. Find any line like: 
   const SUPPORTED_CHAINS = [...] 
   or chain validation inline code and replace with:
   const chain = validateChain(req.body.chain ?? req.query.chain);

3. Remove the old SUPPORTED_CHAINS constant if it exists.

CRITICAL RULES:
- Do NOT rewrite the whole file from scratch
- Keep ALL existing route handlers exactly as they are
- Only touch the import section and the chain validation line
- The file must remain fully functional with all original endpoints intact
- Output the COMPLETE file (all 389 lines approximately), modifying only those 3 spots
- If the file seems too long, add a comment // [rest of file unchanged] at line 150 — the supervisor will reject truncation anyway"""
}

# Insert CHAIN-002b after CHAIN-002
new_tasks = []
for t in tasks:
    new_tasks.append(t)
    if t["id"] == "CHAIN-002":
        new_tasks.append(chain_002b)
tasks = new_tasks

# Rebuild map after insertion
task_map = {t["id"]: t for t in tasks}

# STEP 4: Append size limit to CHAIN-003 context
task_map["CHAIN-003"]["context"] += "\n\nCRITICAL SIZE LIMIT: Maximum 100 lines total. Keep implementation minimal — one function per RPC method, no comments beyond JSDoc, no error retry logic."

# STEP 5: Append size limit to CHAIN-004 context
task_map["CHAIN-004"]["context"] += "\n\nCRITICAL SIZE LIMIT: Maximum 100 lines total. Minimal implementation only — no retry logic, no caching, just the core getSignaturesForAddress + getTransaction calls."

# STEP 6: Replace CHAIN-007 context with pre-filled RPC test results
task_map["CHAIN-007"]["context"] = """Create docs/rpc-providers.md documenting which RPC providers work from our Hetzner VPS IP. Based on live tests conducted 2026-03-03, here are the actual results:

POLYGON RESULTS (tested via eth_blockNumber):
- https://polygon-bor-rpc.publicnode.com — PASS (returned valid blockNumber)
- https://polygon.gateway.tenderly.co — PASS (returned valid blockNumber)
- https://polygon.meowrpc.com — FAIL (returned JSON-RPC parse error: "Failed to parse request")
- https://1rpc.io/matic — FAIL (curl -sf returned no output / connection failed)

SOLANA RESULTS (tested via getSlot):
- https://api.mainnet-beta.solana.com — PASS (returned slot 403909499)
- https://solana-mainnet.rpc.extrnode.com — FAIL (curl -sf returned no output / connection failed)

Format as a markdown table with columns: Provider, Chain, Status, Notes. Add recommended primary/fallback for each chain. Max 60 lines."""

data["tasks"] = tasks

with open(SPRINT_FILE, "w") as f:
    json.dump(data, f, indent=2)

print("Sprint JSON updated successfully.")
print(f"Total tasks: {len(tasks)}")
for t in tasks:
    print(f"  {t[id]}: status={t.get(status,pending)}")
