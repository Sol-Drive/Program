use anchor_lang::prelude::*;

// This is program ID (we'll update it after building)
declare_id!("11111111111111111111111111111111");

#[program]
pub mod soldrive {
    use super::*;
    
    // Our first simple instruction - just prints a message
    pub fn hello_soldrive(ctx: Context<HelloSoldrive>) -> Result<()> {
        msg!("Hello from SolDrive! ");
        Ok(())
    }
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.total_files = 0;
        // 0.1 SOL per GB per month
        config.storage_fee_per_gb = 100_000_000; 
         // 1GB max file size
        config.max_file_size = 1_073_741_824;   
        
        msg!("SolDrive initialized! Authority: {}", config.authority);
        Ok(())
    }
}

// Context for our hello instruction (empty for now)
#[derive(Accounts)]
pub struct HelloSoldrive {}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 8, // discriminator + authority + total_files + fee + max_size
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, SolDriveConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
#[account]
pub struct SolDriveConfig {
     // Who can update settings
    pub authority: Pubkey,       
      // How many files stored total
    pub total_files: u64,       
    // Cost in lamports per GB per month
    pub storage_fee_per_gb: u64,  
     // Maximum file size allowed
    pub max_file_size: u64,      
}