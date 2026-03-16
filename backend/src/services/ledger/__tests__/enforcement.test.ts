import { BudgetLevel, BudgetCheckResult } from '../types';

jest.mock('../budget', () => ({
  checkBudget: jest.fn(),
  getBudget: jest.fn(),
  createBudgetReservation: jest.fn(),
  cancelBudgetReservation: jest.fn(),
  consumeBudgetReservation: jest.fn(),
  updateSpentAmount: jest.fn(),
}));

jest.mock('../config', () => ({
  getLedgerConfig: jest.fn(() => ({ reservationExpirySeconds: 60 })),
}));

import {
  checkHierarchicalBudget,
  reserveBudget,
  spendFromReservation,
  directSpend,
  releaseReservation,
  getActiveReservations,
  getAgentReservations,
} from '../enforcement';
import * as budgetMod from '../budget';

const mockDb = {} as any;

function allowedCheck(level: BudgetLevel, overrides: Partial<BudgetCheckResult> = {}): BudgetCheckResult {
  return { allowed: true, level, budget_id: `bid-${level}`, remaining: 500, spent: 100, reserved: 50, total: 650, ...overrides };
}
function deniedCheck(level: BudgetLevel, reason: string): BudgetCheckResult {
  return { allowed: false, level, budget_id: `bid-${level}`, remaining: 0, spent: 500, reserved: 50, total: 550, reasons: [reason] };
}

beforeEach(() => jest.clearAllMocks());

describe('checkHierarchicalBudget', () => {
  it('returns allowed when all levels pass', async () => {
    (budgetMod.checkBudget as jest.Mock)
      .mockResolvedValueOnce(allowedCheck(BudgetLevel.DEPARTMENT))
      .mockResolvedValueOnce(allowedCheck(BudgetLevel.TEAM))
      .mockResolvedValueOnce(allowedCheck(BudgetLevel.AGENT));

    const result = await checkHierarchicalBudget(mockDb, { department_id: 'd1', team_id: 't1', agent_id: 'a1' }, 100);
    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('returns denied when department budget exceeded', async () => {
    (budgetMod.checkBudget as jest.Mock)
      .mockResolvedValueOnce(deniedCheck(BudgetLevel.DEPARTMENT, 'Over limit'))
      .mockResolvedValueOnce(allowedCheck(BudgetLevel.TEAM))
      .mockResolvedValueOnce(allowedCheck(BudgetLevel.AGENT));

    const result = await checkHierarchicalBudget(mockDb, { department_id: 'd1', team_id: 't1', agent_id: 'a1' }, 100);
    expect(result.allowed).toBe(false);
    expect(result.reasons[0]).toMatch(/department/i);
  });

  it('returns denied when team budget exceeded', async () => {
    (budgetMod.checkBudget as jest.Mock)
      .mockResolvedValueOnce(allowedCheck(BudgetLevel.DEPARTMENT))
      .mockResolvedValueOnce(deniedCheck(BudgetLevel.TEAM, 'Team over limit'))
      .mockResolvedValueOnce(allowedCheck(BudgetLevel.AGENT));

    const result = await checkHierarchicalBudget(mockDb, { department_id: 'd1', team_id: 't1', agent_id: 'a1' }, 100);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((r) => /team/i.test(r))).toBe(true);
  });

  it('returns denied when agent budget exceeded', async () => {
    (budgetMod.checkBudget as jest.Mock)
      .mockResolvedValueOnce(allowedCheck(BudgetLevel.DEPARTMENT))
      .mockResolvedValueOnce(allowedCheck(BudgetLevel.TEAM))
      .mockResolvedValueOnce(deniedCheck(BudgetLevel.AGENT, 'Agent over limit'));

    const result = await checkHierarchicalBudget(mockDb, { department_id: 'd1', team_id: 't1', agent_id: 'a1' }, 100);
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((r) => /agent/i.test(r))).toBe(true);
  });

  it('skips specified levels when skipLevels provided', async () => {
    (budgetMod.checkBudget as jest.Mock).mockResolvedValueOnce(allowedCheck(BudgetLevel.AGENT));

    const result = await checkHierarchicalBudget(
      mockDb,
      { department_id: 'd1', team_id: 't1', agent_id: 'a1' },
      100,
      [BudgetLevel.DEPARTMENT, BudgetLevel.TEAM]
    );
    expect(result.allowed).toBe(true);
    expect(budgetMod.checkBudget).toHaveBeenCalledTimes(1);
    expect((budgetMod.checkBudget as jest.Mock).mock.calls[0][1]).toBe(BudgetLevel.AGENT);
  });

  it('returns not allowed with no budgets found when hierarchy is empty', async () => {
    const result = await checkHierarchicalBudget(mockDb, {}, 100);
    expect(result.allowed).toBe(false);
    expect(result.reasons[0]).toMatch(/no budgets found/i);
  });
});

describe('reserveBudget', () => {
  it('creates reservation when hierarchy check passes', async () => {
    (budgetMod.checkBudget as jest.Mock).mockResolvedValue(allowedCheck(BudgetLevel.AGENT));
    (budgetMod.getBudget as jest.Mock).mockResolvedValue({ id: 'bid-agent', version: 1 });
    (budgetMod.createBudgetReservation as jest.Mock).mockResolvedValue({ id: 'res-1', amount: 100 });

    const result = await reserveBudget(mockDb, { agent_id: 'a1' }, 100, 'agent-001');
    expect(result).toEqual({ id: 'res-1', amount: 100 });
    expect(budgetMod.createBudgetReservation).toHaveBeenCalled();
  });

  it('throws when hierarchy check fails', async () => {
    (budgetMod.checkBudget as jest.Mock).mockResolvedValue(deniedCheck(BudgetLevel.AGENT, 'Limit exceeded'));

    await expect(reserveBudget(mockDb, { agent_id: 'a1' }, 100, 'agent-001')).rejects.toThrow(/denied/);
  });
});

describe('releaseReservation', () => {
  it('calls cancelBudgetReservation with correct reservationId', async () => {
    (budgetMod.cancelBudgetReservation as jest.Mock).mockResolvedValue(undefined);

    await releaseReservation(mockDb, 'res-42');
    expect(budgetMod.cancelBudgetReservation).toHaveBeenCalledWith(mockDb, 'res-42');
  });
});

describe('getActiveReservations', () => {
  it('queries budget_reservations and returns rows', async () => {
    const rows = [{ id: 'res-1', budget_id: 'bid-1', amount: 50 }];
    const mockQueryDb = { query: jest.fn().mockResolvedValue({ rows }) };

    const result = await getActiveReservations(mockQueryDb as any, 'bid-1');
    expect(result).toEqual(rows);
    expect(mockQueryDb.query).toHaveBeenCalledWith(expect.any(String), ['bid-1']);
  });
});

describe('getAgentReservations', () => {
  it('queries budget_reservations by agent and returns rows', async () => {
    const rows = [{ id: 'res-5', agent_id: 'agent-7', amount: 75 }];
    const mockQueryDb = { query: jest.fn().mockResolvedValue({ rows }) };

    const result = await getAgentReservations(mockQueryDb as any, 'agent-7');
    expect(result).toEqual(rows);
    expect(mockQueryDb.query).toHaveBeenCalledWith(expect.any(String), ['agent-7']);
  });
});

describe('directSpend', () => {
  it('calls updateSpentAmount when check passes', async () => {
    (budgetMod.checkBudget as jest.Mock).mockResolvedValue(allowedCheck(BudgetLevel.AGENT));
    const mockBudget = { id: 'bid-a', version: 2 };
    (budgetMod.getBudget as jest.Mock).mockResolvedValue(mockBudget);
    (budgetMod.updateSpentAmount as jest.Mock).mockResolvedValue(mockBudget);

    const result = await directSpend(mockDb, { agent_id: 'a1' }, 50, 'test purchase');
    expect(budgetMod.updateSpentAmount).toHaveBeenCalledWith(mockDb, 'bid-a', 50, 2);
    expect(result).toEqual(mockBudget);
  });

  it('throws when check fails', async () => {
    (budgetMod.checkBudget as jest.Mock).mockResolvedValue(deniedCheck(BudgetLevel.AGENT, 'Over budget'));

    await expect(directSpend(mockDb, { agent_id: 'a1' }, 999, 'big purchase')).rejects.toThrow(/denied/);
  });
});
