import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Soldrive } from "../target/types/soldrive";
import { expect } from "chai";

describe("soldrive", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Soldrive as Program<Soldrive>;
  const authority = provider.wallet;

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
        config: configPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize transaction:", tx);

    const configAccount = await program.account.solDriveConfig.fetch(configPda);
    expect(configAccount.authority.toString()).to.equal(authority.publicKey.toString());
    expect(configAccount.totalFiles.toNumber()).to.equal(0);
  });

  
});