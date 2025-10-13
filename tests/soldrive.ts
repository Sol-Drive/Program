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
  });
});