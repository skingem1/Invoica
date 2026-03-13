import { app } from './app';
import { prisma } from './lib/prisma';

process.on('uncaughtException', (err: Error) => {
  console.error('[FATAL] Uncaught exception:', err.message, err.stack);
  setTimeout(() => process.exit(1), 500);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  setTimeout(() => process.exit(1), 500);
});

const PORT = parseInt(process.env.PORT || '3001', 10);

const server = app.listen(PORT, () => {
  console.log(`Invoica API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/v1/health`);

  // CEO AI bot runs as a SEPARATE PM2 process (ceo-ai-bot) — do NOT start here.
  // Reason: ceoBot has a process.exit(1) watchdog that would crash the API server.
  // See ecosystem.config.js → ceo-ai-bot → scripts/run-ceo-bot.ts

  // Signal PM2 that the server is ready to accept traffic (requires wait_ready: true in ecosystem.config.js)
  process.send?.('ready');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
  throw err;
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Handles PM2 SIGTERM (restart/stop) and Ctrl-C SIGINT cleanly.
// Without this, PM2 sends SIGTERM → Node sits idle for 30s → PM2 force-kills → Prisma
// connection leaked. With this: server drains → Prisma disconnects → clean exit in <10s.
function gracefulShutdown(signal: string): void {
  console.log(`[shutdown] ${signal} received — closing HTTP server`);

  server.close(async () => {
    console.log('[shutdown] HTTP server closed — no new connections accepted');

    try {
      await prisma.$disconnect();
      console.log('[shutdown] Prisma disconnected cleanly');
    } catch (err) {
      console.error('[shutdown] Prisma disconnect error:', err);
    }

    console.log('[shutdown] Exiting cleanly');
    process.exit(0);
  });

  // Safety net: if server.close() hangs (e.g. keep-alive connections stall),
  // force-exit after 10s. PM2 kill_timeout (15s) gives us 5s of margin.
  setTimeout(() => {
    console.error('[shutdown] Forced exit — server.close() timed out after 10s');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

export { server };
