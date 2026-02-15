/**
 * Invoica PM2 Ecosystem Configuration
 *
 * Manages scheduled agent runners:
 * - CTO daily full-scan at 10AM CET (9 UTC)
 * - CMO market watch weekdays at 8:30 UTC
 * - Orchestrator (manual start with sprint file)
 *
 * Usage:
 *   pm2 start ecosystem.config.js           # Start all scheduled agents
 *   pm2 start ecosystem.config.js --only cto-daily-scan  # Start specific
 *   pm2 list                                # Check status
 *   pm2 logs cto-daily-scan --lines 50      # View logs
 */

module.exports = {
  apps: [
    // ===== CTO Daily Full Scan (10AM CET = 9AM UTC) =====
    {
      name: 'cto-daily-scan',
      script: './scripts/run-cto-techwatch.ts',
      interpreter: 'npx',
      interpreter_args: 'ts-node',
      args: 'full-scan',
      cwd: '/home/agent/agentic-finance-platform',
      cron_restart: '0 9 * * *',  // 9:00 UTC = 10:00 CET daily
      autorestart: false,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: 'logs/cto-daily-scan-error.log',
      out_file: 'logs/cto-daily-scan-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ===== CMO Market Watch (8:30 UTC weekdays, before sprint) =====
    {
      name: 'cmo-market-watch',
      script: './scripts/run-cmo.ts',
      interpreter: 'npx',
      interpreter_args: 'ts-node',
      args: 'market-watch',
      cwd: '/home/agent/agentic-finance-platform',
      cron_restart: '30 8 * * 1-5',  // 8:30 UTC = 9:30 CET weekdays only
      autorestart: false,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: 'logs/cmo-market-watch-error.log',
      out_file: 'logs/cmo-market-watch-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ===== Orchestrator (manual — pass sprint file as arg) =====
    // Usage: pm2 start ecosystem.config.js --only orchestrator -- sprints/week-13.json
    {
      name: 'orchestrator',
      script: './scripts/orchestrate-agents-v2.ts',
      interpreter: 'npx',
      interpreter_args: 'ts-node',
      cwd: '/home/agent/agentic-finance-platform',
      autorestart: false,
      watch: false,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
      error_file: 'logs/orchestrator-error.log',
      out_file: 'logs/orchestrator-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
