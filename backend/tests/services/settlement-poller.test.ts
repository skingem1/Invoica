import { Logger } from 'winston';
import { PrismaClient, InvoiceStatus } from '@prisma/client';
import Bull, { Queue, Job } from 'bull';
import { SettlementPollerService, SettlementPollerError, PayAIApiError, PayAISettlement, PdfGenerationJobData } from '../../src/services/settlement-poller';

// Mock dependencies
jest.mock('axios');
jest.mock('@prisma/client');
jest.mock('bull');
jest.mock('winston');

describe('SettlementPollerService', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockPdfQueue: jest.Mocked<Queue<PdfGenerationJobData>>;
  let mockLogger: jest.Mocked<Logger>;
  let service: SettlementPollerService;
  let mockAxios: {
    create: jest.Mock;
    get: jest.Mock;
  };

  const mockConfig = {
    pollIntervalMs: 1000, // Short interval for testing
    payaiBaseUrl: 'https://api.payai.test.com',
    payaiApiKey: 'test-api-key',
    requestTimeoutMs: 5000,
  };

  const mockSettlements: PayAISettlement[] = [
    {
      id: 'settlement-1',
      transaction_id: 'txn-001',
      amount: 10000,
      currency: 'USD',
      status: 'settled',
      settled_at: '2024-01-15T10:00:00Z',
      created_at: '2024-01-15T09:00:00Z',
    },
    {
      id: 'settlement-2',
      transaction_id: 'txn-002',
      amount: 25000,
      currency: 'USD',
      status: 'settled',
      settled_at: '2024-01-15T10:30:00Z',
      created_at: '2024-01-15T09:30:00Z',
    },
    {
      id: 'settlement-3',
      transaction_id: 'txn-003',
      amount: 5000,
      currency: 'USD',
      status: 'settled',
      settled_at: '2024-01-15T11:00:00Z',
      created_at: '2024-01-15T10:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup axios mock
    mockAxios = {
      create: jest.fn().mockReturnThis(),
      get: jest.fn(),
    };
    require('axios').create.mockReturnValue(mockAxios);

    // Setup Prisma mock
    mockPrisma = {
      $transaction: jest.fn(),
      invoice: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    // Setup Bull queue mock
    mockPdfQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    } as unknown as jest.Mocked<Queue<PdfGenerationJobData>>;

    // Setup Logger mock
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    service = new SettlementPollerService(
      mockPrisma,
      mockPdfQueue,
      mockLogger,
      mockConfig
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create the service with correct configuration', () => {
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: mockConfig.payaiBaseUrl,
        timeout: mockConfig.requestTimeoutMs,
        headers: {
          'Authorization': `Bearer ${mockConfig.payaiApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
    });

    it('should set isRunning to false initially', () => {
      expect(service.isPolling()).toBe(false);
    });
  });

  describe('start', () => {
    beforeEach(() => {
      mockAxios.get.mockResolvedValue({ data: { settlements: [] } });
    });

    it('should start the poller and perform initial poll', async () => {
      await service.start();

      expect(service.isPolling()).toBe(true);
      expect(mockAxios.get).toHaveBeenCalledWith('/list');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting settlement poller'),
        expect.any(Object)
      );
    });

    it('should perform scheduled polls at interval', async () => {
      await service.start();

      // Advance timer to trigger next poll
      jest.advanceTimersByTime(mockConfig.pollIntervalMs);

      expect(mockAxios.get).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(mockConfig.pollIntervalMs);

      expect(mockAxios.get).toHaveBeenCalledTimes(3);
    });

    it('should not start if already running', async () => {
      await service.start();
      await service.start();

      expect(mockLogger.warn).toHaveBeenCalledWith('Settlement poller is already running');
      expect(mockAxios.get).toHaveBeenCalledTimes(1); // Only one poll
    });

    it('should continue scheduling polls even if initial poll fails', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await service.start();

      // The service should still be running and scheduling polls
      expect(service.isPolling()).toBe(true);

      // Advance timer
      jest.advanceTimersByTime(mockConfig.pollIntervalMs);

      // Second poll should succeed
      mockAxios.get.mockResolvedValueOnce({ data: { settlements: [] } });
      jest.advanceTimersByTime(mockConfig.pollIntervalMs);

      expect(mockAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      mockAxios.get.mockResolvedValue({ data: { settlements: [] } });
    });

    it('should stop the poller', async () => {
      await service.start();
      await service.stop();

      expect(service.isPolling()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Settlement poller service stopped'
      );
    });

    it('should not stop if not running', async () => {
      await service.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith('Settlement poller is not running');
    });

    it('should clear the poll interval', async () => {
      await service.start();
      await service.stop();

      jest.advanceTimersByTime(mockConfig.pollIntervalMs * 10);

      // Should not have any more polls after stop
      expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('poll', () => {
    it('should fetch settlements from PayAI API', async () => {
      mockAxios.get.mockResolvedValue({
        data: { settlements: mockSettlements },
      });

      await service.poll();

      expect(mockAxios.get).toHaveBeenCalledWith('/list');
    });

    it('should log the number of settlements received', async () => {
      mockAxios.get.mockResolvedValue({
        data: { settlements: mockSettlements },
      });

      await service.poll();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Received settlements'),
        expect.objectContaining({
          settlementCount: 3,
        })
      );
    });

    it('should throw SettlementPollerError on axios error with 5xx status', async () => {
      const axiosError = new Error('Server Error');
      (axiosError as any).response = { status: 500 };
      mockAxios.get.mockRejectedValue(axiosError);

      await expect(service.poll()).rejects.toThrow(PayAIApiError);
    });

    it('should throw SettlementPollerError on network failure', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network Error'));

      await expect(service.poll()).rejects.toThrow(SettlementPollerError);
    });

    it('should throw error on invalid response schema', async () => {
      mockAxios.get.mockResolvedValue({
        data: { invalid: 'structure' },
      });

      await expect(service.poll()).rejects.toThrow(PayAIApiError);
    });
  });

  describe('processSettlement', () => {
    beforeEach(() => {
      // Default transaction behavior
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
    });

    it('should match settlement to pending invoice and queue PDF generation', async () => {
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(null) // Not already completed
        .mockResolvedValueOnce({    // Find pending invoice
          id: 'inv-001',
          transactionId: 'txn-001',
          status: 'pending' as InvoiceStatus,
        });

      mockPrisma.invoice.update.mockResolvedValue({});

      const settlement = mockSettlements[0];
      const result = await (service as any).processSettlement(settlement);

      expect(result).toBe('matched');
      expect(mockPdfQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: 'inv-001',
          transactionId: 'txn-001',
          settlementId: 'settlement-1',
        }),
        expect.any(Object)
      );
    });

    it('should return already_processed if invoice already completed', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce({
        id: 'inv-001',
        transactionId: 'txn-001',
        status: 'completed' as InvoiceStatus,
      });

      const settlement = mockSettlements[0];
      const result = await (service as any).processSettlement(settlement);

      expect(result).toBe('already_processed');
      expect(mockPdfQueue.add).not.toHaveBeenCalled();
    });

    it('should return no_match if no pending invoice found', async () => {
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(null) // Not already completed
        .mockResolvedValueOnce(null); // No pending invoice

      const settlement = mockSettlements[0];
      const result = await (service as any).processSettlement(settlement);

      expect(result).toBe('no_match');
      expect(mockPdfQueue.add).not.toHaveBeenCalled();
    });

    it('should add settlement to processed cache after matching', async () => {
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'inv-001',
          transactionId: 'txn-001',
          status: 'pending' as InvoiceStatus,
        });

      mockPrisma.invoice.update.mockResolvedValue({});

      await service.poll();

      expect(service.getProcessedCount()).toBeGreaterThan(0);
    });

    it('should skip already processed settlements from cache', async () => {
      // First call processes the settlement
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'inv-001',
          transactionId: 'txn-001',
          status: 'pending' as InvoiceStatus,
        });

      mockPrisma.invoice.update.mockResolvedValue({});

      // Process first settlement
      await (service as any).processSettlement(mockSettlements[0]);

      // Try to process same settlement again
      const result = await (service as any).processSettlement(mockSettlements[0]);

      expect(result).toBe('already_processed');
      // Should not query database again
      expect(mockPrisma.invoice.findFirst).toHaveBeenCalledTimes(2); // Called once in processSettlement but cache prevents database query
    });

    it('should update invoice status to processing', async () => {
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'inv-001',
          transactionId: 'txn-001',
          status: 'pending' as InvoiceStatus,
        });

      mockPrisma.invoice.update.mockResolvedValue({});

      await service.poll();

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-001' },
        data: { status: 'processing' },
      });
    });
  });

  describe('idempotency', () => {
    it('should not add duplicate jobs to queue for same settlement', async () => {
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(null) // Not already completed
        .mockResolvedValueOnce({    // Find pending invoice
          id: 'inv-001',
          transactionId: 'txn-001',
          status: 'pending' as InvoiceStatus,
        });

      mockPrisma.invoice.update.mockResolvedValue({});

      // First processing
      await (service as any).processSettlement(mockSettlements[0]);

      // Clear mocks and try again (should use cache)
      jest.clearAllMocks();
      
      // Second processing - should be skipped due to cache
      const result = await (service as any).processSettlement(mockSettlements[0]);

      expect(result).toBe('already_processed');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(0); // Should not access database
    });
  });

  describe('batch processing', () => {
    it('should process multiple settlements in a batch', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.invoice.findFirst
        .mockResolvedValue(null)  // First: not completed
        .mockResolvedValue({     // First: find pending
          id: 'inv-001',
          transactionId: 'txn-001',
          status: 'pending' as InvoiceStatus,
        })
        .mockResolvedValue(null)  // Second: not completed
        .mockResolvedValue({     // Second: find pending
          id: 'inv-002',
          transactionId: 'txn-002',
          status: 'pending' as InvoiceStatus,
        })
        .mockResolvedValue(null); // Third: not completed

      mockPrisma.invoice.update.mockResolvedValue({});

      await service.poll();

      expect(mockPdfQueue.add).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should log errors during settlement processing', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Database error'));

      const settlement = mockSettlements[0];

      await expect((service as any).processSettlement(settlement)).rejects.toThrow(
        SettlementPollerError
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process settlement',
        expect.objectContaining({
          transactionId: 'txn-001',
          settlementId: 'settlement-1',
        })
      );
    });

    it('should handle axios errors with response', async () => {
      const axiosError = new Error('Unauthorized') as any;
      axiosError.response = { status: 401 };
      axiosError.config = { url: '/list' };
      mockAxios.get.mockRejectedValue(axiosError);

      await expect(service.poll()).rejects.toThrow(PayAIApiError);
    });

    it('should log authentication errors', async () => {
      const axiosError = new Error('Unauthorized') as any;
      axiosError.response = { status: 401 };
      axiosError.config = { url: '/list' };
      mockAxios.get.mockRejectedValue(axiosError);

      try {
        await service.poll();
      } catch (e) {
        // Expected
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'PayAI API authentication failed - check API key'
      );
    });
  });

  describe('getPollCount', () => {
    it('should return 0 initially', () => {
      expect(service.getPollCount()).toBe(0);
    });

    it('should increment poll count', async () => {
      mockAxios.get.mockResolvedValue({ data: { settlements: [] } });

      await service.poll();

      expect(service.getPollCount()).toBe(1);
    });
  });

  describe('getProcessedCount', () => {
    it('should return 0 initially', () => {
      expect(service.getProcessedCount()).toBe(0);
    });

    it('should increment after processing settlements', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'inv-001',
          transactionId: 'txn-001',
          status: 'pending' as InvoiceStatus,
        });

      mockPrisma.invoice.update.mockResolvedValue({});

      await service.poll();

      expect(service.getProcessedCount()).toBe(1);
    });
  });

  describe('clearProcessedCache', () => {
    it('should clear the processed settlements cache', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'inv-001',
          transactionId: 'txn-001',
          status: 'pending' as InvoiceStatus,
        });

      mockPrisma.invoice.update.mockResolvedValue({});

      await service.poll();

      expect(service.getProcessedCount()).toBe(1);

      service.clearProcessedCache();

      expect(service.getProcessedCount()).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleared processed settlements cache'
      );
    });
  });

  describe('createSettlementPollerService factory', () => {
    it('should create a service instance', () => {
      const { createSettlementPollerService } = require('../../src/services/settlement-poller');
      
      const service = createSettlementPollerService(
        mockPrisma,
        mockPdfQueue,
        mockLogger,
        mockConfig
      );

      expect(service).toBeInstanceOf(SettlementPollerService);
    });
  });
});
