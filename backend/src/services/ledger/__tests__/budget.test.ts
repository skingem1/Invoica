import {
  getBudget,
  checkBudget,
  createBudgetReservation,
  cancelBudgetReservation,
  consumeBudgetReservation,
  cleanupExpiredReservations,
  createBudget,
} from '../budget';
import { BudgetLevel, Budget } from '../types';

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-001',
    level: BudgetLevel.AGENT,
    level_id: 'agent-001',
    total_amount: 10000,
    spent_amount: 0,
    reserved_amount: 0,
    currency: 'USD',
    period_start: new Date('2026-01-01'),
    period_end: new Date('2026-12-31'),
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeMockDb(responses: any[] = []) {
  const queue = [...responses];
  return {
    query: jest.fn().mockImplementation(() => {
      if (queue.length > 0) {
        const next = queue.shift();
        return Promise.resolve(next);
      }
      return Promise.resolve({ rows: [] });
    }),
  };
}

// ---- getBudget ----

describe('getBudget()', () => {
  it('returns budget when found', async () => {
    const budget = makeBudget();
    const db = makeMockDb([{ rows: [budget] }]);

    const result = await getBudget(db as any, BudgetLevel.AGENT, 'agent-001');

    expect(result).toEqual(budget);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('returns null when budget not found', async () => {
    const db = makeMockDb([{ rows: [] }]);
    const result = await getBudget(db as any, BudgetLevel.AGENT, 'agent-missing');
    expect(result).toBeNull();
  });
});

// ---- checkBudget ----

describe('checkBudget()', () => {
  it('returns not-allowed with reasons when no budget exists', async () => {
    const db = makeMockDb([{ rows: [] }]);
    const result = await checkBudget(db as any, BudgetLevel.AGENT, 'agent-x', 100);

    expect(result.allowed).toBe(false);
    expect(result.total).toBe(0);
    expect(result.reasons).toBeDefined();
    expect(result.reasons!.length).toBeGreaterThan(0);
  });

  it('returns allowed when amount is within budget', async () => {
    const budget = makeBudget({ total_amount: 1000, spent_amount: 0, reserved_amount: 0 });
    const db = makeMockDb([{ rows: [budget] }]);

    const result = await checkBudget(db as any, BudgetLevel.AGENT, 'agent-001', 500);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1000);
    expect(result.reasons).toBeUndefined();
  });

  it('returns not-allowed when amount exceeds available', async () => {
    const budget = makeBudget({ total_amount: 1000, spent_amount: 800, reserved_amount: 100 });
    const db = makeMockDb([{ rows: [budget] }]);

    const result = await checkBudget(db as any, BudgetLevel.AGENT, 'agent-001', 200);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(100);
    expect(result.reasons).toBeDefined();
  });
});

// ---- createBudgetReservation ----

describe('createBudgetReservation()', () => {
  it('returns a reservation with correct fields', async () => {
    const db = makeMockDb([{ rows: [] }, { rows: [] }]); // UPDATE + INSERT

    const result = await createBudgetReservation(db as any, 'budget-001', 500, 'agent-001', 'USD');

    expect(result.budget_id).toBe('budget-001');
    expect(result.amount).toBe(500);
    expect(result.agent_id).toBe('agent-001');
    expect(result.currency).toBe('USD');
    expect(result.id).toBeDefined();
    expect(result.expires_at).toBeInstanceOf(Date);
  });
});

// ---- cancelBudgetReservation ----

describe('cancelBudgetReservation()', () => {
  it('resolves when reservation exists', async () => {
    const reservation = { id: 'res-001', budget_id: 'budget-001', amount: 100 };
    const db = makeMockDb([
      { rows: [reservation] }, // SELECT
      { rows: [] },            // UPDATE budget
      { rows: [] },            // DELETE reservation
    ]);

    await expect(cancelBudgetReservation(db as any, 'res-001')).resolves.toBeUndefined();
  });

  it('throws when reservation not found', async () => {
    const db = makeMockDb([{ rows: [] }]);
    await expect(cancelBudgetReservation(db as any, 'res-missing')).rejects.toThrow('not found');
  });
});

// ---- consumeBudgetReservation ----

describe('consumeBudgetReservation()', () => {
  it('throws when reservation not found', async () => {
    const db = makeMockDb([{ rows: [] }]);
    await expect(consumeBudgetReservation(db as any, 'res-missing')).rejects.toThrow('not found');
  });
});

// ---- cleanupExpiredReservations ----

describe('cleanupExpiredReservations()', () => {
  it('returns 0 when no expired reservations', async () => {
    const db = makeMockDb([{ rows: [] }]);
    const count = await cleanupExpiredReservations(db as any);
    expect(count).toBe(0);
  });

  it('returns count of cleaned reservations', async () => {
    const expired = [
      { id: 'r1', budget_id: 'b1', amount: 100 },
      { id: 'r2', budget_id: 'b1', amount: 50 },
    ];
    const db = makeMockDb([
      { rows: expired }, // SELECT expired
      { rows: [] },      // UPDATE budget b1
      { rows: [] },      // DELETE
    ]);

    const count = await cleanupExpiredReservations(db as any);
    expect(count).toBe(2);
  });
});

// ---- createBudget ----

describe('createBudget()', () => {
  it('inserts budget and returns created record', async () => {
    const created = makeBudget();
    const db = makeMockDb([{ rows: [created] }]);

    const result = await createBudget(
      db as any,
      BudgetLevel.AGENT,
      'agent-001',
      10000,
      'USD',
      new Date('2026-01-01'),
      new Date('2026-12-31')
    );

    expect(result).toEqual(created);
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
