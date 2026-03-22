/**
 * End-to-end test for Verified Agent Oracles
 * 
 * Flow:
 * 1. Initialize escrow (threshold=7, 0.05 SOL)
 * 2. Initialize score account + delegate
 * 3. Submit score (8)
 * 4. Commit and release payment
 * 5. Show final state
 * 
 * Env vars:
 *   SOLANA_RPC     — L1 RPC endpoint (default: http://127.0.0.1:8899)
 *   MAGICBLOCK_RPC — MagicBlock ER RPC for TEE instructions (default: https://devnet.magicblock.app)
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import * as crypto from "crypto";
import {
  anansiDeposit,
  ogmaDelegate,
  ogmaSubmitScore,
  commitAndRelease,
  showStatus,
  getAuthenticatedERConnection,
  createProgram,
  deriveScorePda,
} from "./index";

const RPC_URL = process.env.SOLANA_RPC || "http://127.0.0.1:8899";
// TEE endpoint for validator FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA (MagicBlock Blitz v2)
const MAGICBLOCK_RPC = process.env.MAGICBLOCK_RPC || "https://tee.magicblock.app";
const IS_DEVNET = RPC_URL.includes("devnet") || RPC_URL.includes("magicblock");
const BLITZ_WALLET_PATH = `${process.env.HOME}/.config/solana/blitz-dev.json`;

async function loadKeypair(path: string): Promise<Keypair> {
  const secret = JSON.parse(fs.readFileSync(path, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function fundFromBlitz(
  connection: Connection,
  blitzKeypair: Keypair,
  target: PublicKey,
  lamports: number
): Promise<void> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: blitzKeypair.publicKey,
      toPubkey: target,
      lamports,
    })
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [blitzKeypair], { commitment: "confirmed" });
  console.log(`  Funded ${target.toString().slice(0, 8)} from blitz: ${sig.slice(0, 16)}...`);
}

async function airdropIfNeeded(connection: Connection, pubkey: PublicKey, minSol = 1): Promise<void> {
  const balance = await connection.getBalance(pubkey);
  if (balance < minSol * LAMPORTS_PER_SOL) {
    console.log(`  Airdropping 2 SOL to ${pubkey.toString().slice(0, 8)}...`);
    const sig = await connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  }
}

async function main() {
  console.log(`=== Verified Agent Oracles — E2E Test ===`);
  console.log(`L1 RPC: ${RPC_URL}`);
  console.log(`ER RPC: ${IS_DEVNET ? MAGICBLOCK_RPC : "(localnet)"}`);
  console.log(`Mode: ${IS_DEVNET ? "DEVNET" : "LOCALNET"}\n`);

  const connection = new Connection(RPC_URL, "confirmed");
  // Load blitz wallet first (needed for TEE auth signing)
  let blitzKeypair: Keypair | null = null;
  try {
    blitzKeypair = await loadKeypair(BLITZ_WALLET_PATH);
    const blitzBalance = await connection.getBalance(blitzKeypair.publicKey);
    console.log(`Blitz wallet: ${blitzKeypair.publicKey.toString()} (${blitzBalance / LAMPORTS_PER_SOL} SOL)`);
  } catch (e) {
    console.log("Blitz wallet not found.");
  }

  // ER connection for TEE instructions (submit_score, undelegate_and_finalize)
  // On devnet: obtain TEE-authenticated connection (challenge → sign → token)
  // erConnection is set AFTER ogmaKeypair is created — see below
  let erConnection: Connection | undefined = undefined;

  // On devnet: use blitz as Anansi (depositor) + fresh Ogma with minimal funding
  // On localnet: generate fresh keypairs and airdrop
  let anansiKeypair: Keypair;
  let ogmaKeypair: Keypair;

  if (IS_DEVNET && blitzKeypair) {
    // Use fresh keypairs on devnet to avoid PDA collisions from prior runs
    anansiKeypair = Keypair.generate();
    console.log(`Anansi (fresh depositor): ${anansiKeypair.publicKey.toString()}`);
    ogmaKeypair = Keypair.generate();
    console.log(`Ogma (fresh oracle): ${ogmaKeypair.publicKey.toString()}`);
    console.log(`Ogma (fresh oracle+recipient): ${ogmaKeypair.publicKey.toString()}`);
    console.log("\nFunding wallets from blitz...");
    await fundFromBlitz(connection, blitzKeypair, anansiKeypair.publicKey, 0.2 * LAMPORTS_PER_SOL);
    await fundFromBlitz(connection, blitzKeypair, ogmaKeypair.publicKey, 0.05 * LAMPORTS_PER_SOL);
  } else {
    anansiKeypair = Keypair.generate();
    console.log(`Anansi (fresh depositor): ${anansiKeypair.publicKey.toString()}`);
    ogmaKeypair = Keypair.generate();
    console.log(`Ogma (oracle+recipient): ${ogmaKeypair.publicKey.toString()}`);
    await airdropIfNeeded(connection, anansiKeypair.publicKey, 1);
    await airdropIfNeeded(connection, ogmaKeypair.publicKey, 1);
  }

  console.log(`\nAnansi balance: ${(await connection.getBalance(anansiKeypair.publicKey)) / LAMPORTS_PER_SOL} SOL`);
  console.log(`Ogma balance: ${(await connection.getBalance(ogmaKeypair.publicKey)) / LAMPORTS_PER_SOL} SOL`);

  // ER connection: auth token MUST be signed by OGMA keypair (the ER tx signer)
  if (IS_DEVNET) {
    erConnection = await getAuthenticatedERConnection(MAGICBLOCK_RPC, ogmaKeypair);
  }

  // Generate a fake story hash (sha256 of "test story")
  const storyText = "Anansi weaves a tale of ancient wisdom for the children of the village.";
  const storyHash = crypto.createHash("sha256").update(storyText).digest();
  console.log(`\nStory hash: ${storyHash.toString("hex")}`);

  // =========================================================
  // Step 1: Initialize escrow (threshold=7, 0.05 SOL)
  // =========================================================
  console.log("\n--- Step 1: Initialize Escrow ---");
  // On devnet use tiny deposit to conserve SOL (blitz has very little)
  const escrowDepositSol = IS_DEVNET ? 0.001 : 0.05;
  const { sig: escrowSig, escrowPda } = await anansiDeposit(
    connection,
    anansiKeypair,
    ogmaKeypair.publicKey,
    7,                // threshold
    escrowDepositSol  // SOL
  );
  console.log(`  Tx: ${escrowSig}`);
  console.log(`  Escrow PDA: ${escrowPda.toString()}`);

  // =========================================================
  // Step 2: Initialize score account + delegate (skip delegation on localnet)
  // =========================================================
  console.log("\n--- Step 2: Initialize Score Account + Delegate ---");
  let initSig: string;
  let delegateSig: string = "LOCALNET_SKIP";
  let scorePda: PublicKey;
  
  if (IS_DEVNET) {
    // On devnet, delegate with MagicBlock
    const result = await ogmaDelegate(
      connection,
      ogmaKeypair,
      storyHash,
      MAGICBLOCK_RPC  // TEE URL for permission creation
    );
    initSig = result.initSig;
    delegateSig = result.delegateSig;
    scorePda = result.scorePda;
    console.log(`  initScore Tx: ${initSig}`);
    console.log(`  delegate Tx: ${delegateSig}`);
    console.log(`  Score PDA: ${scorePda.toString()}`);
  } else {
    // On localnet, just initialize the score account without delegation
    const wallet = new anchor.Wallet(ogmaKeypair);
    const program = createProgram(connection, wallet);
    const [pda] = deriveScorePda(ogmaKeypair.publicKey);
    scorePda = pda;
    
    initSig = await (program.methods as any)
      .initializeScore(Array.from(storyHash))
      .accounts({
        ogmaScore: scorePda,
        oracleSigner: ogmaKeypair.publicKey,
        payer: ogmaKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([ogmaKeypair])
      .rpc();
    
    console.log(`  initScore Tx: ${initSig}`);
    console.log(`  delegate Tx: SKIPPED (localnet)`);
    console.log(`  Score PDA: ${scorePda.toString()}`);
  }

  // =========================================================
  // Step 3: Submit score (8) — on devnet, sent to MagicBlock ER (TEE)
  // =========================================================
  console.log("\n--- Step 3: Submit Score (8) via MagicBlock ER ---");
  const scoreSig = await ogmaSubmitScore(connection, ogmaKeypair, 8, erConnection);
  console.log(`  Tx: ${scoreSig}`);

  // =========================================================
  // Step 4: Commit and release payment
  // undelegateAndFinalize goes to ER, releasePayment to L1
  // =========================================================
  console.log("\n--- Step 4: Commit and Release Payment ---");
  const { undelegateSig, releaseSig } = await commitAndRelease(
    connection,
    anansiKeypair,    // payer for release_payment
    ogmaKeypair,      // oracle whose PDA to look up
    anansiKeypair.publicKey,   // depositor (escrow owner)
    ogmaKeypair.publicKey,     // recipient
    erConnection               // ER for undelegateAndFinalize
  );
  console.log(`  undelegate Tx: ${undelegateSig}`);
  console.log(`  release Tx: ${releaseSig}`);

  // =========================================================
  // Step 5: Show final state
  // =========================================================
  console.log("\n--- Step 5: Final State ---");
  const wallet = new anchor.Wallet(anansiKeypair);
  await showStatus(connection, wallet, ogmaKeypair.publicKey, anansiKeypair.publicKey);

  // Summary
  console.log("=== TRANSACTION SIGNATURES ===");
  console.log(`  1. initializeEscrow: ${escrowSig}`);
  console.log(`  2. initializeScore:  ${initSig}`);
  console.log(`  3. delegateToPer:    ${delegateSig}`);
  console.log(`  4. submitScore:      ${scoreSig}`);
  console.log(`  5. undelegateAndFinalize: ${undelegateSig}`);
  console.log(`  6. releasePayment:   ${releaseSig}`);

  console.log("\n✅ E2E flow complete!");
  if (IS_DEVNET) {
    console.log("Note: ran against DEVNET RPC:", RPC_URL);
    console.log("If delegateToPer shows MOCK, delegation program was not present or failed.");
  } else {
    console.log("Note: delegation/undelegation are mocked on localnet (MagicBlock PER not available).");
    console.log("On devnet with MagicBlock infra, these would route through TEE validator.");
  }
}

main().catch((e) => {
  console.error("E2E failed:", e);
  process.exit(1);
});
