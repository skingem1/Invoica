import { ChainConfig } from '../../lib/chain-registry';

/**
 * USDC SPL Token address on Solana mainnet
 */
export const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/**
 * Token Program address for SPL tokens
 */
export const SOLANA_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

/**
 * Associated Token Program address
 */
export const SOLANA_ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

/**
 * Memo Program address for on-chain memos
 */
export const SOLANA_MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

/**
 * Represents a matched settlement from Solana chain
 */
export interface SettlementMatch {
  txHash: string;
  blockNumber: number;
  blockTimestamp: number;
  from: string;
  to: string;
  amount: string;
  token: string;
  chainId: string;
  invoiceId?: string;
  memo?: string;
  confirmed: boolean;
}

/**
 * Parsed SPL token transfer instruction
 */
interface TokenInstruction {
  program: string;
  programId: string;
  accounts: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: string;
}

/**
 * Parsed memo instruction
 */
interface MemoInstruction {
  program: string;
  programId: string;
  data: string;
}

/**
 * JSON-RPC response for getSignaturesForAddress
 */
interface GetSignaturesResponse {
  jsonrpc: string;
  id: number;
  result: Array<{
    signature: string;
    slot: number;
    blockTime: number | null;
    confirmationStatus: string;
  }>;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * JSON-RPC response for getTransaction
 */
interface GetTransactionResponse {
  jsonrpc: string;
  id: number;
  result: {
    slot: number;
    transaction: {
      message: {
        header: {
          numRequiredSignatures: number;
          numReadonlySignedAccounts: number;
          numReadonlyUnsignedAccounts: number;
        };
        accountKeys: Array<{
          pubkey: string;
          signer: boolean;
          writable: boolean;
        }>;
        recentBlockhash: string;
        instructions: Array<TokenInstruction | MemoInstruction>;
      };
      signatures: string[];
    };
    meta: {
      fee: number;
      preBalances: number[];
      postBalances: number[];
      preTokenBalances: Array<{
        mint: string;
        owner: string;
        amount: string;
        decimals: number;
      }>;
      postTokenBalances: Array<{
        mint: string;
        owner: string;
        amount: string;
        decimals: number;
      }>;
      logMessages: string[];
      err: null | object;
      status: { Ok: null } | { Err: object };
    };
    blockTime: number | null;
  } | null;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Solana settlement detector for USDC SPL token transfers.
 * Uses raw JSON-RPC calls to detect and verify settlements on Solana mainnet.
 */
export class SolanaSettlementDetector {
  private readonly rpcUrl: string;
  private requestId = 0;

  /**
   * Creates a new SolanaSettlementDetector instance.
   * @param chain - Chain configuration containing RPC URL and chain ID
   */
  constructor(private chain: ChainConfig) {
    if (!chain.rpcUrl) {
      throw new Error('RPC URL is required for Solana settlement detection');
    }
    this.rpcUrl = chain.rpcUrl;
  }

  /**
   * Makes a JSON-RPC request to the Solana RPC endpoint.
   * @param method - RPC method name
   * @param params - Method parameters
   */
  private async rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const id = ++this.requestId;
    
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`RPC request failed: HTTP ${response.status}`);
    }

    const result = await response.json() as { error?: { message: string } };
    
    if (result.error) {
      throw new Error(`RPC error: ${result.error.message}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Validates a base58 encoded Solana address.
   * @param address - Address to validate
   */
  private isValidAddress(address: string): boolean {
    // Basic validation: addresses should be 32-44 characters
    // Solana uses base58 encoding
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  }

  /**
   * Parses an instruction to find SPL token transfers.
   * @param instruction - Parsed instruction object
   * @param meta - Transaction metadata with token balances
   */
  private parseTokenTransfer(
    instruction: TokenInstruction,
    meta: GetTransactionResponse['result']['meta'],
    accountKeys: GetTransactionResponse['result']['transaction']['message']['accountKeys']
  ): { from: string; to: string; amount: string; mint: string } | null {
    // Check if this is a transfer instruction
    const instructionType = (instruction as { type?: string }).type;
    
    if (instructionType !== 'transfer' && instructionType !== 'transferChecked') {
      return null;
    }

    // Get accounts involved in the transfer
    const accounts = instruction.accounts;
    
    if (accounts.length < 4) {
      return null;
    }

    // For transfer: source, destination, authority
    // For transferChecked: source, mint, destination, authority
    const source = accounts[0]?.pubkey;
    const destination = accounts[2]?.pubkey;
    
    if (!source || !destination) {
      return null;
    }

    // Get mint from token balances or instruction
    let mint = SOLANA_USDC_MINT;
    
    // Try to get mint from postTokenBalances
    if (meta.postTokenBalances && meta.postTokenBalances.length > 0) {
      const relevantBalance = meta.postTokenBalances.find(b => b.owner === destination);
      if (relevantBalance) {
        mint = relevantBalance.mint;
      }
    }

    // Get amount from postTokenBalances (most reliable)
    let amount = '0';
    if (meta.postTokenBalances && meta.postTokenBalances.length > 0) {
      const destBalance = meta.postTokenBalances.find(b => b.owner === destination);
      const srcBalance = meta.postTokenBalances.find(b => b.owner === source);
      
      if (destBalance) {
        amount = destBalance.amount;
      } else if (srcBalance) {
        // Calculate transfer amount from difference
        const preBalance = meta.preTokenBalances?.find(b => b.owner === source);
        if (preBalance) {
          const preAmount = BigInt(preBalance.amount);
          const postAmount = BigInt(srcBalance.amount);
          if (preAmount > postAmount) {
            amount = (preAmount - postAmount).toString();
          }
        }
      }
    }

    return { from: source, to: destination, amount, mint };
  }

  /**
   * Checks if an instruction is a memo instruction.
   * @param instruction - Parsed instruction object
   */
  private isMemoInstruction(instruction: TokenInstruction | MemoInstruction): instruction is MemoInstruction {
    return instruction.programId === SOLANA_MEMO_PROGRAM || instruction.program === 'memo';
  }

  /**
   * Extracts memo data from a transaction.
   * @param tx - Parsed transaction response
   */
  private extractMemoFromTransaction(tx: GetTransactionResponse['result']): string | null {
    if (!tx?.transaction?.message?.instructions) {
      return null;
    }

    for (const instruction of tx.transaction.message.instructions) {
      if (this.isMemoInstruction(instruction)) {
        // Memo data is base64 encoded
        try {
          const decoded = Buffer.from(instruction.data, 'base64').toString('utf-8');
          return decoded;
        } catch {
          // If not valid base64, might be raw string
          return instruction.data;
        }
      }
    }

    return null;
  }

  /**
   * Get recent SPL token transfers for a wallet address.
   * Uses getSignaturesForAddress + getTransaction RPC calls.
   * @param walletAddress - Base58 Solana address to scan
   * @param limit - Max transactions to check (default: 20)
   */
  async getRecentUsdcTransfers(
    walletAddress: string,
    limit: number = 20
  ): Promise<SettlementMatch[]> {
    if (!this.isValidAddress(walletAddress)) {
      throw new Error(`Invalid Solana address: ${walletAddress}`);
    }

    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    // Get recent transaction signatures
    const signaturesResponse = await this.rpcCall<GetSignaturesResponse>(
      'getSignaturesForAddress',
      [
        walletAddress,
        { limit },
      ]
    );

    const signatures = signaturesResponse.result;
    const matches: SettlementMatch[] = [];

    // Process each signature
    for (const sig of signatures) {
      try {
        const txResponse = await this.rpcCall<GetTransactionResponse>(
          'getTransaction',
          [
            sig.signature,
            {
              encoding: 'jsonParsed',
              maxSupportedTransactionVersion: 0,
            },
          ]
        );

        const tx = txResponse.result;
        
        if (!tx || !tx.meta || tx.meta.err) {
          continue;
        }

        // Check each instruction for USDC transfer
        const instructions = tx.transaction.message.instructions;
        
        for (const instruction of instructions) {
          const transfer = this.parseTokenTransfer(
            instruction as TokenInstruction,
            tx.meta,
            tx.transaction.message.accountKeys
          );

          if (transfer && transfer.mint === SOLANA_USDC_MINT) {
            // Check if either party is our wallet
            const isRecipient = transfer.to === walletAddress;
            const isSender = transfer.from === walletAddress;

            // For settlements, we care about incoming transfers
            if (isRecipient) {
              const memo = this.extractMemoFromTransaction(tx);
              
              matches.push({
                txHash: sig.signature,
                blockNumber: tx.slot,
                blockTimestamp: tx.blockTime || Math.floor(Date.now() / 1000),
                from: transfer.from,
                to: transfer.to,
                amount: transfer.amount,
                token: transfer.mint,
                chainId: this.chain.chainId,
                invoiceId: memo ? this.extractInvoiceIdFromMemo(memo) : undefined,
                memo: memo || undefined,
                confirmed: sig.confirmationStatus === 'confirmed' || sig.confirmationStatus === 'finalized',
              });
              
              break; // Only one transfer per transaction matters
            }
          }
        }
      } catch (error) {
        // Log but continue processing other transactions
        console.error(`Error processing transaction ${sig.signature}:`, error);
      }
    }

    return matches;
  }

  /**
   * Extracts invoice ID from memo if present.
   * Expects format: "invoice:<id>" or just the ID
   * @param memo - Memo string from transaction
   */
  private extractInvoiceIdFromMemo(memo: string): string | undefined {
    // Check for invoice prefix
    const invoiceMatch = memo.match(/^invoice[:\-]?(.+)$/i);
    if (invoiceMatch) {
      return invoiceMatch[1].trim();
    }
    
    // If memo looks like an invoice ID (alphanumeric with dashes)
    if (/^[A-Za-z0-9\-_]+$/.test(memo) && memo.length >= 8) {
      return memo;
    }
    
    return undefined;
  }

  /**
   * Check if a specific transaction signature is a USDC transfer to recipient.
   * @param txSignature - Base58 transaction signature
   * @param expectedRecipient - Expected recipient wallet (base58)
   * @param expectedAmountUsdc - Expected amount in USDC (smallest unit, e.g., cents for 6 decimals)
   */
  async verifyTransfer(
    txSignature: string,
    expectedRecipient: string,
    expectedAmountUsdc: number
  ): Promise<boolean> {
    if (!this.isValidAddress(expectedRecipient)) {
      throw new Error(`Invalid recipient address: ${expectedRecipient}`);
    }

    // Basic signature format check (base58, ~88 chars for Solana)
    if (txSignature.length < 64 || txSignature.length > 128) {
      throw new Error(`Invalid transaction signature format`);
    }

    try {
      const txResponse = await this.rpcCall<GetTransactionResponse>(
        'getTransaction',
        [
          txSignature,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0,
          },
        ]
      );

      const tx = txResponse.result;
      
      if (!tx || !tx.meta || tx.meta.err) {
        return false;
      }

      // Check each instruction for USDC transfer
      const instructions = tx.transaction.message.instructions;
      
      for (const instruction of instructions) {
        const transfer = this.parseTokenTransfer(
          instruction as TokenInstruction,
          tx.meta,
          tx.transaction.message.accountKeys
        );

        if (transfer && transfer.mint === SOLANA_USDC_MINT) {
          // Verify recipient and amount
          if (transfer.to === expectedRecipient) {
            const transferAmount = parseInt(transfer.amount, 10);
            return transferAmount >= expectedAmountUsdc;
          }
        }
      }

      return false;
    } catch (error) {
      console.error(`Error verifying transfer ${txSignature}:`, error);
      return false;
    }
  }

  /**
   * Extract memo field from a transaction (used for invoice ID matching).
   * @param txSignature - Base58 transaction signature
   */
  async extractMemo(txSignature: string): Promise<string | null> {
    // Basic signature format check
    if (txSignature.length < 64 || txSignature.length > 128) {
      throw new Error(`Invalid transaction signature format`);
    }

    try {
      const txResponse = await this.rpcCall<GetTransactionResponse>(
        'getTransaction',
        [
          txSignature,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0,
          },
        ]
      );

      const tx = txResponse.result;
      
      if (!tx) {
        return null;
      }

      return this.extractMemoFromTransaction(tx);
    } catch (error) {
      console.error(`Error extracting memo from ${txSignature}:`, error);
      return null;
    }
  }

  /**
   * Gets the associated token account address for a wallet and mint.
   * @param walletAddress - Owner wallet address
   * @param mintAddress - Token mint address (default: USDC)
   */
  async getAssociatedTokenAddress(
    walletAddress: string,
    mintAddress: string = SOLANA_USDC_MINT
  ): Promise<string> {
    // Derive ATA using the standard formula
    // ATA = [wallet, token mint, associated token program]
    // This is a synchronous derivation, not an RPC call
    
    const { PublicKey } = await import('./solana-pda.js');
    return PublicKey.findAssociatedTokenAddress(walletAddress, mintAddress);
  }
}
