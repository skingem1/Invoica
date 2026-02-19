// buyer-agent.js — BuyerBot-7: Autonomous x402 client that pays for API access on Solana
// This agent: requests a resource → gets 402 → builds & signs USDC payment → retries with X-Payment header
import { config } from "dotenv";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { readFileSync } from "fs";

config();

const SOLANA_RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const USDC_MINT = new PublicKey(process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const SELLER_URL = `http://localhost:${process.env.SERVER_PORT || 4402}`;

// Load buyer keypair
const buyerKeyData = JSON.parse(readFileSync("buyer-keypair.json", "utf-8"));
const buyerKeypair = Keypair.fromSecretKey(Uint8Array.from(buyerKeyData));

const connection = new Connection(SOLANA_RPC, "confirmed");

console.log(`\n🤖 BuyerBot-7 Starting...`);
console.log(`   Wallet: ${buyerKeypair.publicKey.toBase58()}`);
console.log(`   Network: Solana Devnet`);
console.log(`   Target: ${SELLER_URL}/v1/ai/inference`);

async function runBuyerAgent() {
  // Step 1: Check buyer's USDC balance
  console.log(`\n📊 Step 1: Checking USDC balance...`);
  const buyerTokenAccount = await getAssociatedTokenAddress(USDC_MINT, buyerKeypair.publicKey);

  try {
    const balance = await connection.getTokenAccountBalance(buyerTokenAccount);
    console.log(`   Balance: ${balance.value.uiAmountString} USDC`);
    if (Number(balance.value.amount) < 10000) {
      console.log(`   ❌ Insufficient USDC balance. Need at least 0.01 USDC.`);
      console.log(`   Get devnet USDC from: https://faucet.circle.com/`);
      console.log(`   Wallet: ${buyerKeypair.publicKey.toBase58()}`);
      process.exit(1);
    }
  } catch (e) {
    console.log(`   ❌ No USDC token account found. Fund this wallet first:`);
    console.log(`   ${buyerKeypair.publicKey.toBase58()}`);
    console.log(`   Get devnet USDC from: https://faucet.circle.com/`);
    process.exit(1);
  }

  // Step 2: Request the resource (expect 402)
  console.log(`\n🌐 Step 2: Requesting /v1/ai/inference (expecting 402)...`);
  const initialResponse = await fetch(`${SELLER_URL}/v1/ai/inference`);

  if (initialResponse.status !== 402) {
    console.log(`   Unexpected status: ${initialResponse.status}`);
    const body = await initialResponse.json();
    console.log(`   Response:`, body);
    return;
  }

  const paymentRequirements = await initialResponse.json();
  console.log(`   ✅ Got 402 Payment Required`);
  console.log(`   Price: ${paymentRequirements.payment.amountUSDC} USDC`);
  console.log(`   Recipient: ${paymentRequirements.payment.recipientWallet}`);
  console.log(`   Token Account: ${paymentRequirements.payment.tokenAccount}`);

  // Step 3: Build USDC transfer transaction
  console.log(`\n🔨 Step 3: Building Solana USDC transfer transaction...`);

  const recipientTokenAccount = new PublicKey(paymentRequirements.payment.tokenAccount);
  const recipientWallet = new PublicKey(paymentRequirements.payment.recipientWallet);
  const amount = paymentRequirements.payment.amount;

  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: buyerKeypair.publicKey,
    blockhash,
    lastValidBlockHeight,
  });

  // Check if recipient token account exists, create if needed
  try {
    await getAccount(connection, recipientTokenAccount);
    console.log(`   Recipient token account exists`);
  } catch (e) {
    console.log(`   Creating recipient token account...`);
    tx.add(
      createAssociatedTokenAccountInstruction(
        buyerKeypair.publicKey,  // payer
        recipientTokenAccount,    // token account to create
        recipientWallet,          // owner of the new account
        USDC_MINT                 // token mint
      )
    );
  }

  // Add USDC transfer instruction
  tx.add(
    createTransferInstruction(
      buyerTokenAccount,         // source (buyer's USDC account)
      recipientTokenAccount,     // destination (seller's USDC account)
      buyerKeypair.publicKey,    // authority (buyer signs)
      amount                     // amount in atomic units (0.01 USDC = 10000)
    )
  );

  // Sign transaction
  tx.sign(buyerKeypair);
  console.log(`   ✅ Transaction built and signed`);
  console.log(`   Transfer: ${amount / 1_000_000} USDC → ${recipientWallet.toBase58().substring(0, 8)}...`);

  // Step 4: Serialize and encode as X-Payment header
  console.log(`\n📦 Step 4: Encoding X-Payment header...`);

  const serializedTx = tx.serialize().toString("base64");
  const paymentProof = {
    x402Version: 1,
    scheme: "exact",
    network: "solana-devnet",
    payload: {
      serializedTransaction: serializedTx,
    },
  };

  const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString("base64");
  console.log(`   ✅ Payment proof encoded (${xPaymentHeader.length} chars)`);

  // Step 5: Retry request with payment
  console.log(`\n💸 Step 5: Retrying request with X-Payment header...`);

  const paidResponse = await fetch(`${SELLER_URL}/v1/ai/inference`, {
    headers: {
      "X-Payment": xPaymentHeader,
    },
  });

  const result = await paidResponse.json();

  if (paidResponse.status === 200) {
    console.log(`\n✅ ============================================`);
    console.log(`   REAL x402 TRANSACTION COMPLETE!`);
    console.log(`   ============================================`);
    console.log(`   Status: ${paidResponse.status} OK`);
    console.log(`   AI Result: ${result.data?.result}`);
    console.log(`   Tokens Used: ${result.data?.tokens_used}`);
    console.log(`\n   Payment Details:`);
    console.log(`   Signature: ${result.payment?.signature}`);
    console.log(`   Amount: ${result.payment?.amount}`);
    console.log(`   Network: ${result.payment?.network}`);
    console.log(`   Explorer: ${result.payment?.explorer}`);
    if (result.payment?.invoica) {
      console.log(`\n   Invoica Settlement:`);
      console.log(`   Invoice ID: ${result.payment.invoica.invoiceId}`);
      console.log(`   Status: ${result.payment.invoica.status}`);
      console.log(`   Tx Hash: ${result.payment.invoica.txHash}`);
    }
    console.log(`   ============================================\n`);
  } else {
    console.log(`\n❌ Payment failed: ${paidResponse.status}`);
    console.log(`   Response:`, JSON.stringify(result, null, 2));
  }

  // Check updated balance
  const newBalance = await connection.getTokenAccountBalance(buyerTokenAccount);
  console.log(`📊 Updated USDC balance: ${newBalance.value.uiAmountString} USDC`);
}

runBuyerAgent().catch((err) => {
  console.error(`\n❌ BuyerBot-7 error: ${err.message}`);
  process.exit(1);
});
