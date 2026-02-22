/**
 * Invoica PM2 Ecosystem Configuration — Production (xCloud)
 *
 * Manages server processes on the production host:
 *   - Backend API server (port 3001) + Telegram bots
 *
 * NOTE: Dell WSL agent processes (heartbeat, CTO scan, CMO watch, orchestrator)
 *       live in ecosystem.dell.config.js — run those on the Dell machine only.
 *
 * Usage:
 *   pm2 startOrRestart ecosystem.config.js --env production   # Start/restart
 *   pm2 list                                                  # Check status
 *   pm2 logs backend --lines 50                               # View logs
 */

module.exports = {
    apps: [
          // ===== Backend API + Telegram Bots =====
      {
              name: 'backend',
              script: './backend/src/server.ts',
              interpreter: 'npx',
              interpreter_args: 'ts-node',
              cwd: '/var/www/invoica.wp1.host',
              autorestart: true,
              watch: false,
              max_memory_restart: '512M',
              env_production: {
                        NODE_ENV: 'production',
                        PORT: '3001',
              },
              error_file: 'logs/backend-error.log',
              out_file: 'logs/backend-out.log',
              log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      },
        ],
};
