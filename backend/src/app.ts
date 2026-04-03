import express from 'express';
import cors from 'cors';
import invoiceStatsRoutes from './routes/invoice-stats';
import invoiceExportRoutes from './routes/invoices-export';
import invoiceRoutes from './routes/invoices';
import apiKeyRoutes from './routes/api-keys';
import webhookRoutes from './routes/webhooks';
import settlementSummaryRoutes from './routes/settlement-summary';
import settlementRoutes from './routes/settlements';
import healthRoutes from './routes/health';
import wellKnownRoutes from './routes/well-known';
import aiInferenceRoutes from './routes/ai-inference';
import ledgerRoutes from './routes/ledger';
import adminRoutes from './routes/admin';
import gasBackstopRouter from './routes/gas-backstop';
import reputationLeaderboardRoutes from './routes/reputation-leaderboard';
import reputationRoutes from './routes/reputation';
import reputationHistoryRoutes from './routes/reputation-history';
import metricsRoutes from './routes/metrics';
import taxRoutes from './routes/tax';
import agentRoutes from './routes/agents';
import sapRoutes from './routes/sap';
import sapExecuteRoutes from './routes/sap-execute';
import invoiceDownloadRoutes from './routes/invoice-download';
import pactSessionRoutes from './routes/pact-session';
import { authenticate } from './middleware/auth';

const app = express();

// BUG-006 fix: explicit CORS origins — no wildcard on main API
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['https://app.invoica.ai', 'https://invoica.ai', 'https://www.invoica.ai'];
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`${req.method} ${req.path} ${_res.statusCode} ${duration}ms`);
    }
  });
  next();
});

app.use(healthRoutes);
app.use(invoiceDownloadRoutes);
app.use('/v1/pact', pactSessionRoutes);
app.use(invoiceStatsRoutes);
app.use(invoiceExportRoutes);
app.use(invoiceRoutes);
app.use(apiKeyRoutes);
app.use(webhookRoutes);
app.use(settlementSummaryRoutes);
app.use(settlementRoutes);
app.use(aiInferenceRoutes);
app.use(ledgerRoutes);
app.use(adminRoutes);
app.use(gasBackstopRouter);
app.use(reputationLeaderboardRoutes);
app.use(reputationRoutes);
app.use(reputationHistoryRoutes);
app.use(metricsRoutes);
app.use(taxRoutes);
app.use(agentRoutes);
app.use('/.well-known', wellKnownRoutes);
app.use('/api/sap', sapExecuteRoutes);
app.use('/v1/sap', authenticate, sapRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
});

export { app };
export default app;