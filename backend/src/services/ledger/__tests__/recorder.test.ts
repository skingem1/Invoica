import {
  validateBalancedTransaction,
  generateTransactionId,
  recordTransaction,
  isTransactionIdempotent,
} from '../recorder';
import { EntryDirection, TransactionEntry, Transaction } from '../types';

// ---- helpers ----

function makeEntry(direction: EntryDirection, amount: number): TransactionEntry {
  return { account_id: 'acct-1', direction, amount, currency: 'USD' };
}

function makeTransaction(entries: TransactionEntry[]): Transaction {
  return {
    id: 'txn-test',
    description: 'test',
    entries,
    created_at: new Date(),
  };
}

function makeMockClient() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [{ balance: '0' }] }),
    release: jest.fn(),
  };
}

// ---- validateBalancedTransaction ----

describe('validateBalancedTransaction()', () => {
  it('throws on empty entries array', () => {
    expect(() => validateBalancedTransaction([])).toThrow('at least one entry');
  });

  it('throws when debits do not equal credits', () => {
    const entries = [
      makeEntry(EntryDirection.DEBIT, 100),
      makeEntry(EntryDirection.CREDIT, 50),
    ];
    expect(() => validateBalancedTransaction(entries)).toThrow('not balanced');
  });

  it('passes for balanced debit + credit', () => {
    const entries = [
      { account_id: 'a', direction: EntryDirection.DEBIT, amount: 100, currency: 'USD' },
      { account_id: 'b', direction: EntryDirection.CREDIT, amount: 100, currency: 'USD' },
    ];
    expect(() => validateBalancedTransaction(entries)).not.toThrow();
  });

  it('throws for zero or negative amount', () => {
    const entries = [
      makeEntry(EntryDirection.DEBIT, 0),
      makeEntry(EntryDirection.CREDIT, 0),
    ];
    expect(() => validateBalancedTransaction(entries)).toThrow('positive');
  });

  it('throws for negative amount', () => {
    expect(() => validateBalancedTransaction([makeEntry(EntryDirection.DEBIT, -50)])).toThrow();
  });

  it('passes for multiple balanced entries', () => {
    const entries = [
      { account_id: 'a', direction: EntryDirection.DEBIT, amount: 300, currency: 'USD' },
      { account_id: 'b', direction: EntryDirection.CREDIT, amount: 200, currency: 'USD' },
      { account_id: 'c', direction: EntryDirection.CREDIT, amount: 100, currency: 'USD' },
    ];
    expect(() => validateBalancedTransaction(entries)).not.toThrow();
  });
});

// ---- generateTransactionId ----

describe('generateTransactionId()', () => {
  it('returns a non-empty string', () => {
    const id = generateTransactionId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates unique IDs on each call', () => {
    const id1 = generateTransactionId();
    const id2 = generateTransactionId();
    expect(id1).not.toBe(id2);
  });
});

// ---- recordTransaction ----

describe('recordTransaction()', () => {
  it('returns RecordingResult with transaction_id and entries', async () => {
    const mockClient = makeMockClient();
    const entries = [
      { account_id: 'acc-a', direction: EntryDirection.DEBIT, amount: 100, currency: 'USD' },
      { account_id: 'acc-b', direction: EntryDirection.CREDIT, amount: 100, currency: 'USD' },
    ];
    const txn = makeTransaction(entries);

    const result = await recordTransaction({} as any, txn, mockClient as any);

    expect(result.transaction_id).toBe('txn-test');
    expect(result.entries).toHaveLength(2);
    expect(result.recorded_at).toBeInstanceOf(Date);
  });

  it('rolls back and rethrows on DB error', async () => {
    const mockClient = makeMockClient();
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ balance: '0' }] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ balance: '0' }] }) // balance query acc-a
      .mockRejectedValueOnce(new Error('insert failed'));  // INSERT error

    const entries = [
      { account_id: 'acc-a', direction: EntryDirection.DEBIT, amount: 50, currency: 'USD' },
      { account_id: 'acc-b', direction: EntryDirection.CREDIT, amount: 50, currency: 'USD' },
    ];

    await expect(
      recordTransaction({} as any, makeTransaction(entries), mockClient as any)
    ).rejects.toThrow('insert failed');
  });
});

// ---- isTransactionIdempotent ----

describe('isTransactionIdempotent()', () => {
  it('returns null when no matching transaction found', async () => {
    const mockDb = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const result = await isTransactionIdempotent(mockDb as any, 'idem-key-123');
    expect(result).toBeNull();
  });
});
