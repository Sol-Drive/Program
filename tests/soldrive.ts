import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Soldrive } from "../target/types/soldrive";
import { expect } from "chai";
import * as crypto from "crypto";
import { BN } from "bn.js";

describe("soldrive", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Soldrive as Program<Soldrive>;
  const authority = provider.wallet;

  //  reuse this user across tests
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
   
  
  it("creates a file record", async () => {
    // mock file data
    const fileName = "vacation_photo.jpg";
    const fileSize = new anchor.BN(1024 * 1024); // 1 MB
    const fileHash = crypto.randomBytes(32); // random 32-byte hash
    const chunkCount = 4;
    const timestamp = Math.floor(Date.now() / 1000);

    // derive PDAs
    const [fileRecordPda,bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("file"),
        testUser.publicKey.toBuffer(),
        Buffer.from(fileName)
      ],
      program.programId
    );
    console.log("File record PDA (client):", fileRecordPda.toBase58());


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

    // fetch the file record
    const fileRecord = await program.account.fileRecord.fetch(fileRecordPda);
    console.log("file record created:", fileRecord);

    // assertions
    expect(fileRecord.owner.toString()).to.equal(testUser.publicKey.toString());
    expect(fileRecord.fileName).to.equal(fileName);
    expect(fileRecord.fileSize.toString()).to.equal(fileSize.toString());
    expect(fileRecord.chunkCount).to.equal(chunkCount);
    expect(Object.keys(fileRecord.status)[0]).to.equal("uploading");
    expect(fileRecord.isPublic).to.equal(false);

    // verify user profile updated
    const updatedUserProfile = await program.account.userProfile.fetch(userProfilePda);
    expect(updatedUserProfile.filesOwned.toNumber()).to.equal(1);
    expect(updatedUserProfile.storageUsed.toString()).to.equal(fileSize.toString());

    // verify config updated
    const updatedConfig = await program.account.solDriveConfig.fetch(configPda);
    expect(updatedConfig.totalFiles.toNumber()).to.equal(1);
  });

  it("creates multiple files for the same user", async () => {
  const files = [
    { name: "document.pdf", size: 512 * 1024, chunks: 2 }, // 512 KB
    { name: "music.mp3", size: 2 * 1024 * 1024, chunks: 8 }, // 2 MB
    { name: "video.mp4", size: 5 * 1024 * 1024, chunks: 20 }, // 5 MB
  ];

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  let totalStorage = 0;

  for (const f of files) {
    const timestamp = Math.floor(Date.now() / 1000);
    const fileHash = crypto.randomBytes(32);
    totalStorage += f.size;

    const [fileRecordPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("file"),
        testUser.publicKey.toBuffer(),
        Buffer.from(f.name),
      ],
      program.programId
    );

    console.log("Creating file:");
    console.log("name:", f.name);
    console.log(" size:", f.size, "bytes");
    console.log(" chunks:", f.chunks);
    console.log(" file record pda:", fileRecordPda.toString());

    const tx = await program.methods
      .createFile(
        f.name,
        new anchor.BN(f.size),
        Array.from(fileHash),
        f.chunks,
        new anchor.BN(timestamp)
      )
      .accounts({
        owner: testUser.publicKey,
      })
      .signers([testUser])
      .rpc();

    console.log(" File created, tx:", tx);

    const fileRecord = await program.account.fileRecord.fetch(fileRecordPda);
    expect(fileRecord.owner.toString()).to.equal(testUser.publicKey.toString());
    expect(fileRecord.fileName).to.equal(f.name);
    expect(fileRecord.fileSize.toString()).to.equal(f.size.toString());
    expect(fileRecord.chunkCount).to.equal(f.chunks);
    expect(Object.keys(fileRecord.status)[0]).to.equal("uploading");
  }

  // check updated profile
  const userProfile = await program.account.userProfile.fetch(userProfilePda);
  expect(userProfile.filesOwned.toNumber()).to.equal(files.length + 1); // include first file
  expect(userProfile.storageUsed.toNumber()).to.equal(totalStorage + 1024 * 1024); // include first file's 1MB

  // check updated config
  const configAccount = await program.account.solDriveConfig.fetch(configPda);
  expect(configAccount.totalFiles.toNumber()).to.equal(files.length + 1);
});

it("registers storage for a file (IPFS CID + merkle root)", async () => {
  // use one of the files created before (e.g., vacation_photo.jpg)
  const fileName = "vacation_photo.jpg";

  // derive file PDA
  const [fileRecordPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("file"),
      testUser.publicKey.toBuffer(),
      Buffer.from(fileName),
    ],
    program.programId
  );

  // sample IPFS CID and merkle root
  const primaryStorage = "bafybeigdyrandomipfscidexample12345";
  const merkleRoot = new Uint8Array(32).fill(9);

  console.log("registering storage for:", fileName);
  console.log("file pda:", fileRecordPda.toBase58());
  console.log("ipfs cid:", primaryStorage);

  // call the register_storage instruction
  const tx = await program.methods
    .registerStorage(primaryStorage, Array.from(merkleRoot))
    .accounts({
      fileRecord: fileRecordPda,
      owner : testUser.publicKey
    })
    .signers([testUser])
    .rpc();

  console.log("register_storage transaction:", tx);

  // fetch the updated file record
  const fileRecord = await program.account.fileRecord.fetch(fileRecordPda);

  // assertions
  expect(fileRecord.primaryStorage).to.equal(primaryStorage);
  expect(fileRecord.merkleRoot).to.deep.equal(Array.from(merkleRoot));
  expect(Object.keys(fileRecord.status)[0]).to.equal("processing");

  console.log("storage registered successfully for:", fileRecord.fileName);
});
it("finalizes a file successfully after storage registration", async () => {
  // create file data
  const fileName = "finalizable_file.jpg";
  const fileSize = new anchor.BN(1024 * 1024);
  const fileHash = crypto.randomBytes(32);
  const chunkCount = 4;
  const timestamp = Math.floor(Date.now() / 1000);

  // derive pdas
  const [fileRecordPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("file"),
      testUser.publicKey.toBuffer(),
      Buffer.from(fileName),
    ],
    program.programId
  );

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  // create file
  await program.methods
    .createFile(fileName, fileSize, Array.from(fileHash), chunkCount,new anchor.BN(timestamp))
    .accounts({
      fileRecord: fileRecordPda,
      config: configPda,
      userProfile: userProfilePda,
      owner: testUser.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,    })
    .signers([testUser])
    .rpc();

  console.log("file created:", fileName);

  // register storage (ipfs)
  const ipfsCid = "bafybeigdyrzt5examplecidforfinalization";
  const merkleRoot = crypto.randomBytes(32);

  await program.methods
    .registerStorage(ipfsCid, Array.from(merkleRoot))
    .accounts({
      fileRecord: fileRecordPda,
      owner: testUser.publicKey,
    })
    .signers([testUser])
    .rpc();

  console.log("storage registered:", ipfsCid);

  // finalize file
  const tx = await program.methods
    .finalizeFile()
    .accounts({
      fileRecord: fileRecordPda,
      owner: testUser.publicKey,
    })
    .signers([testUser])
    .rpc();

  console.log("finalize tx:", tx);

  // fetch updated file record
  const fileRecord = await program.account.fileRecord.fetch(fileRecordPda);

  // check file status
  expect(Object.keys(fileRecord.status)[0]).to.equal("active");
  expect(fileRecord.primaryStorage).to.equal(ipfsCid);

  console.log("file finalized successfully");
});
it("fails to finalize without storage registration", async () => {
  // create file data
  const fileName = "no_storage_file.jpg";
  const fileSize = new anchor.BN(512 * 1024);
  const fileHash = crypto.randomBytes(32);
  const chunkCount = 2;
  const timestamp = Math.floor(Date.now() / 1000) + 100;

  // derive pdas
  const [fileRecordPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("file"),
      testUser.publicKey.toBuffer(),
Buffer.from(fileName),    ],
    program.programId
  );

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  // create file
  await program.methods
    .createFile(fileName, fileSize, Array.from(fileHash), chunkCount, new BN(timestamp))
    .accounts({
      fileRecord: fileRecordPda,
      config: configPda,
      userProfile: userProfilePda,
      owner: testUser.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([testUser])
    .rpc();

  console.log("file created (no storage):", fileName);

  // try finalizing without storage
  try {
    await program.methods
      .finalizeFile()
      .accounts({
        fileRecord: fileRecordPda,
        owner: testUser.publicKey,
      })
      .signers([testUser])
      .rpc();

    // should not reach here
    expect.fail("should have failed to finalize without storage");
  } catch (error) {
    // check for correct error
    expect(error.toString()).to.include("InvalidFileStatus");
    console.log("finalization prevented as expected");
  }
});


});
