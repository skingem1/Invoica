import {
  GetSettlementParams,
  SettlementStatus,
  WebhookEventType,
  Invoice,
  ApiResponse,
} from '../src/types';

describe('SDK Types', () => {
  describe('GetSettlementParams', () => {
    it('should create valid params with invoiceId', () => {
      const params: GetSettlementParams = { invoiceId: 'inv_123' };
      expect(params.invoiceId).toBe('inv_123');
    });
  });

  describe('SettlementStatus', () => {
    it('should accept all valid status values', () => {
      const statuses: SettlementStatus['status'][] = ['pending', 'confirmed', 'failed'];
      statuses.forEach((status) => {
        const settlement: SettlementStatus = {
          invoiceId: 'inv_123',
          status,
          txHash: status === 'pending' ? null : '0xabc',
          chain: 'ethereum',
          confirmedAt: status === 'confirmed' ? '2024-01-01' : null,
          amount: 1000,
          currency: 'USD',
        };
        expect(settlement.status).toBe(status);
      });
    });

    it('should handle null txHash for pending', () => {
      const settlement: SettlementStatus = {
        invoiceId: 'inv_123',
        status: 'pending',
        txHash: null,
        chain: 'polygon',
        confirmedAt: null,
        amount: 500,
        currency: 'USD',
      };
      expect(settlement.txHash).toBeNull();
      expect(settlement.confirmedAt).toBeNull();
    });
  });

  describe('WebhookEventType', () => {
    it('should accept all valid event types', () => {
      const eventTypes: WebhookEventType[] = [
        'invoice.created',
        'invoice.paid',
        'invoice.settled',
        'invoice.failed',
        'settlement.confirmed',
        'settlement.failed',
      ];
      eventTypes.forEach((type) => expect(type).toBeDefined());
    });
  });

  describe('ApiResponse', () => {
    it('should create successful response', () => {
      const response: ApiResponse<Invoice> = {
        data: { id: '1', number: 'INV-001', amount: 100, currency: 'USD', status: 'pending', createdAt: '', updatedAt: '' },
        success: true,
      };
      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();
    });

    it('should include error on failure', () => {
      const response: ApiResponse<Invoice> = {
        data: {} as Invoice,
        success: false,
        error: 'Not found',
      };
      expect(response.success).toBe(false);
      expect(response.error).toBe('Not found');
    });
  });
});