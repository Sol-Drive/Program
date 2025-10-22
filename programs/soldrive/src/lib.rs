use anchor_lang::prelude::*;

// This is program ID (we'll update it after building)
declare_id!("CxDoRt3Nt5z747KNW6vkVxvQQ7c2dHMmGmoWNmxejA3f");

#[program]
pub mod soldrive {
    use super::*;
    
    // Our first simple instruction - just prints a message
    pub fn hello_soldrive(ctx: Context<HelloSoldrive>) -> Result<()> {
        let config = &ctx.accounts;
        //just a simple placeholder and so other image insetion logic in the solana bc
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

    pub fn create_user_profile(ctx: Context<CreateUserProfile>) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.owner = ctx.accounts.user.key();
        user_profile.files_owned = 0;
        user_profile.storage_used = 0;
        user_profile.storage_paid_until = 0;
        // Start with good reputation
        user_profile.reputation_score = 100; 
        
        msg!("User profile created for {}", ctx.accounts.user.key());
        Ok(())
    }
    pub fn create_file(
        ctx: Context<CreateFile>,
        file_name: String,
        file_size: u64,
        file_hash: [u8; 32],
        chunk_count: u32,
        timestamp: i64,
    ) -> Result<()> {
        // input validation
        require!(file_name.len() <= 50, ErrorCode::FileNameTooLong);
        require!(file_size > 0, ErrorCode::InvalidFileSize);
        require!(chunk_count > 0, ErrorCode::InvalidChunkCount);
        
        let file_record = &mut ctx.accounts.file_record;
        
        // Set file record data
        file_record.owner = ctx.accounts.owner.key();
        file_record.file_name = file_name.clone();
        file_record.file_size = file_size;
        file_record.file_hash = file_hash;
        file_record.chunk_count = chunk_count;
        file_record.created_at = timestamp;
        file_record.updated_at = timestamp;
        file_record.status = FileStatus::Uploading;
        file_record.is_public = false;
        // Empty until storage is registered
        file_record.primary_storage = String::new(); 
        // Will be set when storage is registered
        file_record.merkle_root = [0; 32]; 
        
        // Update global stats
        let config = &mut ctx.accounts.config;
        config.total_files += 1;
        
        // Update user profile
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.files_owned += 1;
        user_profile.storage_used += file_size;
        
        msg!("File created: {} ({} bytes, {} chunks)", file_name, file_size, chunk_count);
        Ok(())
    }

    // register storage location (ipfs cid)
pub fn register_storage(
    ctx: Context<RegisterStorage>,
    primary_storage: String,
    merkle_root: [u8; 32],
) -> Result<()> {
    // validate input
    require!(primary_storage.len() <= 100, ErrorCode::StorageLocationTooLong);
    require!(primary_storage.len() > 0, ErrorCode::StorageLocationEmpty);
    
    let file_record = &mut ctx.accounts.file_record;
    let clock = Clock::get()?;
    
    // update file metadata
    file_record.primary_storage = primary_storage.clone();
    file_record.merkle_root = merkle_root;
    file_record.status = FileStatus::Processing;
    file_record.updated_at = clock.unix_timestamp;
    
    msg!("storage registered: {}", primary_storage);
    Ok(())
}
// mark a file as fully uploaded and active
pub fn finalize_file(ctx: Context<FinalizeFile>) -> Result<()> {
    // get mutable access to the file record
    let file_record = &mut ctx.accounts.file_record;
    // fetch current blockchain timestamp
    let clock = Clock::get()?;
    
    // ensure the file is currently in 'processing' state
    require!(
        file_record.status == FileStatus::Processing,
        ErrorCode::InvalidFileStatus
    );
    // ensure storage location (ipfs cid) is already registered
    require!(
        !file_record.primary_storage.is_empty(),
        ErrorCode::NoStorageLocation
    );
    
    // update status to 'active' meaning file is finalized and ready
    file_record.status = FileStatus::Active;
    // record the update time
    file_record.updated_at = clock.unix_timestamp;
    
    // log confirmation message
    msg!("file finalized and ready: {}", file_record.file_name);
    Ok(())
}

pub fn grant_access(
    ctx: Context<GrantAccess>,
    shared_with: Pubkey,
    access_level: AccessLevel,
    expires_at: Option<i64>,
) -> Result<()> {
    let shared_access = &mut ctx.accounts.shared_access;
    let clock = Clock::get()?;
    
    // check that the file is still active before sharing
    require!(
        ctx.accounts.file_record.status == FileStatus::Active,
        ErrorCode::FileNotActive
    );
    
    // if expiration time is provided, make sure it’s set in the future
    if let Some(expiry) = expires_at {
        require!(expiry > clock.unix_timestamp, ErrorCode::InvalidExpirationTime);
    }
    
    // link to the file being shared
    shared_access.file_record = ctx.accounts.file_record.key();
    
    // set the original file owner
    shared_access.owner = ctx.accounts.owner.key();
    
    // user who is granted access
    shared_access.shared_with = shared_with;
    
    // define permission level
    shared_access.access_level = access_level.clone();
    
    // optional expiry timestamp
    shared_access.expires_at = expires_at;
    
    // record when sharing was created
    shared_access.created_at = clock.unix_timestamp;
    
    // mark as active share
    shared_access.is_active = true;
    
    // log info to program output
    msg!(
        "access granted to {} with level {:?}",
        shared_with,
        access_level
    );

    Ok(())
}
// revoke access from a user
pub fn revoke_access(ctx: Context<RevokeAccess>) -> Result<()> {
    let shared_access = &mut ctx.accounts.shared_access;
    
    // mark access as inactive
    shared_access.is_active = false;
    
    msg!("access revoked for: {}", shared_access.shared_with);
    Ok(())
}


}

// Context for our hello instruction (empty for now)
#[derive(Accounts)]
pub struct HelloSoldrive {}

#[derive(Accounts)]
pub struct  Initialize<'info> {
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

#[derive(Accounts)]
pub struct CreateUserProfile<'info>{
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 8 + 8 + 4, // discriminator + owner + files + storage + paid_until + reputation
        seeds = [b"user_profile", user.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub user: Signer<'info>,
    
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

// User profile data structure
#[account]
pub struct UserProfile{
     // User's wallet address
    pub owner: Pubkey,   
    // How many files they own        
    pub files_owned: u64,         
     // Total bytes they're storing
    pub storage_used: u64,       
    // When their storage payment expires
    pub storage_paid_until: i64,  
    pub reputation_score: u32, 
}

#[derive(Accounts)]
#[instruction(file_name: String)]
pub struct CreateFile<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 54 + 8 + 32 + 4 + 32 + 104 + 8 + 8 + 1 + 1, // discriminator + owner + name + size + hash + chunks + merkle + storage + created + updated + status + public
        seeds = [b"file", owner.key().as_ref(), file_name.as_bytes()],
        bump
    )]
    pub file_record: Account<'info, FileRecord>,
    
    #[account(
        mut,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, SolDriveConfig>,
    
    #[account(
        mut,
        seeds = [b"user_profile", owner.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

//  File record data structure
#[account]
pub struct FileRecord {
    pub owner: Pubkey,             
    pub file_name: String,          
    pub file_size: u64,            
    pub file_hash: [u8; 32],       
    pub chunk_count: u32,          
    pub merkle_root: [u8; 32],     
    pub primary_storage: String,    
    pub created_at: i64,           
    pub updated_at: i64,           
    pub status: FileStatus,       
    pub is_public: bool,           
}

// context for registering storage (ipfs cid + merkle root)
#[derive(Accounts)]
pub struct RegisterStorage<'info> {
    // file record to be updated with storage info
    // must belong to the owner and be in 'uploading' state
    #[account(
        mut,
        has_one = owner,
        constraint = file_record.status == FileStatus::Uploading @ ErrorCode::InvalidFileStatus
    )]
    pub file_record: Account<'info, FileRecord>,
    
    // wallet of the file owner who registers storage
    pub owner: Signer<'info>,
}
// context: verifies correct owner and file status before finalization
#[derive(Accounts)]
pub struct FinalizeFile<'info> {
    #[account(
        mut,
        has_one = owner,
        constraint = file_record.status == FileStatus::Processing @ ErrorCode::InvalidFileStatus
    )]
    pub file_record: Account<'info, FileRecord>,

    // signer must be the owner of the file
    pub owner: Signer<'info>,
}

//  context for granting access
#[derive(Accounts)]
#[instruction(shared_with: Pubkey)]
pub struct GrantAccess<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 32 + 32 + 1 + 9 + 8 + 1, // discriminator + file_record + owner + shared_with + access_level + expires_at + created_at + is_active
        seeds = [b"shared_access", file_record.key().as_ref(), shared_with.as_ref()],
        bump
    )]
    pub shared_access: Account<'info, SharedAccess>,
    
    #[account(has_one = owner)]
    pub file_record: Account<'info, FileRecord>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
// context for revoking access
#[derive(Accounts)]
pub struct RevokeAccess<'info> {
    #[account(
        mut,
        has_one = owner,
        has_one = file_record
    )]
    // shared access account to update its status
    pub shared_access: Account<'info, SharedAccess>,
    
    // file record associated with the shared access
    pub file_record: Account<'info, FileRecord>,
    
    // owner who is revoking access
    pub owner: Signer<'info>,
}


// shared access account
#[account]
pub struct SharedAccess {
    pub file_record: Pubkey,      // which file is being shared
    pub owner: Pubkey,            // original file owner
    pub shared_with: Pubkey,      // user who gets access
    pub access_level: AccessLevel, // what they can do
    pub expires_at: Option<i64>,  // when access expires (optional)
    pub created_at: i64,          // when sharing was created
    pub is_active: bool,          // can be revoked
}

//  Access level enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum AccessLevel {
    Read,      // Can only download
    Write,     // Can modify (future feature)
    Admin,     // Can share with others (future feature)
}

//  File status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum FileStatus {
    Uploading, 

    // File is fully uploaded and being verified   
    Processing,   
    Active, 

    // File is archived (not actively stored) archived means its moved to cold storage      
    Archived,     
    // File marked for deletion
    Deleted,     
}

//  Custom error codes
// Updated error codes
#[error_code]
pub enum ErrorCode {
    #[msg("File name is too long (max 50 characters)")]
    FileNameTooLong,
    #[msg("Invalid file size")]
    InvalidFileSize,
    #[msg("Invalid chunk count")]
    InvalidChunkCount,
    #[msg("Storage location string is too long (max 100 characters)")]
    StorageLocationTooLong,
    #[msg("Storage location cannot be empty")]
    StorageLocationEmpty,
    #[msg("Invalid file status for this operation")]
    InvalidFileStatus,
    #[msg("No storage location registered")]
    NoStorageLocation,
    #[msg("File must be active to share")]
    FileNotActive,
    #[msg("Expiration time must be in the future")]
    InvalidExpirationTime,
}