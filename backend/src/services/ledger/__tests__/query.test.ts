import {
  queryLedgerEntries,
  getAccountBalance,
  getAccountBalances,
  getAccount,
  getAccountsByType,
  getAccountsByHierarchy,
  getTransactionEntries,
  getTimeSeriesBalances,
  getAccountStats,
  createAccount,
  getEntriesGroupedByAccount,
} from '../query';
import { EntryDirection, AccountType } from '../types';

function mockDb(rows: any[] = []) {
  return { query: jest.fn().mockResolvedValue({ rows }) };
}

const NOW = new Date('2026-01-01T00:00:00Z');

describe('queryLedgerEntries()', () => {
  it('queries without filters and returns rows', async () => {
    const entry = { id: 'e1', account_id: 'a1', direction: EntryDirection.DEBIT };
    const db = mockDb([entry]);

    const result = await queryLedgerEntries(db as any, {});

    expect(result).toEqual([entry]);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('includes account_id filter in query', async () => {
    const db = mockDb([]);
    await queryLedgerEntries(db as any, { account_id: 'acct-001' });

    const sql: string = db.query.mock.calls[0][0];
    expect(sql).toContain('le.account_id');
    expect(db.query.mock.calls[0][1]).toContain('acct-001');
  });

  it('adds JOIN when agent_id filter is present', async () => {
    const db = mockDb([]);
    await queryLedgerEntries(db as any, { agent_id: 'ag-1' });

    const sql: string = db.query.mock.calls[0][0];
    expect(sql).toContain('JOIN accounts');
  });

  it('does not JOIN when only account_id filter is used', async () => {
    const db = mockDb([]);
    await queryLedgerEntries(db as any, { account_id: 'a1' });

    const sql: string = db.query.mock.calls[0][0];
    expect(sql).not.toContain('JOIN accounts');
  });

  it('appends LIMIT and OFFSET when provided', async () => {
    const db = mockDb([]);
    await queryLedgerEntries(db as any, { limit: 10, offset: 20 });

    const sql: string = db.query.mock.calls[0][0];
    expect(sql).toContain('LIMIT');
    expect(sql).toContain('OFFSET');
  });
});

describe('getAccountBalance()', () => {
  it('returns BalanceResult with parsed integer balance', async () => {
    const db = mockDb([{ balance: '500', currency: 'USD' }]);

    const result = await getAccountBalance(db as any, 'acct-001', NOW);

    expect(result.account_id).toBe('acct-001');
    expect(result.balance).toBe(500);
    expect(result.currency).toBe('USD');
    expect(result.as_of).toBe(NOW);
  });
});

describe('getAccountBalances()', () => {
  it('returns empty array for empty accountIds input', async () => {
    const db = mockDb([]);
    const result = await getAccountBalances(db as any, []);
    expect(result).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns mapped BalanceResult array', async () => {
    const db = mockDb([
      { account_id: 'a1', balance: '200', currency: 'USD' },
      { account_id: 'a2', balance: '300', currency: 'USD' },
    ]);

    const result = await getAccountBalances(db as any, ['a1', 'a2'], NOW);

    expect(result).toHaveLength(2);
    expect(result[0].balance).toBe(200);
    expect(result[1].balance).toBe(300);
  });
});

describe('getAccount()', () => {
  it('returns Account when found', async () => {
    const account = { id: 'a1', name: 'Main', type: AccountType.ASSET };
    const db = mockDb([account]);

    const result = await getAccount(db as any, 'a1');
    expect(result).toEqual(account);
  });

  it('returns null when not found', async () => {
    const db = mockDb([]);
    const result = await getAccount(db as any, 'missing');
    expect(result).toBeNull();
  });
});

describe('getAccountsByType()', () => {
  it('returns accounts filtered by type', async () => {
    const db = mockDb([{ id: 'a1', type: AccountType.REVENUE }]);
    const result = await getAccountsByType(db as any, AccountType.REVENUE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(AccountType.REVENUE);
  });
});

describe('getAccountsByHierarchy()', () => {
  it('queries all accounts when no hierarchy provided', async () => {
    const db = mockDb([]);
    await getAccountsByHierarchy(db as any, {});

    const sql: string = db.query.mock.calls[0][0];
    expect(sql).not.toContain('WHERE');
  });

  it('adds WHERE clause when agent_id provided', async () => {
    const db = mockDb([]);
    await getAccountsByHierarchy(db as any, { agent_id: 'ag-1' });

    const sql: string = db.query.mock.calls[0][0];
    expect(sql).toContain('WHERE');
  });
});

describe('getTransactionEntries()', () => {
  it('returns entries for a transaction', async () => {
    const entry = { id: 'e1', transaction_id: 'txn-001' };
    const db = mockDb([entry]);

    const result = await getTransactionEntries(db as any, 'txn-001');
    expect(result).toEqual([entry]);
  });
});

describe('getTimeSeriesBalances()', () => {
  it('returns parsed time-series rows', async () => {
    const ts = new Date('2026-01-01');
    const db = mockDb([{ time_bucket: ts, balance: '1500' }]);

    const result = await getTimeSeriesBalances(db as any, 'a1', new Date(), new Date());

    expect(result[0].time_bucket).toBe(ts);
    expect(result[0].balance).toBe(1500);
  });
});

describe('getAccountStats()', () => {
  it('returns parsed aggregate stats', async () => {
    const db = mockDb([{
      total_debits: '1000', total_credits: '800',
      transaction_count: '5', average_amount: '200',
    }]);

    const result = await getAccountStats(db as any, 'a1');

    expect(result.total_debits).toBe(1000);
    expect(result.total_credits).toBe(800);
    expect(result.transaction_count).toBe(5);
    expect(result.average_amount).toBe(200);
  });
});

describe('createAccount()', () => {
  it('returns the created account', async () => {
    const created = { id: 'new-1', name: 'Receivables', type: AccountType.ASSET };
    const db = mockDb([created]);

    const result = await createAccount(db as any, 'Receivables', AccountType.ASSET);
    expect(result).toEqual(created);
  });
});

describe('getEntriesGroupedByAccount()', () => {
  it('groups entries by account_id', async () => {
    const db = mockDb([
      { account_id: 'a1', id: 'e1' },
      { account_id: 'a2', id: 'e2' },
      { account_id: 'a1', id: 'e3' },
    ]);

    const result = await getEntriesGroupedByAccount(db as any, {});

    expect(result.get('a1')).toHaveLength(2);
    expect(result.get('a2')).toHaveLength(1);
  });

  it('returns empty Map when no entries', async () => {
    const db = mockDb([]);
    const result = await getEntriesGroupedByAccount(db as any, {});
    expect(result.size).toBe(0);
  });
});
