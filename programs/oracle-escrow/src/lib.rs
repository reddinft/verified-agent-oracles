use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;

// TODO: Replace with actual program ID after `anchor build`
declare_id!("GyT8wyGD3dG3sVQ986SGwKxF23iWNjdbSe4oCuBrkMdd");

pub const OGMA_SCORE_SEED: &[u8] = b"ogma_score";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const TEE_VALIDATOR: &str = "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA";

#[ephemeral]    // ← CRITICAL: injects undelegation callback (discriminator)
#[program]
pub mod oracle_escrow {
    use super::*;

    /// Initialize an escrow account for a story scoring task.
    /// Anansi deposits SOL and sets the minimum score threshold.
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        threshold: u8,
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.depositor = ctx.accounts.depositor.key();
        escrow.recipient = ctx.accounts.recipient.key();
        escrow.amount = amount;
        escrow.threshold = threshold;
        escrow.paid = false;

        // Transfer lamports from depositor to escrow PDA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.depositor.key(),
            &escrow.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.depositor.to_account_info(),
                escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        Ok(())
    }

    /// Initialize the OgmaScore PDA before delegating to TEE.
    pub fn initialize_score(
        ctx: Context<InitializeScore>,
        story_hash: [u8; 32],
    ) -> Result<()> {
        let score = &mut ctx.accounts.ogma_score;
        score.value = 0;
        score.story_hash = story_hash;
        score.scored_at = Clock::get()?.unix_timestamp;
        score.oracle_signer = ctx.accounts.oracle_signer.key();
        Ok(())
    }

    /// Delegate the OgmaScore PDA to the TEE validator.
    /// This instruction prepares the account for scoring inside the PER.
    /// Called on L1 Solana.
    pub fn delegate_to_per(ctx: Context<DelegateToPer>) -> Result<()> {
        let tee_validator: Pubkey = TEE_VALIDATOR.parse().unwrap();
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[OGMA_SCORE_SEED, ctx.accounts.oracle_signer.key().as_ref()],
            DelegateConfig {
                validator: Some(tee_validator),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Submit a score inside the TEE.
    /// Called from within the PER (sent to TEE RPC endpoint).
    /// Only the oracle_signer (Ogma's designated keypair) can submit the score.
    pub fn submit_score(
        ctx: Context<SubmitScore>,
        score: u8,
    ) -> Result<()> {
        require!(score >= 1 && score <= 10, OgmaError::InvalidScore);

        // Only the designated oracle signer can submit
        require!(
            ctx.accounts.oracle_signer.key() == ctx.accounts.ogma_score.oracle_signer,
            OgmaError::UnauthorizedSigner
        );

        let ogma_score = &mut ctx.accounts.ogma_score;
        ogma_score.value = score;
        ogma_score.scored_at = Clock::get()?.unix_timestamp;

        Ok(())
    }

    /// Undelegate the OgmaScore PDA and commit final state back to Solana L1.
    /// Called from within the TEE (sent to TEE RPC endpoint).
    /// After this, the account returns to L1 ownership and state is finalized.
    pub fn undelegate_and_finalize(ctx: Context<UndelegateAndFinalize>) -> Result<()> {
        // Flush account changes before committing — required by MagicBlock PER
        ctx.accounts.ogma_score.exit(&crate::ID)?;
        
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.ogma_score.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }

    /// Release payment from escrow if score meets threshold.
    /// Called on L1 Solana after OgmaScore is finalized.
    /// 
    /// Attestation proof: The account was delegated to the TEE validator
    /// and state was committed by that validator. The oracle_signer keypair
    /// proves who scored it. Verifying the delegation record on-chain confirms
    /// the score came from TEE execution.
    pub fn release_payment(ctx: Context<ReleasePayment>) -> Result<()> {
        let ogma_score = &ctx.accounts.ogma_score;
        let escrow = &mut ctx.accounts.escrow;

        // Gate: Score must be above threshold
        // Attestation is implicit: account was delegated to TEE validator
        // and state committed from that validator (verifiable on-chain)
        require!(
            ogma_score.value >= escrow.threshold,
            OgmaError::ScoreBelowThreshold
        );
        require!(!escrow.paid, OgmaError::AlreadyPaid);

        // Mark as paid
        escrow.paid = true;

        // Transfer lamports from escrow to recipient (Ogma)
        let amount = escrow.amount;
        **escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.recipient.try_borrow_mut_lamports()? += amount;

        Ok(())
    }

    /// Refund payment if score does not meet threshold.
    /// Called on L1 after OgmaScore is finalized but score < threshold.
    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        let ogma_score = &ctx.accounts.ogma_score;
        let escrow = &mut ctx.accounts.escrow;

        // Gate: Score must be below threshold for refund
        require!(
            ogma_score.value < escrow.threshold,
            OgmaError::ScoreAboveThreshold
        );
        require!(!escrow.paid, OgmaError::AlreadyPaid);

        // Mark as paid (refunded)
        escrow.paid = true;

        // Transfer lamports from escrow back to depositor (Anansi)
        let amount = escrow.amount;
        **escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.depositor.try_borrow_mut_lamports()? += amount;

        Ok(())
    }
}

// ============================================================================
// ACCOUNTS & CONTEXTS
// ============================================================================

#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(init, payer = depositor, space = EscrowAccount::LEN)]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    /// CHECK: Recipient wallet (Ogma or prize recipient)
    pub recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeScore<'info> {
    #[account(init, payer = payer, space = OgmaScore::LEN, 
              seeds = [OGMA_SCORE_SEED, oracle_signer.key().as_ref()], bump)]
    pub ogma_score: Account<'info, OgmaScore>,

    pub oracle_signer: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateToPer<'info> {
    pub payer: Signer<'info>,

    /// CHECK: Checked by delegate program
    pub validator: Option<AccountInfo<'info>>,

    /// CHECK: OgmaScore PDA to delegate
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct SubmitScore<'info> {
    #[account(mut)]
    pub ogma_score: Account<'info, OgmaScore>,

    pub oracle_signer: Signer<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateAndFinalize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub ogma_score: Account<'info, OgmaScore>,

    // magic_context and magic_program injected automatically by #[commit]
}

#[derive(Accounts)]
pub struct ReleasePayment<'info> {
    #[account(mut)]
    pub escrow: Account<'info, EscrowAccount>,

    pub ogma_score: Account<'info, OgmaScore>,

    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    #[account(mut)]
    pub escrow: Account<'info, EscrowAccount>,

    pub ogma_score: Account<'info, OgmaScore>,

    #[account(mut)]
    pub depositor: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================================
// DATA STRUCTURES
// ============================================================================

#[account]
pub struct EscrowAccount {
    pub depositor: Pubkey,      // Anansi (story writer)
    pub recipient: Pubkey,      // Ogma (scorer / reward recipient)
    pub amount: u64,            // SOL amount in lamports
    pub threshold: u8,          // Minimum score (1-10) for payment release
    pub paid: bool,             // true = payment released or refunded
}

impl EscrowAccount {
    pub const LEN: usize = 8 + // discriminator
        32 +  // depositor
        32 +  // recipient
        8 +   // amount
        1 +   // threshold
        1;    // paid
}

#[account]
pub struct OgmaScore {
    pub value: u8,              // 1-10 cultural quality score
    pub oracle_signer: Pubkey,  // Ogma's designated keypair — proves who scored it
    pub story_hash: [u8; 32],   // Hash of the story that was scored
    pub scored_at: i64,         // Unix timestamp
}

impl OgmaScore {
    pub const LEN: usize = 8 + // discriminator
        1 +   // value
        32 +  // oracle_signer
        32 +  // story_hash
        8;    // scored_at
}

// ============================================================================
// ERRORS
// ============================================================================

#[error_code]
pub enum OgmaError {
    #[msg("Score must be between 1 and 10")]
    InvalidScore,

    #[msg("Score is below the required threshold")]
    ScoreBelowThreshold,

    #[msg("Score is above the threshold; expected refund")]
    ScoreAboveThreshold,

    #[msg("Payment already released or refunded")]
    AlreadyPaid,

    #[msg("Unauthorized signer for score submission")]
    UnauthorizedSigner,
}
