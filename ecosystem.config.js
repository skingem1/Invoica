// Load .env so PM2 env blocks can reference process.env values (e.g. secrets)
// Wrapped in try-catch: dotenv may not be installed in CI or other environments
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch (e) {}

module.exports = {
  apps: [
    {
      name: "backend",
      script: "/home/invoica/apps/Invoica/backend-wrapper.sh",
      interpreter: "bash",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      max_restarts: 50,        // live beta: tolerate transient crashes (DB cold starts, port zombie loops, etc.)
      min_uptime: "30s",       // only counts as stable if it lives 30s (catches fast crash loops)
      restart_delay: 5000,     // 5s between restart attempts (gives port TIME_WAIT time to clear)
      kill_timeout: 15000,     // 15s: server.close() + prisma.$disconnect() completes in <10s now (graceful shutdown added)
      wait_ready: true,        // don't route traffic until process.send('ready') fires (after server.listen())
      listen_timeout: 10000,   // max 10s to receive the ready signal before PM2 considers startup failed
      env: {
        // x402 seller wallet — receives USDC from agent inference payments
        X402_SELLER_WALLET: "0x3e127c918C83714616CF2416f8A620F1340C19f1",
      },
      error_file: "/home/invoica/apps/Invoica/logs/backend-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "openclaw-gateway",
      script: "/opt/oc/gateway-wrapper.sh",
      interpreter: "bash",
      cwd: "/opt/oc",
      autorestart: true,
      watch: false,
      max_memory_restart: "768M",
      max_restarts: 25,        // gateway: tolerate transient port conflicts during restarts
      min_uptime: "30s",       // only counts as stable if it lives 30s
      restart_delay: 5000,     // 5s between restart attempts
      kill_timeout: 30000,     // 30s: give OpenClaw time to drain in-flight requests before SIGKILL
      error_file: "/home/invoica/apps/Invoica/logs/gateway-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/gateway-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "cto-email-support",
      script: "./scripts/run-cto-email-support.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "*/5 * * * *",
      kill_timeout: 60000,     // 1 min: force-kill if email handler hangs
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/email-support-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/email-support-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "cto-daily-scan",
      script: "./scripts/run-cto-techwatch.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 9 * * *",
      args: "full-scan",
      kill_timeout: 300000,   // 5 min: full TechWatch scan can be slow (API calls); force-kill if hung
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/cto-scan-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/cto-scan-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "heartbeat",
      script: "./scripts/heartbeat-daemon.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 * * * *",
      kill_timeout: 120000,    // 2 min: force-kill if heartbeat hangs (PM2 waits this before SIGKILL)
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json",
        // Security: read from .env — never hardcode this URL (it's a shared secret)
        HEALTHCHECK_PING_URL: process.env.HEALTHCHECK_PING_URL || ""
      },
      error_file: "/home/invoica/apps/Invoica/logs/heartbeat-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/heartbeat-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "x-admin-post",
      script: "./scripts/run-x-admin.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "*/30 * * * *",
      kill_timeout: 30000,     // 30s: cron — force-kill if X API call hangs
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/x-admin-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/x-admin-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      // Every Tuesday at 10:00 UTC — DM outreach to x402/Base/AI-agent builders
      // Sources: Twitter search queries + CMO weekly plan accounts_to_watch
      // Deduplicates against state file; sends max 5 DMs per run (30s apart)
      name: "x-dm-outreach",
      script: "./scripts/x-dm-outreach.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 10 * * 2",
      args: "--run",
      kill_timeout: 60000,     // 1 min: DM outreach sends up to 5 DMs with 30s delays — allow time to finish
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/x-dm-outreach-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/x-dm-outreach-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "cmo-daily-watch",
      script: "./scripts/run-cmo-fixed.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 8 * * *",
      args: "market-watch",
      kill_timeout: 30000,     // 30s: daily market watch — force-kill if Grok API hangs
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/cmo-watch-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/cmo-watch-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      // Every Sunday at 06:00 UTC — CMO generates full week of X posts
      // CTO reviews technical accuracy → CEO approves → X agent executes Mon-Sun
      name: "cmo-weekly-content-plan",
      script: "./scripts/run-cmo-weekly-plan.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 6 * * 0",
      kill_timeout: 120000,    // 2 min: full weekly content plan with CTO review + CEO approval
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json",
        CEO_TELEGRAM_BOT_TOKEN: process.env.CEO_TELEGRAM_BOT_TOKEN || "",
        OWNER_TELEGRAM_CHAT_ID: process.env.OWNER_TELEGRAM_CHAT_ID || "",
      },
      error_file: "/home/invoica/apps/Invoica/logs/cmo-weekly-plan-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/cmo-weekly-plan-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "tax-watchdog-us",
      script: "./scripts/tax-watchdog-us.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 7 * * *",  // daily (was weekly "0 7 * * 1" — missed runs = week without alerts)
      kill_timeout: 60000,     // 1 min: tax reg API scrape — allow for slow responses
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/tax-us-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/tax-us-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "tax-watchdog-eu-japan",
      script: "./scripts/tax-watchdog-eu-japan.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 8 * * *",  // daily (was weekly "0 8 * * 1" — missed runs = week without alerts)
      kill_timeout: 60000,     // 1 min: EU/Japan tax API scrape — multi-jurisdiction, allow for slow responses
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/tax-eu-japan-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/tax-eu-japan-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "ceo-review",
      script: "./scripts/run-ceo-review.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 */2 * * *",
      args: "--source=cron",
      kill_timeout: 60000,     // 1 min: CEO review involves Claude API calls — allow time to complete
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/ceo-review-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/ceo-review-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "cfo-weekly",
      script: "./scripts/run-cfo.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 7 * * 1",
      args: "weekly-report",
      kill_timeout: 60000,     // 1 min: CFO weekly report reads wallet balances + generates report file
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/cfo-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/cfo-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      // CEO AI Bot — standalone process (isolated from backend API)
      // Previously ran inside backend/src/server.ts causing 4827 API crashes
      // (ceoBot watchdog calls process.exit(1) → now only kills this process)
      name: "ceo-ai-bot",
      script: "./scripts/run-ceo-bot.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      max_restarts: 20,        // tolerate transient crashes (network blips, API timeouts)
      min_uptime: "10s",       // only counts as stable if it lives 10s (catches fast crash loops)
      restart_delay: 3000,     // 3s between restart attempts
      kill_timeout: 30000,     // 30s: Telegram long-poll may hold connection — give it time to release
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json",
        CEO_TELEGRAM_BOT_TOKEN: process.env.CEO_TELEGRAM_BOT_TOKEN || "",
        OWNER_TELEGRAM_CHAT_ID: process.env.OWNER_TELEGRAM_CHAT_ID || "",
      },
      error_file: "/home/invoica/apps/Invoica/logs/ceo-ai-bot-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/ceo-ai-bot-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "git-autodeploy",
      script: "./scripts/git-autodeploy.sh",
      interpreter: "bash",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "*/5 * * * *",
      kill_timeout: 60000,     // 1 min: deploy may run pm2 reload + pm2 save — allow time to complete
      error_file: "/home/invoica/apps/Invoica/logs/autodeploy-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/autodeploy-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "bizdev-weekly",
      script: "./scripts/run-bizdev.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 6 * * 0",
      args: "opportunity-scan",
      kill_timeout: 60000,     // 1 min: opportunity scan hits external APIs — allow for slow responses
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/bizdev-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/bizdev-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      // sprint-runner: checks every 30 min for pending sprint tasks, runs MiniMax orchestrator
      // This closes the loop: CEO issues → sprint JSON → auto-execution
      // To queue work: write a sprints/week-N.json with status:"pending" tasks
      name: "sprint-runner",
      script: "./scripts/sprint-runner.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "*/30 * * * *",
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json",
        CEO_TELEGRAM_BOT_TOKEN: process.env.CEO_TELEGRAM_BOT_TOKEN || "",
        OWNER_TELEGRAM_CHAT_ID: process.env.OWNER_TELEGRAM_CHAT_ID || "",
        // x402 wallet spending: code agent wallet pays 0.001 USDC per LLM call
        // Seller wallet = CTO agent wallet (receives USDC from inference payments)
        X402_SELLER_WALLET: "0x3e127c918C83714616CF2416f8A620F1340C19f1",
        INFERENCE_API_URL: "http://localhost:3001",
      },
      error_file: "/home/invoica/apps/Invoica/logs/sprint-runner-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/sprint-runner-out.log",
      kill_timeout: 22200000,  // 6h 10min: matches MAX_HOURS (6h) — force-kill only if orchestrator hangs beyond limit
      max_restarts: 5,
      min_uptime: "30s",
      restart_delay: 5000,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      // Memory Agent — "black box" observer of the entire company
      // Runs hourly. Writes to /home/invoica/memory/ (OUTSIDE app dir — survives git clean/wipes)
      // Also mirrors to memory/ in repo so agents can read via file system
      // Generates: daily-log-YYYY-MM-DD.md | daily-continuity.md | long-term-memory.md
      name: "memory-agent",
      script: "./scripts/memory-agent.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 * * * *",
      kill_timeout: 60000,     // 1 min: writes daily-log + continuity + long-term-memory files — allow time
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json",
        // External memory dir — persists independently of the app
        MEMORY_DIR: "/home/invoica/memory",
      },
      error_file: "/home/invoica/apps/Invoica/logs/memory-agent-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/memory-agent-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      // Mission Control — self-hosted AI agent ops dashboard (builderz-labs/mission-control)
      // Next.js + SQLite. No external deps. Runs permanently on port 3010.
      // Access: ssh -L 3005:localhost:3005 invoica@<server> then open http://localhost:3005
      // Setup (first time only): bash scripts/setup-mission-control.sh
      name: "mission-control",
      min_uptime: "30s",
      max_restarts: 20,
      restart_delay: 5000,    // 5s between restart attempts
      kill_timeout: 10000,    // 10s: give Next.js time to drain before SIGKILL (same reasoning as backend)
      script: "./scripts/run-mission-control.sh",
      interpreter: "bash",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      error_file: "/home/invoica/apps/Invoica/logs/mission-control-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/mission-control-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      // Docs Generator — runs daily at 04:00 UTC
      // Scans git log + backend routes → writes changelog.json + api-reference.json
      // → rewrites frontend pages → git push → Vercel auto-redeploys live docs
      // Also triggered by memory-agent after each daily continuity brief
      name: "docs-generator",
      script: "./scripts/generate-docs.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "0 4 * * *",
      kill_timeout: 120000,   // 2 min: git operations and markdown writes can stall; force-kill if hung
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json",
        MEMORY_DIR: "/home/invoica/memory",
      },
      error_file: "/home/invoica/apps/Invoica/logs/docs-generator-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/docs-generator-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      // invoica-mcp: local dev/test runner for the MCP server
      // Not used in production (users run via npx @invoica/mcp)
      // To test: pm2 start ecosystem.config.js --only invoica-mcp
      name: "invoica-mcp",
      script: "./backend/src/mcp/invoica-mcp-server.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json",
        INVOICA_API_URL: "https://api.invoica.ai",
      },
      error_file: "/home/invoica/apps/Invoica/logs/mcp-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/mcp-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "pm2-process-watchdog",
      script: "./scripts/pm2-process-watchdog.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      cwd: "/home/invoica/apps/Invoica",
      autorestart: false,
      watch: false,
      cron_restart: "*/5 * * * *",
      kill_timeout: 30000,     // 30s: watchdog checks PM2 + optionally restarts procs — allow time to complete
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/watchdog-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/watchdog-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
  ]
};