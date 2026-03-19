# FRIDAY MORNING STATUS — Verified Agent Oracles
_Overnight verification by Kit | Friday 20 March 2026, ~2:10 AM AEST_

---

## TL;DR

The scaffold is solid. Venice is wired. **One blocker before Anchor build: install Anchor CLI.**

---

## ✅ What's Ready

### Repo
- Branch: `main`, clean working tree, up to date with origin
- Latest commit: `2c6b3ec` — PDA seed consistency + Anchor.toml resolution flag

### Surfpool
- ✅ `surfpool 1.1.1` installed at `~/.local/bin/surfpool`
- Ready to run a local test validator with MagicBlock support

### Solana CLI
- ✅ `solana-cli 3.1.10` (Agave client)
- ✅ `~/.config/solana/blitz-dev.json` wallet exists (Anchor.toml configured to use it)

### Rust Toolchain
- ✅ `rustc 1.94.0` available at `~/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc`
- ⚠️ **Not on PATH** — needs `source "$HOME/.cargo/env"` or `export PATH="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin:$PATH"`

### Anchor.toml
- ✅ `resolution = true` present under `[features]`
- ✅ `anchor_version = "0.32.1"` pinned in `[toolchain]`
- ✅ Wallet → `~/.config/solana/blitz-dev.json`
- ⚠️ Program ID still `YOUR_PROGRAM_ID_PLACEHOLDER` — will be replaced after first `anchor build`

### Cargo.toml (root + program)
- ✅ Root: workspace with `resolver = "2"` (required for Anchor 0.32)
- ✅ `programs/oracle-escrow/Cargo.toml`:
  - `anchor-lang = "0.32.1"`
  - `ephemeral-rollups-sdk = { version = "0.8.0", features = ["anchor"] }` ← critical flag

### Rust Program (`lib.rs`)
- ✅ `#[ephemeral]` macro on `#[program]` module
- ✅ `#[delegate]` macro + `#[account(mut, del)]` on delegation context
- ✅ `#[commit]` macro on undelegate context (auto-injects magic_context + magic_program)
- ✅ `oracle_signer: Pubkey` attestation model (no boolean `attested` flag)
- ✅ PDA seeds consistent: `OGMA_SCORE_SEED`, `ESCROW_SEED`
- ✅ `TEE_VALIDATOR` constant: `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA`

### Venice AI → `ogma-service/scorer.py`
- ✅ **Wired and syntax-checked**
- Uses `AsyncOpenAI` with `base_url = "https://api.venice.ai/api/v1"` (drop-in replacement)
- Model: `mistral-small-3-2-24b-instruct` (Private-tier, $0.09/$0.25 per 1M — cheapest capable)
- Override via env: `VENICE_MODEL=venice-uncensored` if you need guaranteed `supportsResponseSchema`
- `extra_body={"venice_parameters": {"include_venice_system_prompt": False}}` — disables Venice default prompt injection
- Lazy-init client — no crash if `VENICE_API_KEY` not set at import time
- `/health` endpoint now reports key presence + model + SDK availability
- ✅ `python3 -c 'import ast; ast.parse(...)'` → **syntax OK**

---

## 🔴 Blocker: Anchor CLI Not Installed

`anchor` is not on PATH and `~/.cargo/bin/anchor` doesn't exist.
`~/.avm/` doesn't exist either — AVM (Anchor Version Manager) has never been run.

**Fix (run this first thing Friday morning):**

```bash
# Step 1 — get Rust on PATH
source "$HOME/.cargo/env"
# or: export PATH="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin:$HOME/.cargo/bin:$PATH"

# Step 2 — install AVM (Anchor Version Manager)
cargo install --git https://github.com/coral-xyz/anchor avm --force

# Step 3 — install Anchor 0.32.1 via AVM
avm install 0.32.1
avm use 0.32.1

# Verify
anchor --version   # should print: anchor-cli 0.32.1
```

⏱ Estimated time: 10-20 min (compiling from source)

---

## ⚠️ Minor Items (Non-blocking)

### Rust Not on Shell PATH
`~/.rustup/toolchains/.../bin/rustc` exists but the toolchain directory is not in the default shell PATH.
`source "$HOME/.cargo/env"` will fix this for the session (or add to `.zshrc`).

### VENICE_API_KEY Not Set (Expected)
The scorer will fail at runtime without `VENICE_API_KEY`. Set it before running:
```bash
export VENICE_API_KEY="your-key-from-venice.ai"
```
Or add to a `.env` file and load with `python-dotenv` (scorer supports this via openai SDK).

### Program ID Placeholder
`declare_id!("11111111111111111111111111111111")` in `lib.rs` is intentional — gets replaced after:
```bash
anchor build
# then copy the printed program ID into:
#   - lib.rs declare_id!(...)
#   - Anchor.toml [programs.localnet] and [programs.devnet]
```

---

## 📋 Exact Commands to Run Friday Morning (In Order)

```bash
# 1. Get Rust toolchain on PATH
source "$HOME/.cargo/env"

# 2. Install Anchor CLI (if not already done — takes 10-20 min)
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.32.1 && avm use 0.32.1
anchor --version

# 3. Install frontend deps (while Anchor compiles)
cd /Users/loki/projects/verified-agent-oracles/frontend && npm install

# 4. Build the Anchor program (first build, generates IDL)
cd /Users/loki/projects/verified-agent-oracles
anchor build

# 5. Copy program ID from build output → update lib.rs + Anchor.toml
# The ID prints after anchor build. Run:
#   solana address -k target/deploy/oracle_escrow-keypair.json
# Paste that into lib.rs declare_id!(...) and Anchor.toml program ID fields

# 6. Rebuild with real program ID
anchor build

# 7. Start local test validator with MagicBlock rollup support
~/.local/bin/surfpool start --magicblock   # (or check surfpool --help for exact flag)

# 8. Run anchor tests
anchor test --skip-local-validator

# 9. Set Venice key and test scorer
cd ogma-service
export VENICE_API_KEY="your-key"
pip install openai fastapi uvicorn
python3 scorer.py &
curl -X POST http://localhost:8001/score \
  -H "Content-Type: application/json" \
  -d '{"story": "Anansi wove a tale of the spider and the sky god...", "story_id": "test-1"}'
```

---

## Architecture Reminder

```
Anansi (story gen) → Venice AI (zero-retention)
         ↓
  Ogma scorer.py → Venice AI (scoring, zero-retention)
         ↓
  ogma_score PDA delegated to TEE validator
         ↓
  TEE commits score + story_hash → L1
         ↓
  release_payment (if score >= threshold)
```

---

## Files Changed This Overnight Run

- ✅ `ogma-service/scorer.py` — Venice AI wired (was stub with `raise NotImplementedError`)
- ✅ `FRIDAY-MORNING-STATUS.md` — this file (new)

_Kit out. Good luck Friday._ 🛠️
