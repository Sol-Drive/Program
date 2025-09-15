use anchor_lang::prelude::*;

declare_id!("CxDoRt3Nt5z747KNW6vkVxvQQ7c2dHMmGmoWNmxejA3f");

#[program]
pub mod soldrive {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
