import { app } from './app';
import { startCustomerBot, startCeoBot } from './telegram';

const PORT = parseInt(process.env.PORT || '3001', 10);

const server = app.listen(PORT, () => {
  console.log(`Invoica API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/v1/health`);
    startCustomerBot().catch((e) => console.error('[CustomerBot] Failed to start:', e));
      startCeoBot().catch((e) => console.error('[CeoBot] Failed to start:', e));
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
  throw err;
});

export { server };