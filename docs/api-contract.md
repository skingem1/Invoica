# Invoica API Contract

*Auto-generated 2026-03-31 from backend/src/routes/*

## Base URL
```
https://invoica.wp1.host/v1
```

## Authentication

| Method | Header | Required for |
|--------|--------|-------------|
| API Key | `X-API-Key: your-key` | Ledger endpoints |
| x402 Payment | `X-Payment: base64(EIP-3009 proof)` | AI inference |

## Admin

### `GET /v1/admin/system`
GET /v1/admin/system
**Auth:** None

## Agents

### `GET /v1/agents/top-earners`
GET /v1/agents/top-earners
**Auth:** None

### `GET /v1/agents/activity/summary`
GET /v1/agents/activity/summary
**Auth:** None

### `GET /v1/agents`
GET /v1/agents
**Auth:** None

### `GET /v1/agents/count`
GET /v1/agents/count
**Auth:** None

### `GET /v1/agents/:agentId/invoices/summary`
GET /v1/agents/:agentId/invoices/summary
**Auth:** None

### `GET /v1/agents/:agentId/invoices`
GET /v1/agents/:agentId/invoices
**Auth:** None

### `GET /v1/agents/:agentId/reputation`
GET /v1/agents/:agentId/reputation
**Auth:** None

### `GET /v1/agents/:agentId/activity`
GET /v1/agents/:agentId/activity
**Auth:** None

### `GET /v1/agents/:agentId/earnings`
GET /v1/agents/:agentId/earnings
**Auth:** None

### `GET /v1/agents/:agentId/settlements/summary`
GET /v1/agents/:agentId/settlements/summary
**Auth:** None

### `GET /v1/agents/:agentId`
GET /v1/agents/:agentId
**Auth:** None

## Ai inference

### `GET /v1/ai/inference`
Get x402 payment requirements for AI inference
**Auth:** None

### `POST /v1/ai/inference`
Call AI model (MiniMax or Claude) via x402 USDC payment
**Auth:** x402 Payment (X-Payment header, USDC on Base)

### `GET /v1/ai/inference/costs`
GET /v1/ai/inference/costs
**Auth:** None

## Api keys

### `POST /v1/api-keys`
Create a new API key
**Auth:** None

### `GET /v1/api-keys`
List all API keys for the authenticated user
**Auth:** None

### `POST /v1/api-keys/:id/rotate`
Rotate (regenerate) an API key
**Auth:** None

### `POST /v1/api-keys/:id/revoke`
Revoke an API key
**Auth:** None

### `DELETE /v1/api-keys/:id`
DELETE /v1/api-keys/:id
**Auth:** None

## Gas backstop

### `GET /v1/gas/status`
GET /v1/gas/status
**Auth:** None

## Health

### `GET /v1/health`
Health check — returns API status and uptime
**Auth:** None

### `GET /v1/health/services`
GET /v1/health/services
**Auth:** None

### `GET /v1/health/detailed`
GET /v1/health/detailed
**Auth:** None

### `GET /v1/health/metrics`
GET /v1/health/metrics
**Auth:** None

## Invoice stats

### `GET /v1/invoices/stats`
GET /v1/invoices/stats
**Auth:** None

## Invoices export

### `GET /v1/invoices/export`
GET /v1/invoices/export
**Auth:** None

## Invoices

### `GET /v1/invoices/search/advanced`
GET /v1/invoices/search/advanced
**Auth:** None

### `GET /v1/invoices/search`
GET /v1/invoices/search
**Auth:** None

### `GET /v1/invoices/number/:number`
Get invoice by invoice number
**Auth:** None

### `GET /v1/invoices/count`
GET /v1/invoices/count
**Auth:** None

### `GET /v1/invoices/stats/status`
GET /v1/invoices/stats/status
**Auth:** None

### `GET /v1/invoices/stats/currency`
GET /v1/invoices/stats/currency
**Auth:** None

### `GET /v1/invoices/stats/customers`
GET /v1/invoices/stats/customers
**Auth:** None

### `GET /v1/invoices/stats/void`
GET /v1/invoices/stats/void
**Auth:** None

### `GET /v1/invoices/stats/payment-lag`
GET /v1/invoices/stats/payment-lag
**Auth:** None

### `GET /v1/invoices/stats/by-company`
GET /v1/invoices/stats/by-company
**Auth:** None

### `GET /v1/invoices/stats/aging`
GET /v1/invoices/stats/aging
**Auth:** None

### `GET /v1/invoices/overdue`
GET /v1/invoices/overdue
**Auth:** None

### `GET /v1/invoices/export.csv`
GET /v1/invoices/export.csv
**Auth:** None

### `GET /v1/invoices/:id`
Get invoice by UUID
**Auth:** None

### `GET /v1/invoices/:id/timeline`
GET /v1/invoices/:id/timeline
**Auth:** None

### `GET /v1/invoices`
GET /v1/invoices
**Auth:** None

### `POST /v1/invoices`
Create a new invoice
**Auth:** None

### `POST /v1/invoices/bulk/status`
POST /v1/invoices/bulk/status
**Auth:** None

### `POST /v1/invoices/bulk/cancel`
POST /v1/invoices/bulk/cancel
**Auth:** None

### `PATCH /v1/invoices/:id/status`
PATCH /v1/invoices/:id/status
**Auth:** None

### `PATCH /v1/invoices/:id/metadata`
PATCH /v1/invoices/:id/metadata
**Auth:** None

### `POST /v1/invoices/:id/duplicate`
POST /v1/invoices/:id/duplicate
**Auth:** None

### `POST /v1/invoices/:id/remind`
POST /v1/invoices/:id/remind
**Auth:** None

### `POST /v1/invoices/:id/cancel`
POST /v1/invoices/:id/cancel
**Auth:** None

### `POST /v1/invoices/:id/void`
POST /v1/invoices/:id/void
**Auth:** None

## Ledger

### `POST /v1/ledger/send-verification`
Send email verification for ledger access
**Auth:** None

### `POST /v1/ledger/confirm-verification`
Confirm email verification code
**Auth:** None

### `GET /v1/ledger`
Get ledger transactions (requires API key)
**Auth:** API Key (X-API-Key header)

### `GET /v1/ledger/summary`
Get ledger summary statistics (requires API key)
**Auth:** API Key (X-API-Key header)

### `GET /v1/ledger/export.csv`
Export ledger as CSV (requires API key)
**Auth:** API Key (X-API-Key header)

### `GET /v1/ledger/summary/:agentId`
GET /v1/ledger/summary/:agentId
**Auth:** None

### `GET /v1/ledger/recent`
GET /v1/ledger/recent
**Auth:** None

### `GET /v1/ledger/:agentId/balance`
GET /v1/ledger/:agentId/balance
**Auth:** None

## Metrics

### `GET /v1/metrics`
GET /v1/metrics
**Auth:** None

### `GET /v1/metrics/agent/:agentId`
GET /v1/metrics/agent/:agentId
**Auth:** None

### `GET /v1/metrics/daily`
GET /v1/metrics/daily
**Auth:** None

### `GET /v1/metrics/leaderboard`
GET /v1/metrics/leaderboard
**Auth:** None

### `GET /v1/metrics/summary`
GET /v1/metrics/summary
**Auth:** None

### `GET /v1/metrics/compare`
GET /v1/metrics/compare
**Auth:** None

### `GET /v1/metrics/chains`
GET /v1/metrics/chains
**Auth:** None

### `GET /v1/metrics/chains/breakdown`
GET /v1/metrics/chains/breakdown
**Auth:** None

### `GET /v1/metrics/top-currencies`
GET /v1/metrics/top-currencies
**Auth:** None

### `GET /v1/metrics/revenue`
GET /v1/metrics/revenue
**Auth:** None

### `GET /v1/metrics/agents/top`
GET /v1/metrics/agents/top
**Auth:** None

### `GET /v1/metrics/hourly`
GET /v1/metrics/hourly
**Auth:** None

### `GET /v1/metrics/weekly`
GET /v1/metrics/weekly
**Auth:** None

### `GET /v1/metrics/peak-hours`
GET /v1/metrics/peak-hours
**Auth:** None

### `GET /v1/metrics/conversion`
GET /v1/metrics/conversion
**Auth:** None

### `GET /v1/metrics/growth`
GET /v1/metrics/growth
**Auth:** None

## Reputation history

### `GET /v1/reputation/:agentId/history`
GET /v1/reputation/:agentId/history
**Auth:** None

## Reputation leaderboard

### `GET /v1/reputation/leaderboard`
GET /v1/reputation/leaderboard
**Auth:** None

## Reputation

### `GET /x402/oracle/score/:agentId`
GET /x402/oracle/score/:agentId
**Auth:** None

### `GET /x402/oracle/scores`
GET /x402/oracle/scores
**Auth:** None

### `POST /v1/reputation/batch`
POST /v1/reputation/batch
**Auth:** None

### `GET /v1/reputation/distribution`
GET /v1/reputation/distribution
**Auth:** None

### `GET /v1/reputation/:agentId/stats`
GET /v1/reputation/:agentId/stats
**Auth:** None

## Sap execute

### `POST /execute`
POST /execute
**Auth:** None

## Sap

### `GET /network`
GET /network
**Auth:** None

### `GET /agents`
GET /agents
**Auth:** None

### `GET /agents/me`
GET /agents/me
**Auth:** None

## Settlement summary

### `GET /v1/settlements/summary`
GET /v1/settlements/summary
**Auth:** None

### `GET /v1/settlements/stats`
GET /v1/settlements/stats
**Auth:** None

## Settlements

### `GET /v1/settlements/timeline`
GET /v1/settlements/timeline
**Auth:** None

### `GET /v1/settlements/stats`
GET /v1/settlements/stats
**Auth:** None

### `GET /v1/settlements/pending`
GET /v1/settlements/pending
**Auth:** None

### `GET /v1/settlements/volume`
GET /v1/settlements/volume
**Auth:** None

### `GET /v1/settlements/agent/:agentId`
GET /v1/settlements/agent/:agentId
**Auth:** None

### `GET /v1/settlements/export.csv`
GET /v1/settlements/export.csv
**Auth:** None

### `GET /v1/settlements/recent`
GET /v1/settlements/recent
**Auth:** None

### `GET /v1/settlements/by-currency`
GET /v1/settlements/by-currency
**Auth:** None

### `GET /v1/settlements/by-agent`
GET /v1/settlements/by-agent
**Auth:** None

### `GET /v1/settlements/analytics`
GET /v1/settlements/analytics
**Auth:** None

### `GET /v1/settlements/:id`
Get settlement details by ID
**Auth:** None

### `GET /v1/settlements`
List all settlements (paid/completed invoices)
**Auth:** None

## Tax

### `POST /v1/tax/calculate`
POST /v1/tax/calculate
**Auth:** None

### `GET /v1/tax/jurisdictions`
GET /v1/tax/jurisdictions
**Auth:** None

## Webhooks

### `POST /v1/webhooks`
Register a new webhook endpoint
**Auth:** None

### `GET /v1/webhooks`
List all registered webhooks
**Auth:** None

### `GET /v1/webhooks/by-event/:eventType`
GET /v1/webhooks/by-event/:eventType
**Auth:** None

### `GET /v1/webhooks/stats`
GET /v1/webhooks/stats
**Auth:** None

### `GET /v1/webhooks/events`
GET /v1/webhooks/events
**Auth:** None

### `GET /v1/webhooks/:id`
GET /v1/webhooks/:id
**Auth:** None

### `PUT /v1/webhooks/:id`
PUT /v1/webhooks/:id
**Auth:** None

### `DELETE /v1/webhooks/bulk`
DELETE /v1/webhooks/bulk
**Auth:** None

### `DELETE /v1/webhooks/:id`
Delete a webhook
**Auth:** None

### `POST /v1/webhooks/:id/test`
POST /v1/webhooks/:id/test
**Auth:** None

## Well known

### `GET /x402`
GET /x402
**Auth:** None
