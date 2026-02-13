import { setInterval, clearInterval } from 'timers';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { PrismaClient, InvoiceStatus } from '@prisma/client';
import Bull, { Queue, Job } from 'bull';
import { Logger } from 'winston';
import { z } from 'zod';

/**
 * Custom error class for settlement poller errors
 */
export class SettlementPollerError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'SettlementPollerError';
    Error.captureStackTrace(this, SettlementPollerError);
  }
}

/**
 * Custom error class for PayAI API errors
 */
export class PayAIApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'PayAIApiError';
    Error.captureStackTrace(this, PayAIApiError);
  }
}

/**
 * Represents a settlement from the PayAI facilitator
 */
export interface PayAISettlement {
  id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  status: string;
  settled_at: string;
  created_at: string;
}

/**
 * Response from PayAI /list endpoint
 */
export interface PayAIListResponse {
  settlements: PayAISettlement[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * Configuration options for the settlement poller
 */
export interface SettlementPollerConfig {
  /** Polling interval in milliseconds (default: 30000) */
  pollIntervalMs: number;
  /** Base URL for PayAI facilitator API */
  payaiBaseUrl: string;
  /** API key for PayAI facilitator */
  payaiApiKey: string;
  /** Request timeout in milliseconds (default: 10000) */
  requestTimeoutMs?: number;
}

/**
 * Job data for PDF generation queue
 */
export interface PdfGenerationJobData {
  invoiceId: string;
  transactionId: string;
  settlementId: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<SettlementPollerConfig> = {
  pollIntervalMs: 30000,
  requestTimeoutMs: 10000,
};

/**
 * Zod schema for validating PayAI settlement response
 */
const PayAISettlementSchema = z.object({
  id: z.string(),
  transaction_id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  settled_at: z.string(),
  created_at: z.string(),
});

/**
 * Zod schema for validating PayAI list response
 */
const PayAIListResponseSchema = z.object({
  settlements: z.array(PayAISettlementSchema),
  pagination: z
    .object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
    })
    .optional(),
});

/**
 * Service that polls the PayAI facilitator for settlements
 * and matches them to pending invoices in the database.
 * 
 * @remarks
 * This service runs as a background process, polling every 30 seconds
 * by default. It matches settlements to invoices by transaction_id
 * and publishes jobs to a Bull queue for PDF generation.
 * 
 * @example
 *
