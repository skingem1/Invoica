
import { ChainConfig } from '../../lib/chain-registry';

export interface SettlementMatch {
  invoiceId: string;
  txHash: string;
  amount: number;
  from: string;
  to: string;
  blockNumber: number;
  timestamp: number;
  chain: string;
}

/**
 * EVM Settlement Detector
 * Detects USDC Transfer events on any EVM chain
 */
export class EvmSettlementDetector {
  private rpcUrl: string;
  private chainId: number;
  
  // USDC Transfer event signature
  private static readonly TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

I'll store the RPC URL and chain configuration in the constructor to initialize the detector with the specific chain settings I'll need for making JSON-RPC requests.

The `scanTransfersToAddress` method sends a JSON-RPC request to fetch transfer events for a specific recipient within a block range. It validates the recipient address, constructs the query parameters with the USDC transfer topic, and sends the request. Then it processes each log by extracting and validating the transaction hash, decoding the from and to addresses from the event topics, parsing the transfer amount from the data field, and retrieving the block details.

For the `getLatestBlock` method, I'll make a simple JSON-RPC call to eth_blockNumber and convert the hex response to a decimal number. The `verifyTransfer` method is still incomplete but appears designed to validate a specific transaction hash.

The `verifyTransfer` method retrieves a transaction receipt using the provided hash, then checks whether the receipt exists and contains at least one log entry. It iterates through the logs to find one matching the USDC transfer event with the expected recipient address and amount in the specified range, returning true if all conditions are met.

The helper methods construct JSON-RPC requests, with `sendRequest` executing the fetch call and handling error responses. The `decodeAddress` function extracts the last 40 hex characters from a topic, while `decodeUint256` converts a hex-encoded uint256 value to its decimal representation.

The block number and timestamp retrieval methods parse hex-encoded block data from logs, converting block numbers to decimal and timestamps from hex to decimal format.

For the `parseBlockNumber` function, I need to handle multiple input formats: if it's already a number return it directly, if it's a hex string convert it, otherwise throw an error. For timestamps, I'm converting the hex timestamp value to a decimal number by parsing the hex string.
</think>
