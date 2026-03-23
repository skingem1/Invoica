import { checkTrustGate } from '../trust-gate';
import * as helixa from '../../lib/helixa';

jest.mock('../../lib/helixa');
const mockFetch = helixa.fetchHelixaScore as jest.MockedFunction<typeof helixa.fetchHelixaScore>;

describe('checkTrustGate', () => {
  afterEach(() => jest.resetAllMocks());

  it('auto-tier-for-score-51-plus (Qualified threshold)', async () => {
    mockFetch.mockResolvedValue(55);
    const result = await checkTrustGate('0xABC');
    expect(result.tier).toBe('auto');
    expect(result.allowed).toBe(true);
    expect(result.score).toBe(55);
  });

  it('hold-tier-for-score-26-to-50 (Marginal)', async () => {
    mockFetch.mockResolvedValue(40);
    const result = await checkTrustGate('0xABC');
    expect(result.tier).toBe('hold');
    expect(result.allowed).toBe(true);
  });

  it('rejected-tier-for-score-0-to-25 (Junk)', async () => {
    mockFetch.mockResolvedValue(15);
    const result = await checkTrustGate('0xABC');
    expect(result.tier).toBe('rejected');
    expect(result.allowed).toBe(false);
  });

  it('auto-tier-when-helixa-unavailable (graceful fallback — treat as Marginal)', async () => {
    mockFetch.mockResolvedValue(null);
    const result = await checkTrustGate('0xABC');
    expect(result.tier).toBe('hold');
    expect(result.allowed).toBe(true);
    expect(result.score).toBeNull();
  });

  it('invoice-creation-blocked-for-junk-agent (score=15)', async () => {
    mockFetch.mockResolvedValue(15);
    const result = await checkTrustGate('0xJUNK');
    expect(result.allowed).toBe(false);
    expect(result.tier).toBe('rejected');
  });

  it('invoice-creation-allowed-for-qualified-agent (score=55)', async () => {
    mockFetch.mockResolvedValue(55);
    const result = await checkTrustGate('0xQUAL');
    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('auto');
  });
});
