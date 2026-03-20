# Verified Agent Oracles — Build Status

_MagicBlock Solana Blitz v2 | Last updated: 2026-03-20 by Kit_

## TL;DR
- Anchor is installed and the native Solana toolchain is now present.
- Placeholder program IDs were replaced with a real generated program key.
- `anchor build` progresses into SBF compilation now, but is blocked by Rust-version incompatibilities inside the Solana SBF toolchain.
- A separate runnable Research DAG scaffold now exists under `client/research-dag/` and demonstrates an x402-style paid insight loop with simulated Solana receipts.

## ✅ Completed Today

### Toolchain progress
- Confirmed `anchor-cli 0.32.1`
- Installed native Solana toolchain under `~/.local/share/solana/install/active_release/bin`
- Installed `rustup` so `cargo-build-sbf` can run
- Added root workspace release profile:
  - `overflow-checks = true`
  - `lto = "thin"`

### Program ID setup
Generated and wired a real program key:
- Program ID: `GyT8wyGD3dG3sVQ986SGwKxF23iWNjdbSe4oCuBrkMdd`

Updated:
- `Anchor.toml`
- `programs/oracle-escrow/src/lib.rs`
- `target/deploy/oracle_escrow-keypair.json`

### Dependency unblock
- Downgraded `blake3` in `Cargo.lock` from `1.8.3` → `1.7.0`
- This fixed the earlier `edition2024` manifest failure

### Research DAG scaffold (new)
Created:
```text
client/research-dag/
  config.mjs
  ledger.mjs
  insights.mjs
  specialist.mjs
  payment.mjs
  researcher.mjs
  demo.mjs
```

Run it:
```bash
/opt/homebrew/Cellar/node@24/24.14.0_1/bin/node client/research-dag/demo.mjs magicblock
```

What it does:
1. Researcher requests insight
2. Specialist returns x402-style payment challenge
3. Researcher pays simulated Solana USDC receipt
4. Specialist verifies receipt
5. Paid insight is returned and aggregated

## 🔴 Current Blocker
`anchor build` currently fails in SBF compilation because Solana's bundled Rust toolchain is effectively `rustc 1.79`, while some resolved crates now require `rustc >= 1.81`.

Examples from the failure:
- `five8_core@1.0.0 requires rustc 1.81`
- `indexmap@2.13.0 requires rustc 1.82`
- `solana-program@4.0.0 requires rustc 1.81.0`

## Next Actions
1. Pin additional dependencies to Rust 1.79-compatible versions **or** upgrade the SBF toolchain
2. Finish the real x402 SVM client path using the Research DAG scaffold as the shape
3. Fund the devnet wallet before end-to-end chain testing
4. Resume TEE / MagicBlock integration after the base payment loop is on real Solana rails
