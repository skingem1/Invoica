import { setInterval, clearInterval } from 'timers';

import { PrismaClient, InvoiceStatus } from '@prisma/client';
import Bull from 'bull';
import axios from 'axios';
import { z } from 'zod';

import { Logger } from '../utils/logger';
import { CustomError } from '../errors/custom-error';

// Configuration
const POLL_INTERVAL_MS = 30_000; // 30 seconds
const PAYAI_LIST_ENDPOINT = process.env.PAYAI_LIST_ENDPOINT || 'https://payai.example.com/api/v1/settlements/list';

/**
 * Zod schema for PayAI settlement response
 */
const PayAISettlementSchema = z.object({
  transaction_id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['settled', 'completed', 'pending', 'failed']),
  settled_at: z.string().datetime().optional(),
  created_at: z.string().datetime().optional(),
});

/**
 * Zod schema for PayAI list endpoint response
 */
const PayAIListResponseSchema = z.object({
  settlements: z.array(PayAISettlementSchema),
  next_cursor: z.string().optional(),
});

/**
 * Type inferred from PayAI settlement schema
 */
type PayAISettlement = z.infer<typeof PayAISettlementSchema>;

/**
 * Custom error for settlement polling failures
 */
export class SettlementPollerError extends CustomError {
  constructor(message: string, public readonly cause?: Error) {
    super(message, 'SETTLEMENT_POLLER_ERROR');
    this.name = 'SettlementPollerError';
  }
}

/**
 * Settlement poller service that polls PayAI facilitator
 * and matches settlements to pending invoices
 */
export class SettlementPollerService {
  private prisma: PrismaClient;
  private pdfQueue: Bull.Queue;
  private pollInterval: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private readonly logger: Logger;

  /**
   * Creates a new SettlementPollerService instance
   * @param prismaClient - Prisma client instance for database operations
   * @param pdfQueueInstance - Bull queue instance for PDF generation jobs
   */
  constructor(prismaClient?: PrismaClient, pdfQueueInstance?: Bull.Queue) {
    this.prisma = prismaClient ?? new PrismaClient();
    this.pdfQueue = pdfQueueInstance ?? this.createPdfQueue();
    this.logger = new Logger('settlement-poller');
  }

  /**
   * Creates the PDF generation queue
   */
  private createPdfQueue(): Bull.Queue {
    return new Bull('pdf-generation', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    });
  }

  /**
   * Fetches settlements from PayAI facilitator
   * @returns Array of settlements from PayAI
   * @throws {SettlementPollerError} If the API call fails
   */
  private async fetchSettlementsFromPayAI(): Promise<PayAISettlement[]> {
    const apiKey = process.env.PAYAI_API_KEY;
    
    if (!apiKey) {
      throw new SettlementPollerError('PAYAI_API_KEY environment variable is not set');
    }

    try {
      this.logger.info('Fetching settlements from PayAI', { endpoint: PAYAI_LIST_ENDPOINT });

      const response = await axios.get<unknown>(PAYAI_LIST_ENDPOINT, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      const validatedResponse = PayAIListResponseSchema.parse(response.data);
      
      this.logger.info('Successfully fetched settlements from PayAI', { 
        count: validatedResponse.settlements.length 
      });

      return validatedResponse.settlements;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Invalid response from PayAI API', { errors: error.errors });
        throw new SettlementPollerError('Invalid response format from PayAI API', error);
      }
      
      if (axios.isAxiosError(error)) {
        const message = error.response 
          ? `PayAI API error: ${error.response.status} ${error.response.statusText}`
          : `Network error: ${error.message}`;
        this.logger.error('Failed to fetch settlements from PayAI', { 
          error: message,
          code: error.code 
        });
        throw new SettlementPollerError(message, error);
      }

      this.logger.error('Unexpected error fetching settlements', { error });
      throw new SettlementPollerError('Unexpected error fetching settlements', error as Error);
    }
  }

  /**
   * Processes settlements from PayAI and matches them to pending invoices
   * @param settlements - Array of settlements from PayAI
   */
  private async processSettlements(settlements: PayAISettlement[]): Promise<void> {
    const settledSettlements = settlements.filter(
      (s) => s.status === 'settled' || s.status === 'completed'
    );

    this.logger.info('Processing settlements', { 
      total: settlements.length, 
      settled: settledSettlements.length 
    });

    for (const settlement of settledSettlements) {
      await this.processSettlement(settlement);
    }
  }

  /**
   * Processes a single settlement, matching to pending invoice if possible
   * @param settlement - The settlement from PayAI
   */
  private async processSettlement(settlement: PayAISettlement): Promise<void> {
    this.logger.debug('Processing settlement', { 
      transactionId: settlement.transaction_id,
      amount: settlement.amount,
      currency: settlement.currency 
    });

    try {
      // Find pending invoice with matching transaction_id
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          transaction_id: settlement.transaction_id,
          status: InvoiceStatus.PENDING,
        },
      });

      if (!invoice) {
        // Check if already processed (idempotency check)
        const existingInvoice = await this.prisma.invoice.findFirst({
          where: {
            transaction_id: settlement.transaction_id,
          },
        });

        if (existingInvoice) {
          this.logger.debug('Settlement already processed', { 
            transactionId: settlement.transaction_id,
            existingStatus: existingInvoice.status 
          });
        } else {
          this.logger.debug('No matching pending invoice found for settlement', { 
            transactionId: settlement.transaction_id 
          });
        }
        return;
      }

      // Verify amount matches (optional security check)
      if (Math.abs(invoice.amount - settlement.amount) > 0.01) {
        this.logger.warn('Settlement amount mismatch', { 
          transactionId: settlement.transaction_id,
          invoiceAmount: invoice.amount,
          settlementAmount: settlement.amount 
        });
        return;
      }

      // Update invoice status to processing
      const updatedInvoice = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { 
          status: InvoiceStatus.PROCESSING,
          updated_at: new Date(),
        },
      });

      // Add job to PDF generation queue (idempotent using job ID)
      const jobId = `pdf-${settlement.transaction_id}-${invoice.id}`;
      
      await this.pdfQueue.add(
        {
          invoiceId: invoice.id,
          transactionId: settlement.transaction_id,
        },
        {
          jobId,
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      );

      this.logger.info('Successfully matched settlement to invoice', { 
        invoiceId: invoice.id,
        transactionId: settlement.transaction_id,
        jobId 
      });

    } catch (error) {
      this.logger.error('Error processing settlement', { 
        transactionId: settlement.transaction_id,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Executes one polling cycle
   */
  private async poll(): Promise<void> {
    if (this.isPolling) {
      this.logger.debug('Skipping poll cycle - already in progress');
      return;
    }

    this.isPolling = true;
    const startTime = Date.now();

    try {
      this.logger.debug('Starting poll cycle');
      
      const settlements = await this.fetchSettlementsFromPayAI();
      await this.processSettlements(settlements);
      
      const duration = Date.now() - startTime;
      this.logger.debug('Poll cycle completed', { durationMs: duration });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Poll cycle failed', { 
        durationMs: duration,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Starts the settlement poller
   * Polls every 30 seconds by default
   * @param intervalMs - Optional custom interval in milliseconds
   */
  start(intervalMs: number = POLL_INTERVAL_MS): void {
    if (this.pollInterval) {
      this.logger.warn('Poller already running');
      return;
    }

    this.logger.info('Starting settlement poller', { intervalMs });
    
    // Run immediately on start
    this.poll();
    
    // Then schedule regular intervals
    this.pollInterval = setInterval(() => {
      this.poll();
    }, intervalMs);
  }

  /**
   * Stops the settlement poller
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.logger.info('Settlement poller stopped');
    }
  }

  /**
   * Returns whether the poller is currently running
   */
  isRunning(): boolean {
    return this.pollInterval !== null;
  }

  /**
   * Returns whether a poll cycle is currently in progress
   */
  isCurrentlyPolling(): boolean {
    return this.isPolling;
  }

  /**
   * Gracefully shuts down the service
   */
  async shutdown(): Promise<void> {
    this.stop();
    await this.prisma.$disconnect();
    await this.pdfQueue.close();
    this.logger.info('Settlement poller service shut down');
  }
}

/**
 * Default singleton instance for use in production
 */
let defaultInstance: SettlementPollerService | null = null;

/**
 * Gets the default SettlementPollerService instance
 * @returns The default service instance
 */
export function getSettlementPollerService(): SettlementPollerService {
  if (!defaultInstance) {
    defaultInstance = new SettlementPollerService();
  }
  return defaultInstance;
}
