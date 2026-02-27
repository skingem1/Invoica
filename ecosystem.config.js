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
      env: {
        TS_NODE_TRANSPILE_ONLY: "true",
        TS_NODE_PROJECT: "/home/invoica/apps/Invoica/tsconfig.json"
      },
      error_file: "/home/invoica/apps/Invoica/logs/cto-scan-error.log",
      out_file: "/home/invoica/apps/Invoica/logs/cto-scan-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
