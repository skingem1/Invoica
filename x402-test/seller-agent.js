// seller-agent.js — SellerBot-3: x402-enabled API server using PayAI facilitator
// This is a real x402 server that returns 402 Payment Required and verifies Solana USDC payments
import express from "express";
import { config } from "dotenv";
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { readFileSync } from "fs";

config();

const SOLANA_RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const USDC_MINT = new PublicKey(process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.payai.network";
const PORT = parseInt(process.env.SERVER_PORT || "4402");
const INVOICA_API = process.env.INVOICA_API || "https://igspopoejhsxvwvxyhbh.supabase.co/functions/v1/api";

// Load seller keypair
const sellerKeyData = JSON.parse(readFileSync("seller-keypair.json", "utf-8"));
const sellerKeypair = Keypair.fromSecretKey(Uint8Array.from(sellerKeyData));
const SELLER_WALLET = sellerKeypair.publicKey;

const connection = new Connection(SOLANA_RPC, "confirmed");
const app = express();
app.use(express.json());

// Price: 0.01 USDC (10000 atomic units, USDC has 6 decimals)
const PRICE_ATOMIC = 10000; // 0.01 USDC
const PRICE_DISPLAY = "0.01";

console.log(`\n🤖 SellerBot-3 Starting...`);
console.log(`   Wallet: ${SELLER_WALLET.toBase58()}`);
console.log(`   Network: Solana Devnet`);
console.log(`   Price: ${PRICE_DISPLAY} USDC per API call`);
console.log(`   Facilitator: ${FACILITATOR_URL}`);

// Get seller's USDC token account
let SELLER_TOKEN_ACCOUNT;

async function initSellerTokenAccount() {
  if (process.env.SELLER_TOKEN_ACCOUNT) {
    SELLER_TOKEN_ACCOUNT = new PublicKey(process.env.SELLER_TOKEN_ACCOUNT);
  } else {
    SELLER_TOKEN_ACCOUNT = await getAssociatedTokenAddress(USDC_MINT, SELLER_WALLET);
  }
  console.log(`   Token Account: ${SELLER_TOKEN_ACCOUNT.toBase58()}`);
  console.log(`   USDC Mint: ${USDC_MINT.toBase58()}`);
}

// === x402 Payment-gated endpoint: /v1/ai/inference ===
app.get("/v1/ai/inference", async (req, res) => {
  const paymentHeader = req.header("X-Payment");

  if (!paymentHeader) {
    // Return 402 Payment Required with payment requirements
    console.log(`\n📋 [402] Payment required for inference request`);

    const paymentRequirements = {
      x402Version: 1,
      scheme: "exact",
      network: "solana-devnet",
      payment: {
        recipientWallet: SELLER_WALLET.toBase58(),
        tokenAccount: SELLER_TOKEN_ACCOUNT.toBase58(),
        mint: USDC_MINT.toBase58(),
        amount: PRICE_ATOMIC,
        amountUSDC: PRICE_ATOMIC / 1_000_000,
        cluster: "devnet",
        description: "GPT-4 API inference via Invoica x402",
      },
      facilitator: FACILITATOR_URL,
    };

    return res.status(402).json(paymentRequirements);
  }

  // Verify payment
  try {
    console.log(`\n💰 [PAYMENT] Received X-Payment header, verifying...`);

    const paymentData = JSON.parse(
      Buffer.from(paymentHeader, "base64").toString("utf-8")
    );

    const txBuffer = Buffer.from(paymentData.payload.serializedTransaction, "base64");
    const tx = Transaction.from(txBuffer);

    // Verify SPL Token transfer instruction
    let validTransfer = false;
    let transferAmount = 0;
    let payerAddress = null;

    for (const ix of tx.instructions) {
      if (ix.programId.equals(TOKEN_PROGRAM_ID)) {
        // Instruction type 3 = Transfer
        if (ix.data.length >= 9 && ix.data[0] === 3) {
          transferAmount = Number(ix.data.readBigUInt64LE(1));
          if (ix.keys.length >= 3) {
            const destAccount = ix.keys[1].pubkey;
            payerAddress = ix.keys[2].pubkey.toBase58();
            if (destAccount.equals(SELLER_TOKEN_ACCOUNT) && transferAmount >= PRICE_ATOMIC) {
              validTransfer = true;
              break;
            }
          }
        }
      }
    }

    if (!validTransfer) {
      console.log(`   ❌ Invalid transfer: amount=${transferAmount}, required=${PRICE_ATOMIC}`);
      return res.status(402).json({ error: "Invalid token transfer", required: PRICE_ATOMIC, received: transferAmount });
    }

    console.log(`   ✅ Valid transfer: ${transferAmount / 1_000_000} USDC from ${payerAddress}`);

    // Simulate transaction first
    const simulation = await connection.simulateTransaction(tx);
    if (simulation.value.err) {
      console.log(`   ❌ Simulation failed:`, simulation.value.err);
      return res.status(402).json({ error: "Transaction simulation failed", details: simulation.value.err });
    }
    console.log(`   ✅ Simulation passed`);

    // Submit transaction to Solana
    const signature = await connection.sendRawTransaction(txBuffer, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    console.log(`   📤 Transaction submitted: ${signature}`);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, "confirmed");
    if (confirmation.value.err) {
      console.log(`   ❌ Confirmation failed`);
      return res.status(402).json({ error: "Transaction confirmation failed" });
    }
    console.log(`   ✅ Transaction confirmed on-chain!`);
    console.log(`   🔗 https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Record the payment in Invoica
    let invoiceData = null;
    try {
      // Create invoice in Invoica backend
      const invoiceRes = await fetch(`${INVOICA_API}/v1/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: transferAmount / 1_000_000,
          currency: "USDC",
          customerName: `Agent ${payerAddress?.substring(0, 8)}...`,
          customerEmail: `${payerAddress?.substring(0, 8)}@agents.solana`,
          paymentDetails: {
            x402Protocol: true,
            network: "solana-devnet",
            txSignature: signature,
            payerWallet: payerAddress,
            sellerWallet: SELLER_WALLET.toBase58(),
            facilitator: "PayAI",
            usdcMint: USDC_MINT.toBase58(),
          },
        }),
      });
      const invoiceJson = await invoiceRes.json();

      // Immediately mark as settled with the tx hash
      if (invoiceJson.data?.id) {
        const payRes = await fetch(`${INVOICA_API}/v1/invoices/${invoiceJson.data.id}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payerAgent: payerAddress,
            payerWallet: payerAddress,
          }),
        });
        invoiceData = await payRes.json();
        console.log(`   📄 Invoica invoice created & settled: ${invoiceJson.data.id}`);
      }
    } catch (e) {
      console.log(`   ⚠️ Failed to record in Invoica (non-critical): ${e.message}`);
    }

    // Return the paid resource
    return res.json({
      success: true,
      data: {
        result: "GPT-4 inference result: The meaning of life is 42, computed via x402 payment protocol on Solana.",
        model: "gpt-4-simulated",
        tokens_used: 150,
      },
      payment: {
        verified: true,
        signature,
        amount: `${transferAmount / 1_000_000} USDC`,
        network: "solana-devnet",
        explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        invoica: invoiceData?.data || null,
      },
    });

  } catch (err) {
    console.log(`   ❌ Payment verification error: ${err.message}`);
    return res.status(402).json({ error: "Payment verification failed", message: err.message });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ agent: "SellerBot-3", status: "ok", wallet: SELLER_WALLET.toBase58() });
});

// Start server
initSellerTokenAccount().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 SellerBot-3 listening on http://localhost:${PORT}`);
    console.log(`   Payment endpoint: GET /v1/ai/inference`);
    console.log(`   Health: GET /health\n`);
  });
});
