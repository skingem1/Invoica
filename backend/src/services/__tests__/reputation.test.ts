import { computeAndStoreReputation } from '../reputation';

// Variables starting with `mock` are exempt from Jest's hoisting TDZ check
let mockEq: jest.Mock;
let mockUpsert: jest.Mock;

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: (table: string) => {
      if (table === 'Invoice') {
        return { select: () => ({ eq: mockEq }) };
      }
      return { upsert: mockUpsert };
    },
  })),
}));

beforeEach(() => {
  mockEq = jest.fn().mockResolvedValue({ data: [], error: null });
  mockUpsert = jest.fn().mockResolvedValue({ error: null });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

function makeInvoices(completed: number, disputed: number, valueEach = '100') {
  const invoices = [];
  for (let i = 0; i < completed; i++) {
    invoices.push({ status: 'COMPLETED', amount: valueEach });
  }
  for (let i = 0; i < disputed; i++) {
    invoices.push({ status: 'REFUNDED', amount: '50' });
  }
  return invoices;
}

describe('computeAndStoreReputation()', () => {
  it('returns score 0 and tier "unrated" for agent with no invoices', async () => {
    mockEq.mockResolvedValue({ data: [], error: null });

    const result = await computeAndStoreReputation('agent-001');

    expect(result.score).toBe(0);
    expect(result.tier).toBe('unrated');
    expect(result.invoicesCompleted).toBe(0);
    expect(result.invoicesDisputed).toBe(0);
    expect(result.totalValueSettled).toBe(0);
  });

  it('calculates score correctly for 10 completed, $500 total value', async () => {
    // base = (10/10)*70 = 70, volumeBonus = min(500/10000*20,20) = 1,
    // countBonus = min(10/50*10,10) = 2, score = 73 → tier 'gold'
    mockEq.mockResolvedValue({ data: makeInvoices(10, 0, '50'), error: null });

    const result = await computeAndStoreReputation('agent-002');

    expect(result.invoicesCompleted).toBe(10);
    expect(result.invoicesDisputed).toBe(0);
    expect(result.score).toBe(73);
    expect(result.tier).toBe('gold');
  });

  it('handles mixed completed/disputed invoices', async () => {
    // 8 completed, 2 disputed: base = (8/10)*70 = 56,
    // countBonus ≈ 1.6, score = round(57.6) = 58 → tier 'silver'
    mockEq.mockResolvedValue({ data: makeInvoices(8, 2, '0'), error: null });

    const result = await computeAndStoreReputation('agent-003');

    expect(result.invoicesCompleted).toBe(8);
    expect(result.invoicesDisputed).toBe(2);
    expect(result.tier).toBe('silver');
  });

  it('assigns platinum tier for score >= 90', async () => {
    // 50 completed, $10000 total: base=70, volumeBonus=20, countBonus=10, score=100
    mockEq.mockResolvedValue({ data: makeInvoices(50, 0, '200'), error: null });

    const result = await computeAndStoreReputation('agent-004');

    expect(result.score).toBe(100);
    expect(result.tier).toBe('platinum');
  });

  it('assigns silver tier for score in 50–69', async () => {
    // 8 completed, 2 disputed, $0 total: score ≈ 58 → silver
    mockEq.mockResolvedValue({ data: makeInvoices(8, 2, '0'), error: null });

    const result = await computeAndStoreReputation('agent-005');

    expect(result.tier).toBe('silver');
  });

  it('assigns bronze tier for score in 25–49', async () => {
    // 5 completed, 5 disputed, $0: base=(5/10)*70=35, countBonus≈1, score=36 → bronze
    mockEq.mockResolvedValue({ data: makeInvoices(5, 5, '0'), error: null });

    const result = await computeAndStoreReputation('agent-006');

    expect(result.score).toBe(36);
    expect(result.tier).toBe('bronze');
  });

  it('assigns unrated tier for score < 25', async () => {
    // 1 completed, 10 disputed: base=(1/11)*70≈6.4, countBonus=0.2, score=7 → unrated
    mockEq.mockResolvedValue({ data: makeInvoices(1, 10, '0'), error: null });

    const result = await computeAndStoreReputation('agent-007');

    expect(result.score).toBeLessThan(25);
    expect(result.tier).toBe('unrated');
  });

  it('caps volume bonus at 20 (totalValueSettled $50000)', async () => {
    // $50000 settled: volumeBonus = min(50000/10000*20, 20) = 20
    mockEq.mockResolvedValue({
      data: [{ status: 'COMPLETED', amount: '50000' }],
      error: null,
    });

    const result = await computeAndStoreReputation('agent-008');

    expect(result.totalValueSettled).toBe(50000);
    // volumeBonus should be capped at 20, not 100
    // base=(1/1)*70=70, volumeBonus=20, countBonus=0.2 → score=90 → platinum
    expect(result.score).toBe(90);
    expect(result.tier).toBe('platinum');
  });

  it('caps count bonus at 10 (100 completed invoices)', async () => {
    // countBonus = min(100/50*10, 10) = 10 (capped)
    mockEq.mockResolvedValue({ data: makeInvoices(100, 0, '0'), error: null });

    const result = await computeAndStoreReputation('agent-009');

    // base=70, volumeBonus=0, countBonus=10 → score=80 → gold
    expect(result.score).toBe(80);
    expect(result.tier).toBe('gold');
  });

  it('SETTLED status counts as completed', async () => {
    mockEq.mockResolvedValue({
      data: [{ status: 'SETTLED', amount: '100' }],
      error: null,
    });

    const result = await computeAndStoreReputation('agent-010');

    expect(result.invoicesCompleted).toBe(1);
    expect(result.invoicesDisputed).toBe(0);
  });

  it('throws when Supabase Invoice query returns error', async () => {
    mockEq.mockResolvedValue({ data: null, error: new Error('DB connection failed') });

    await expect(computeAndStoreReputation('agent-err')).rejects.toThrow('DB connection failed');
  });

  it('calls upsert with correct agentId and onConflict', async () => {
    mockEq.mockResolvedValue({ data: [], error: null });

    await computeAndStoreReputation('agent-upsert');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-upsert', score: 0, tier: 'unrated' }),
      { onConflict: 'agentId' }
    );
  });
});
