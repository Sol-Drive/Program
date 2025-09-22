use anchor_lang::prelude::*;

// This will be your program ID (we'll update it after building)
declare_id!("11111111111111111111111111111111");

#[program]
pub mod soldrive {
    use super::*;
    
    // Our first simple instruction - just prints a message
    pub fn hello_soldrive(ctx: Context<HelloSoldrive>) -> Result<()> {
        msg!("Hello from SolDrive! ");
        Ok(())
    }
}

// Context for our hello instruction (empty for now)
#[derive(Accounts)]
pub struct HelloSoldrive {}