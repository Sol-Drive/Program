import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Soldrive } from "../target/types/soldrive";
import { expect } from "chai";
import * as crypto from "crypto";

describe("soldrive", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Soldrive as Program<Soldrive>;
  const authority = provider.wallet;

  // We'll reuse this user across tests
  let testUser: anchor.web3.Keypair;
  let userProfilePda: anchor.web3.PublicKey;

  before(async () => {
    // Create test user and profile
    testUser = anchor.web3.Keypair.generate();
    
    // Airdrop SOL to test user
    const signature = await provider.connection.requestAirdrop(
      testUser.publicKey,
      5 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Create user profile PDA
    [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), testUser.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Says hello!", async () => {
    const tx = await program.methods
      .helloSoldrive()
      .rpc();
    
    console.log("Hello transaction:", tx);
  });

  it("Initializes the program config", async () => {
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    const tx = await program.methods
      .initialize()
      .accounts({
        authority: authority.publicKey,
      })
      .rpc();

    console.log("Initialize transaction:", tx);

    const configAccount = await program.account.solDriveConfig.fetch(configPda);
    expect(configAccount.totalFiles.toNumber()).to.equal(0);
  });

  it("Creates user profile", async () => {
    const tx = await program.methods
      .createUserProfile()
      .accounts({
        user: testUser.publicKey,
      })
      .signers([testUser])
      .rpc();

    console.log("Create user profile transaction:", tx);

    const userProfile = await program.account.userProfile.fetch(userProfilePda);
    expect(userProfile.owner.toString()).to.equal(testUser.publicKey.toString());
    expect(userProfile.filesOwned.toNumber()).to.equal(0);
  });it("creates a file record", async () => {
    // mock file data
    const fileName = "vacation_photo.jpg";
    const fileSize = new anchor.BN(1024 * 1024); // 1mb
    const fileHash = crypto.randomBytes(32); // random 32-byte hash
    const chunkCount = 4; // 1mb file split into 4 chunks of 256kb each
  
    // get current timestamp for pda seed
    const timestamp = Math.floor(Date.now() / 1000);
    
    // find file record pda
    const [fileRecordPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("file"), 
        testUser.publicKey.toBuffer(), 
        Buffer.from(timestamp.toString().padStart(16, "0"))
      ],
      program.programId
    );
  
    // get config pda
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
  
    console.log("creating file:");
    console.log("- name:", fileName);
    console.log("- size:", fileSize.toString(), "bytes");
    console.log("- chunks:", chunkCount);
    console.log("- file record pda:", fileRecordPda.toString());
  
    // create the file
    const tx = await program.methods
      .createFile(fileName, fileSize, Array.from(fileHash), chunkCount, new anchor.BN(timestamp))
      .accounts({
        owner: testUser.publicKey,
      })
      .signers([testUser])
      .rpc();
  
    console.log("create file transaction:", tx);
  
    // verify the file was created correctly
    const fileRecord = await program.account.fileRecord.fetch(fileRecordPda);
    
    console.log("file record created:");
    console.log("- owner:", fileRecord.owner.toString());
    console.log("- name:", fileRecord.fileName);
    console.log("- size:", fileRecord.fileSize.toString());
    console.log("- chunks:", fileRecord.chunkCount);
    console.log("- status:", Object.keys(fileRecord.status)[0]);
    console.log("- created at:", new Date(fileRecord.createdAt.toNumber() * 1000));
  
    // verify the data
    expect(fileRecord.owner.toString()).to.equal(testUser.publicKey.toString());
    expect(fileRecord.fileName).to.equal(fileName);
    expect(fileRecord.fileSize.toString()).to.equal(fileSize.toString());
    expect(fileRecord.chunkCount).to.equal(chunkCount);
    expect(Object.keys(fileRecord.status)[0]).to.equal("uploading");
    expect(fileRecord.isPublic).to.equal(false);
  
    // check that user profile was updated
    const updatedUserProfile = await program.account.userProfile.fetch(userProfilePda);
    expect(updatedUserProfile.filesOwned.toNumber()).to.equal(1);
    expect(updatedUserProfile.storageUsed.toString()).to.equal(fileSize.toString());
  
    // check that global config was updated
    const updatedConfig = await program.account.solDriveConfig.fetch(configPda);
    expect(updatedConfig.totalFiles.toNumber()).to.equal(1);
  });
  

});