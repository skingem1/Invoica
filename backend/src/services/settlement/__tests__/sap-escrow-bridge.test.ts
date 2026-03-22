/**
 * Tests for SAP Escrow Bridge module
 * @module services/settlement/__tests__/sap-escrow-bridge.test
 */

import { detectSapEscrowSettlement, SapEscrowMatch, SAP_PROGRAM_ID, INVOICA_AGENT_WALLET } from '../sap-escrow-bridge';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('detectSapEscrowSettlement', () => {
  const validSig = '5x6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7';

  beforeEach(() => mockFetch.mockClear());

  it('returns null for non-SAP transaction', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          transaction: { message: { instructions: [{ programId: 'OtherProgram123', data: 'abc' }] } }
        }
      })
    });
    const result = await detectSapEscrowSettlement(validSig, 'https://api.mainnet-beta.solana.com');
    expect(result).toBeNull();
  });

  it('returns SapEscrowMatch for valid SAP settle instruction', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          transaction: {
            message: {
              instructions: [{
                programId: SAP_PROGRAM_ID,
                data: Buffer.from([0x0e, 0x32, 0x7a, 0xe5, 0x5d, 0xc5, 0x6d, 0x78, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).toString('base64')
              }]
            }
          },
          meta: { slot: 12345, blockTime: 1700000000 }
        }
      })
    });
    const result = await detectSapEscrowSettlement(validSig, 'https://api.mainnet-beta.solana.com');
    expect(result).not.toBeNull();
    expect((result as SapEscrowMatch).txSignature).toBe(validSig);
  });

  it('returns null on RPC error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('RPC unreachable'));
    const result = await detectSapEscrowSettlement(validSig, 'https://bad-rpc.com');
    expect(result).toBeNull();
  });
});