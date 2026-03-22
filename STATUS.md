# Verified Agent Oracles — STATUS

_Last updated: 2026-03-22 01:42 AEDT by Kit_

## 🌐 Demo Frontend — LIVE

**Main demo:** https://frontend-iota-eight-30.vercel.app
**Slides:** https://frontend-iota-eight-30.vercel.app/slides/

Built with Next.js 14 + Tailwind + Framer Motion. Static export deployed to Vercel.
- `/` — Three animated step cards (story → TEE scoring → payment), all 6 devnet tx signatures, explorer links
- `/slides` — reveal.js presentation (11 slides, full story of the protocol)

## TL;DR
- `anchor build` is now **working**.
- The fix was **not** Option A/B/C exactly — the real unblock was forcing Solana SBF to use newer **platform-tools v1.48** (rustc `1.84.1-dev`) via a `cargo-build-sbf` wrapper in `~/bin/cargo-build-sbf` that injects `--tools-version v1.48`.
- Localnet program deploy succeeded via **`solana program deploy`**.
- Program is now also **deployed on Solana devnet** at the expected ID:
  - `GyT8wyGD3dG3sVQ986SGwKxF23iWNjdbSe4oCuBrkMdd`
  - deploy tx: `2am8uwSecBckbHifdGsrZ1dzbkgpG8WG1nespBbXCd6FSQjqATM1sRWiwXvPVPWRNGhW82sv1Wji6L9sxWcexMb1`
- Real delegation testing reached the important milestone:
  - `delegate_to_per` now **succeeds on devnet** after fixing client PDA derivation for `buffer_pda`
  - failure has moved downstream to the **TEE execution path**, not delegation
- Root diagnosis from devnet testing:
  - public Solana devnet has the delegation program deployed
  - `https://devnet.magicblock.app` is **not** the same thing as the TEE endpoint used by the delegated validator
  - for the configured validator `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA`, the correct post-delegation path is `https://tee.magicblock.app?token=...`
  - TEE auth challenge/login was validated successfully, and the endpoint returned a JWT token
- Current hard blocker: the devnet wallet `~/.config/solana/blitz-dev.json` is now effectively empty (`~0.0009348 SOL`), so I cannot complete another end-to-end TEE run without topping it up.

## New devnet findings (this session)

### Devnet deploy status
- Standard Solana devnet deploy: **succeeded**
- Program show before deploy: not found
- Deploy command that worked:
```bash
solana program deploy target/deploy/oracle_escrow.so \
  --program-id target/deploy/oracle_escrow-keypair.json \
  --url https://api.devnet.solana.com \
  --keypair ~/.config/solana/blitz-dev.json
```
- Deploy tx:
  - `2am8uwSecBckbHifdGsrZ1dzbkgpG8WG1nespBbXCd6FSQjqATM1sRWiwXvPVPWRNGhW82sv1Wji6L9sxWcexMb1`

### Delegation program presence
- On standard Solana devnet:
  - `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh` **exists**
- On `https://devnet.magicblock.app` via `solana program show`:
  - not discoverable there via that command
- Important nuance:
  - post-delegation execution for this app should target the **TEE endpoint** (`tee.magicblock.app`) because the program delegates specifically to validator `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA`

### Client bug fixed
The original devnet delegation failure was **not** because the delegation program was missing.
It was a client bug.

Fixed in `client/index.ts`:
- `buffer_pda` was being derived with `DELEGATION_PROGRAM_ID`
- correct derivation uses the **owner program** (`PROGRAM_ID`)

After this fix:
- `initialize_score` succeeded on devnet
- `delegate_to_per` succeeded on devnet

### Actual devnet execution results
#### First useful L1 devnet run (`https://api.devnet.solana.com`)
Transactions:
- `initialize_escrow`:
  - `4jhjMjvZEjwFRbKbSDwGoQ5XxW954vnf6AEgeWDZyX3sXYLRanZvqyTLjtcLsWhCoGn53X7HgwUypVYQxZvMFLK`
- `initialize_score`:
  - `VksvFhn9tFHC8paFpKPtLuKMtiqAt9nKwrSBb8Qc6TPoXhH1TbGS2ySHPsDDgRfdcARSYEJDLGyEnxHv4t2mBaM`
- `delegate_to_per`:
  - `46HeLWZ4zUJ35PXAk4jaZMKJwySmrhhB8vyn7hBPfzCsdYigXKwkhXLiptrShHqGBHGo91spkmjkRwRGv6inbT9H`

Observed behavior:
- `submit_score` sent to **L1 devnet** fails with:
  - `AccountOwnedByWrongProgram`
  - left owner: `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`
  - right owner expected by Anchor: `GyT8wyGD3dG3sVQ986SGwKxF23iWNjdbSe4oCuBrkMdd`

Diagnosis:
- this is actually the expected signal that delegation worked
- after delegation, the account is no longer writable on plain L1 through the normal owner-program path
- `submit_score` must be sent through the MagicBlock delegated execution path, not standard devnet RPC

#### Second useful run (attempting delegated execution)
- `initialize_escrow`:
  - `5su8wbhiESGENiG8AtVJKcai7WG3CGyAHQRwudNZWcJULDokg4g6RfxkLFUYmGvJgegbpC8pU5ri1WkxhrAqbnaA`
- `initialize_score`:
  - `nuU5XuhqT72s7CvgKg6MYo85h4HJ2yXySie4VGrq6TxFUZyCwePnJZqnb8Tqw6zQh8oxxcUcfu7TS3DmAamGepu`
- `delegate_to_per`:
  - `4e235UHi4TESFtA1iNBTNfZrdinxZRvKYkZjiCRu9neTbM93T2GZujv54UoQAZLWLAz4LHSP7Ztk5QEXEo2TfzkS`

Attempted post-delegation write against `https://devnet.magicblock.app`:
- `submit_score` failed with:
  - `transaction verification error: Transaction loads a writable account that cannot be written`

Diagnosis:
- this strongly suggests I was still targeting the wrong post-delegation endpoint for this validator
- the validator configured in-program is the **TEE validator** (`FnE6...`), so the next hop should be **`https://tee.magicblock.app?token=...`**, not the plain devnet ER RPC

### TEE auth path validated
I confirmed the TEE auth flow works from the wallet keypair itself:
- `GET https://tee.magicblock.app/auth/challenge?pubkey=<wallet>` returned a valid challenge
- signing that challenge with the wallet private key and posting to `/auth/login` returned HTTP 200 + a JWT token
- `getVersion` on `https://tee.magicblock.app?token=...` returned:
  - `magicblock-core: 0.8.3`
  - `solana-core: 2.2.1`

This means the missing piece is now very likely:
1. use **TEE endpoint + token** for delegated txs
2. rerun with enough devnet SOL still available for setup txs

### Wallet / funding state
Current wallet state:
- `d4ST3N4Vkio1Xsg2NaF6Zox7Xq8MdqWihvyip9AHioR`
- balance: `0.0009348 SOL`

I attempted multiple airdrops on devnet and MagicBlock devnet.
Results:
- standard devnet faucet: rate limited / dry
- MagicBlock devnet airdrop via JSON-RPC: disabled

So completion is blocked on fresh devnet SOL.

## What changed this session

### 1) Anchor/SBF build fixed
#### Real fix that worked
Solana CLI `2.1.21` ships SBF platform-tools `v1.43` with rustc `1.79.0-dev`, which is too old for:
- `solana-program@4.0.0`
- `indexmap@2.13.0`
- `proc-macro-crate@3.5.0`
- other transitive crates needing rustc `>=1.81`

What worked:
1. `cargo-build-sbf --tools-version v1.48 --force-tools-install`
2. Added wrapper script at `~/bin/cargo-build-sbf` so `anchor build` automatically uses `--tools-version v1.48`
3. Put `~/bin` before Solana bin dir in `PATH`

#### Program fixes made so build/IDL succeed
Updated `programs/oracle-escrow/src/lib.rs`:
- added missing `oracle_signer` to `DelegateToPer`
- added missing `/// CHECK:` comments required by Anchor IDL lint
- changed `EscrowAccount` to a PDA using seeds:
  - `[b"escrow", depositor.key().as_ref()]`
- added `attested: bool` to `OgmaScore`
- initialize score now sets `attested = false`
- `undelegate_and_finalize` now sets `attested = true` before commit
- added recipient/depositor validation errors for release/refund paths

Updated `programs/oracle-escrow/Cargo.toml`:
- added:
  - `idl-build = ["anchor-lang/idl-build"]`

### 2) Program build artifacts
Successful outputs:
- `target/deploy/oracle_escrow.so`
- `target/idl/oracle_escrow.json`

Program ID remains:
- `GyT8wyGD3dG3sVQ986SGwKxF23iWNjdbSe4oCuBrkMdd`

This is already wired in:
- `programs/oracle-escrow/src/lib.rs`
- `Anchor.toml`

### 3) Localnet deploy
`anchor deploy` uploaded program bytes but was flaky around IDL post-processing / upload.
Reliable path that worked:
```bash
solana program deploy target/deploy/oracle_escrow.so \
  --program-id target/deploy/oracle_escrow-keypair.json \
  --url http://127.0.0.1:8899 \
  --keypair ~/.config/solana/blitz-dev.json
```

Successful localnet deploy tx:
- `4gvXYYmB26sefjJ2D3PQJXrF3ZovvfSwb7yVinVZCGnjJQxpRnkTGZ7DtGnXMqnJVhcJhJTroMzcMJdFReBVtUcS`

### 4) TypeScript client wired to IDL
Created/updated:
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `client/index.ts`
- `client/e2e.ts`

Installed deps:
- `@coral-xyz/anchor`
- `@solana/web3.js`
- `@magicblock-labs/ephemeral-rollups-sdk`
- `typescript`
- `ts-node`

Implemented in `client/index.ts`:
- `anansiDeposit(...)`
- `ogmaDelegate(...)`
- `ogmaSubmitScore(...)`
- `commitAndRelease(...)`
- `showStatus(...)`

Notes:
- client uses `require('../target/idl/oracle_escrow.json')`
- delegation/undelegation are intentionally caught and mocked on plain localnet because MagicBlock validator/programs are not present there

### 5) End-to-end localnet flow
Ran successfully with fresh generated Anansi + Ogma keypairs on localnet.

#### Final successful happy-path txs
1. `initializeEscrow`
   - `3QKxqM28hqMadRMkTsj7pMAj3jX9SVEEjEttroFepRycrNyN9Un27JMYcw3zj3EvrmxMgxxNBxkzdyEdQbfA3P2R`
2. `initializeScore`
   - `5YmaUiVkcJS8SmQfFKJZnwJQK2YdGstxWRrDUbhJ6rdNKWtscFCupAvTMLDgXUjUVyFDUBtzsWcsiaLzGR1chWqi`
3. `delegateToPer`
   - `LOCALNET_MOCK`
4. `submitScore(8)`
   - `sP2hA4HpfF9MBXb8MR6f3vuiHcAczDgyfhE4CYdeVgLyfCYQDzQMuRt3G3b4TLAofEK3zTSaPcHkRyGNFYYnYUu`
5. `undelegateAndFinalize`
   - `LOCALNET_MOCK`
6. `releasePayment`
   - `3PzkfuE1VRXGVPMNwrEgW38L5CJkgKrc4zPDB64csqhrFJRmBJnekZsKQZ4249ACLu3P7RQwCbApNjGNS975MHKP`

#### Final state from `showStatus()`
OgmaScore:
- `value = 8`
- `attested = false` (expected on plain localnet mock path)

EscrowAccount:
- `amount = 0.05 SOL`
- `threshold = 7`
- `paid = true`

## Current blockers / caveats

### Blocker 1 — MagicBlock delegate/commit cannot run on plain `solana-test-validator`
Expected localnet errors seen:
- `delegate_to_per` fails seed/program validation without MagicBlock delegation program + runtime
- `undelegate_and_finalize` fails `magic_program` validation without MagicBlock runtime

So current localnet result is:
- **payment flow works**
- **TEE attestation path is mocked**
- `score.attested` remains `false`

### Blocker 2 — `anchor deploy` is less reliable than direct `solana program deploy`
The binary deploy succeeded, but IDL upload/init behavior on localnet was flaky.
For now, use direct `solana program deploy` for smoke tests.

### Blocker 3 — TEE execution path still not fully exercised end-to-end
What is now proven:
- L1 deploy works
- `initialize_score` works on devnet
- `delegate_to_per` works on devnet
- TEE auth challenge/login works and returns a usable JWT token

What is **not** yet proven in one uninterrupted run:
- `submit_score` through `https://tee.magicblock.app?token=...`
- `undelegate_and_finalize` through the TEE endpoint
- `oracle_signer` / `attested = true` after real commit back to L1
- final `release_payment` after real undelegation path

Likely reason for the last failed delegated write:
- I used `https://devnet.magicblock.app` instead of the TEE endpoint that matches validator `FnE6...`

### Blocker 4 — Devnet wallet depleted
Current wallet:
- `~/.config/solana/blitz-dev.json`
- `d4ST3N4Vkio1Xsg2NaF6Zox7Xq8MdqWihvyip9AHioR`
- balance: `0.0009348 SOL`

Without more devnet SOL, I cannot rerun the full path after switching the client to the proper TEE endpoint.

### Blocker 5 — `anchor test --skip-local-validator`
There is no `tests/` directory yet, and `Anchor.toml` still points to a Yarn-based test command:
```toml
[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```
Current failure:
- `bash: yarn: command not found`

This is not the PER blocker; it just means there are no proper Anchor tests wired yet.

## ✅ DEVNET E2E COMPLETE (2026-03-22 09:20 AEDT)

Full end-to-end TEE flow executed successfully on Solana devnet:

### All 6 transactions confirmed:
1. **initializeEscrow** → `5qwXqLPkpthaKEQFWp52CxGpqju52QgssEK1GLUc8d5R9d5CZepft45Mc9pi73L4SN14Uc64eah1RhTkcpNGJzA6`
   - Escrow: `ADpJGC6dwA1xmZ8zfZxNoATwisga9bg4YY3axMrkKr9W`
   - 0.001 SOL, threshold=7, depositor=Anansi, recipient=Ogma

2. **initializeScore** → `4rb1NV1YrWvM7qZUsUS8V7JLgzZ9i8Ci7Hq6Uy9pve1HprtYXQTnWEqY6vg5Vsg74y4nVERZS8K3SojBL7zxUJFw`
   - Score PDA: `Go8iewAvoRdLyUwE6tfPgXdvBMXuwUXLtncj9Y94hK5p`
   - Story hash: `ca6dc5bb78f54533bf9f4f92f2ef8bdcd9e3e2de1308e915ba5edad56f57f19a`

3. **delegateToPer** → `57bCCNcK8ngtF2XAKD7UmQ888TuqUi59gXFVRdCWZJDkgUWFsxcjR2oyPKG48xXKjuU4p4BBVmcTxCKDotLvyPUa`
   - Delegation to TEE validator `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA`
   - Permission account created + delegated successfully
   - Confirmed active on TEE

4. **submitScore(8)** → `MVcFep3kfNQUskfBTAXKrK89dzvq9z1uKtjXKwPfaWUYjNuny8AHzFadSCiokPTaochcsS2CxXivZeedPA7NMBt`
   - Executed on **`https://tee.magicblock.app?token=...`** (TEE endpoint, not plain devnet.magicblock.app)
   - Post-delegation write on MagicBlock ER succeeded

5. **undelegateAndFinalize** → `K2iWtKz1wGzTtWKHCcAf9ansrNXHMCeWnCq7u6ZbqpN4yyiUWU65V1VcW9Cr2uCPNRdtz5dJHJQgcWaLm45khvB`
   - Executed on TEE
   - Sets `attested = true`
   - Commits score back to L1
   - Account ownership returned to L1 validator

6. **releasePayment** → `3hmKTQeBd6qPJsZR9hgzVXGF6Lr27h5ewCCMts2j71CYC9Q18K3ZBVYnULUQQDdqGnqzsgtFM3m9ogzCsCC7QRmU`
   - Executed on L1
   - Payment released: `escrow.paid = true`

### Final account state (L1):
```
OgmaScore:
  value: 8
  attested: true ✅ (proof of TEE execution)
  oracleSigner: 8N7hTzB32GgHbz1Zyf8N4qR39SRVsmsTvWUYnSRVwzHD
  storyHash: ca6dc5bb78f54533bf9f4f92f2ef8bdcd9e3e2de1308e915ba5edad56f57f19a
  scoredAt: 2026-03-22T09:20:58.000Z

EscrowAccount:
  depositor: 7okssUWiNn6JrRyFB2AsVSgdtjP2v9bngAypTctxGbDp
  recipient: 8N7hTzB32GgHbz1Zyf8N4qR39SRVsmsTvWUYnSRVwzHD
  amount: 0.001 SOL
  threshold: 7
  paid: true ✅
```

### Key fix
Changed e2e.ts default `MAGICBLOCK_RPC` from `https://devnet.magicblock.app` to **`https://tee.magicblock.app`**.
This is the correct TEE post-delegation endpoint for validator `FnE6...`.

### What this proves
- ✅ Program deployed to devnet and operational
- ✅ Full delegation flow works on devnet
- ✅ TEE escrow execution path works
- ✅ Undelegate + L1 commit works
- ✅ Payment release logic works
- ✅ `attested` flag correctly set on TEE, persists on L1
- ✅ All 6 transaction signatures recorded on-chain

## Next Steps (Post-Blitz)
1. Wire `/score-and-submit` endpoint (scorer integration — need API key source clarification)
2. Add proper npm/ts-mocha test harness
3. Separate explicit `SOLANA_RPC` + `TEE_RPC` env vars
4. Add retry logic for TEE execution (currently hardcoded 10s wait + 5 retries)
5. Security: move auth token generation to backend, never expose in client URLs

## Questions Resolved
- **TEE endpoint:** confirmed `https://tee.magicblock.app` is the correct post-delegation path for validator `FnE6...`
- **Attestation flag:** confirmed `attested` is only set after TEE execution and undelegate
- **Payment release:** confirmed works on L1 after successful TEE round trip

## Quick commands that now work
Build:
```bash
cd ~/projects/verified-agent-oracles
source "$HOME/.cargo/env"
export PATH="$HOME/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
anchor build
```

Run local validator:
```bash
solana-test-validator --reset
```

Deploy binary directly:
```bash
solana program deploy target/deploy/oracle_escrow.so \
  --program-id target/deploy/oracle_escrow-keypair.json \
  --url http://127.0.0.1:8899 \
  --keypair ~/.config/solana/blitz-dev.json
```

Run end-to-end demo:
```bash
/opt/homebrew/Cellar/node@24/24.14.0_1/bin/npx ts-node client/e2e.ts
```
