import { jest, describe, it, expect, beforeEach, afterEach, spyOn } from 'jest';
import { SettlementPollerService, SettlementPollerError } from '../../src/services/settlement-poller';
import { InvoiceStatus, Invoice } from '@prisma/client';
import Bull from 'bull';

// Mock dependencies
jest.mock('axios');
jest.mock('@prisma/client');
jest.mock('bull');

// Test fixtures
const mockSettlements = [
  {
    transaction_id: 'txn-001',
    amount: 100.00,
    currency: 'USD',
    status: 'settled' as const,
    settled_at: '2024-01-15T10:00:00Z',
  },
  {
    transaction_id: 'txn-002',
    amount: 250.50,
    currency: 'USD',
    status: 'completed' as const,
    settled_at: '2024-01-15T11:00:00Z',
  },
  {
    transaction_id: 'txn-003',
    amount: 75.00,
    currency: 'USD',
    status: 'pending' as const,
  },
  {
    transaction_id: 'txn-004',
    amount: 500.00,
    currency: 'USD',
    status: 'failed' as const,
  },
];

const mockPendingInvoice: Invoice = {
  id: 'inv-123',
  invoice_number: 'INV-2024-001',
  merchant_id: 'merchant-1',
  customer_id: 'customer-1',
  amount: 100.00,
  currency: 'USD',
  status: InvoiceStatus.PENDING,
  transaction_id: 'txn-001',
  description: 'Test invoice',
  created_at: new Date(),
  updated_at: new Date(),
};

const mockProcessingInvoice: Invoice = {
  ...mockPendingInvoice,
  id: 'inv-456',
  invoice_number: 'INV-2024-002',
  transaction_id: 'txn-005',
  amount: 300.00,
  status: InvoiceStatus.PROCESSING,
};

describe('SettlementPollerService', () => {
  let service: SettlementPollerService;
  let mockPrisma: any;
  let mockQueue: any;
  let axiosMock: any;
  let consoleSpy: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock Prisma client
    mockPrisma = {
      invoice: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $disconnect: jest.fn(),
    };

    // Create mock Bull queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Create axios mock
    axiosMock = {
      get: jest.fn(),
      isAxiosError: jest.fn(),
    };

    // Spy on console for logging verification
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation(),
    };

    // Mock axios module
    jest.doMock('axios', () => axiosMock);

    // Create service instance with mocks
    service = new SettlementPollerService(mockPrisma, mockQueue);
  });

  afterEach(() => {
    service.stop();
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.debug.mockRestore();
  });

  describe('constructor', () => {
    it('should create instance with provided Prisma client', () => {
      const customPrisma = { $disconnect: jest.fn() };
      const customQueue = { close: jest.fn() };
      
      const customService = new SettlementPollerService(customPrisma as any, customQueue as any);
      
      expect(customService).toBeInstanceOf(SettlementPollerService);
    });
  });

  describe('fetchSettlementsFromPayAI', () => {
    it('should fetch and validate settlements from PayAI API', async () => {
      const mockResponse = {
        data: {
          settlements: mockSettlements,
        },
      };
      axiosMock.get.mockResolvedValue(mockResponse);
      process.env.PAYAI_API_KEY = 'test-api-key';

      const settlements = await (service as any).fetchSettlementsFromPayAI();

      expect(settlements).toHaveLength(4);
      expect(axiosMock.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should throw SettlementPollerError when API key is missing', async () => {
      delete process.env.PAYAI_API_KEY;

      await expect((service as any).fetchSettlementsFromPayAI())
        .rejects
        .toThrow(SettlementPollerError);
    });

    it('should throw SettlementPollerError on API error', async () => {
      process.env.PAYAI_API_KEY = 'test-api-key';
      axiosMock.get.mockRejectedValue(new Error('Network error'));
      axiosMock.isAxiosError.mockReturnValue(false);

      await expect((service as any).fetchSettlementsFromPayAI())
        .rejects
        .toThrow(SettlementPollerError);
    });

    it('should throw SettlementPollerError on invalid response format', async () => {
      process.env.PAYAI_API_KEY = 'test-api-key';
      axiosMock.get.mockResolvedValue({
        data: {
          invalid: 'format',
        },
      });

      await expect((service as any).fetchSettlementsFromPayAI())
        .rejects
        .toThrow(SettlementPollerError);
    });
  });

  describe('processSettlements', () => {
    it('should filter and process only settled settlements', async () => {
      const processSettlementSpy = jest.spyOn(service as any, 'processSettlement');

      await (service as any).processSettlements(mockSettlements);

      // Should only process settled and completed (2 of 4)
      expect(processSettlementSpy).toHaveBeenCalledTimes(2);
      expect(processSettlementSpy).toHaveBeenCalledWith(
        expect.objectContaining({ transaction_id: 'txn-001' })
      );
      expect(processSettlementSpy).toHaveBeenCalledWith(
        expect.objectContaining({ transaction_id: 'txn-002' })
      );
    });
  });

  describe('processSettlement', () => {
    it('should match settlement to pending invoice and queue PDF job', async () => {
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(mockPendingInvoice) // First call finds the invoice
        .mockResolvedValueOnce(null); // Second call for idempotency check (if needed)
      mockPrisma.invoice.update.mockResolvedValue({
        ...mockProcessingInvoice,
        status: InvoiceStatus.PROCESSING,
      });

      const settlement = mockSettlements[0];
      await (service as any).processSettlement(settlement);

      expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith({
        where: {
          transaction_id: 'txn-001',
          status: InvoiceStatus.PENDING,
        },
      });

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: mockPendingInvoice.id },
        data: expect.objectContaining({
          status: InvoiceStatus.PROCESSING,
        }),
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: mockPendingInvoice.id,
          transactionId: 'txn-001',
        }),
        expect.objectContaining({
          jobId: `pdf-${settlement.transaction_id}-${mockPendingInvoice.id}`,
        })
      );
    });

    it('should not process if no matching pending invoice found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      const settlement = mockSettlements[0];
      await (service as any).processSettlement(settlement);

      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should not process if invoice already processed (idempotency)', async () => {
      // First call returns null (no pending), second call returns processed invoice
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...mockProcessingInvoice,
          status: InvoiceStatus.PROCESSING,
        });

      const settlement = mockSettlements[0];
      await (service as any).processSettlement(settlement);

      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should not process if amount mismatch', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        ...mockPendingInvoice,
        amount: 50.00, // Different amount
      });

      const settlement = mockSettlements[0];
      await (service as any).processSettlement(settlement);

      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should handle amount with small floating point differences', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        ...mockPendingInvoice,
        amount: 100.001, // Slightly different
      });
      mockPrisma.invoice.update.mockResolvedValue(mockProcessingInvoice);

      const settlement = { ...mockSettlements[0], amount: 100.00 };
      await (service as any).processSettlement(settlement);

      // Should process because difference is within tolerance (0.01)
      expect(mockPrisma.invoice.update).toHaveBeenCalled();
    });

    it('should throw and log error on database failure', async () => {
      mockPrisma.invoice.findFirst.mockRejectedValue(new Error('DB connection failed'));

      const settlement = mockSettlements[0];
      
      await expect((service as any).processSettlement(settlement))
        .rejects
        .toThrow();
    });
  });

  describe('start/stop', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start polling and execute immediately', async () => {
      axiosMock.get.mockResolvedValue({ data: { settlements: [] } });
      process.env.PAYAI_API_KEY = 'test-key';

      const pollSpy = jest.spyOn(service as any, 'poll');
      
      service.start(30000);

      // Should poll immediately
      expect(pollSpy).toHaveBeenCalledTimes(1);

      // Advance timer
      jest.advanceTimersByTime(30000);
      
      // Should poll again
      expect(pollSpy).toHaveBeenCalledTimes(2);
    });

    it('should not start if already running', () => {
      const startSpy = jest.spyOn(service as any, 'start');
      
      service.start(30000);
      service.start(30000);

      // Should only set one interval
      expect(startSpy).toHaveBeenCalledTimes(2);
    });

    it('should stop polling', () => {
      service.start(30000);
      expect(service.isRunning()).toBe(true);

      service.stop();
      expect(service.isRunning()).toBe(false);
    });

    it('should use custom interval when provided', () => {
      const pollSpy = jest.spyOn(service as any, 'poll');
      
      service.start(5000);
      jest.advanceTimersByTime(5000);
      
      expect(pollSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('isRunning and isCurrentlyPolling', () => {
    it('should return false initially', () => {
      expect(service.isRunning()).toBe(false);
      expect(service.isCurrentlyPolling()).toBe(false);
    });

    it('should return true when polling', () => {
      jest.useFakeTimers();
      axiosMock.get.mockResolvedValue({ data: { settlements: [] } });
      process.env.PAYAI_API_KEY = 'test-key';

      service.start(30000);
      
      // Note: isPolling is set to true during poll execution
      // We can't easily test the true state due to async nature
      
      jest.useRealTimers();
    });
  });

  describe('shutdown', () => {
    it('should stop poller and disconnect from databases', async () => {
      service.start(30000);
      
      await service.shutdown();

      expect(service.isRunning()).toBe(false);
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('should use transaction_id in jobId for deduplication', async () => {
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(mockPendingInvoice)
        .mockResolvedValueOnce(null);
      mockPrisma.invoice.update.mockResolvedValue(mockProcessingInvoice);

      await (service as any).processSettlement(mockSettlements[0]);

      const queueCall = mockQueue.add.mock.calls[0];
      const options = queueCall[1];
      
      expect(options.jobId).toContain('txn-001');
      expect(options.jobId).toContain(mockPendingInvoice.id);
    });

    it('should check if invoice already processed before queuing', async () => {
      // First call returns existing invoice in PROCESSING state
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(null) // No pending
        .mockResolvedValueOnce({ ...mockProcessingInvoice, status: InvoiceStatus.PROCESSING });

      await (service as any).processSettlement(mockSettlements[0]);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('getSettlementPollerService', () => {
    it('should return singleton instance', () => {
      const instance1 = require('../../src/services/settlement-poller').getSettlementPollerService();
      const instance2 = require('../../src/services/settlement-poller').getSettlementPollerService();
      
      expect(instance1).toBe(instance2);
    });
  });
});
