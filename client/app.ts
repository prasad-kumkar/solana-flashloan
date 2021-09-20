/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';

import { getPayer, getRpcUrl, createKeypairFromFile } from './utils';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Keypair associated to the fees' payer
 */
let payer: Keypair;

/**
 * Hello world's program id
 */
let programId: PublicKey;

/**
 * The public key of the account we are saying hello to
 */

let initializer_pubkey: PublicKey;

let flashloan_token_account_pubkey: PublicKey;

let flashloan_program_account_pubkey: PublicKey;

let token_program_pubkey: PublicKey;

enum MyFlashloanProgramInstruction{
  InitMyFlashloanProgram,
  ExecuteOperation,
  MyFlashloanCall
}

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../dist/program');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running either:
 *   - `npm run build:program-c`
 *   - `npm run build:program-rust`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'solana_flashloan_template.so');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/helloworld.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'solana_flashloan_template-keypair.json');

/**
 * The state of a greeting account managed by the hello world program
 * 
 * initializer -> signer
 * flashloan_token_account
 * flashloan_program_account
 * token_program
 */


/**
 * The expected size of each greeting account.
 */
const GREETING_SIZE = 100;

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
}

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
  let fees = 0;
  if (!payer) {
    const { feeCalculator } = await connection.getRecentBlockhash();

    // Calculate the cost to fund the greeter account
    fees += await connection.getMinimumBalanceForRentExemption(GREETING_SIZE);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    payer = await getPayer();
  }

  let lamports = await connection.getBalance(payer.publicKey);
  if (lamports < fees) {
    // If current balance is not enough to pay for fees, request an airdrop
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      fees - lamports,
    );
    await connection.confirmTransaction(sig);
    lamports = await connection.getBalance(payer.publicKey);
  }

  console.log(
    'Using account',
    payer.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'SOL to pay for fees',
  );
}

/**
 * Check if the hello world BPF program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed`,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}`);

  // initializer
  const GREETING_SEED = 'hello1';
  initializer_pubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    GREETING_SEED,
    programId,
  );

  // Check if the greeting account has already been created
  const greetedAccount = await connection.getAccountInfo(initializer_pubkey);
  if (greetedAccount === null) {
    console.log(
      'Creating account',
      initializer_pubkey.toBase58()
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      GREETING_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        seed: GREETING_SEED,
        newAccountPubkey: initializer_pubkey,
        lamports,
        space: GREETING_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }


  // flashloan_token_account
  const FLASHLOAN_TOKEN_SEED = 'hello2';
  flashloan_token_account_pubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    FLASHLOAN_TOKEN_SEED,
    programId,
  );

  // Check if the greeting account has already been created
  const flashloanTokenAccount = await connection.getAccountInfo(flashloan_token_account_pubkey);
  if (flashloanTokenAccount === null) {
    console.log(
      'Creating account',
      flashloan_token_account_pubkey.toBase58()
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      GREETING_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        seed: FLASHLOAN_TOKEN_SEED,
        newAccountPubkey: flashloan_token_account_pubkey,
        lamports,
        space: GREETING_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }

  // flashloan_program_account
  const FLASHLOAN_PROGRAM_SEED = 'hello3';
  flashloan_program_account_pubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    FLASHLOAN_PROGRAM_SEED,
    programId,
  );

  // Check if the greeting account has already been created
  const flashloanProgramAccount = await connection.getAccountInfo(flashloan_program_account_pubkey);
  if (flashloanProgramAccount === null) {
    console.log(
      'Creating account',
      flashloan_program_account_pubkey.toBase58()
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      GREETING_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        seed: FLASHLOAN_PROGRAM_SEED,
        newAccountPubkey: flashloan_program_account_pubkey,
        lamports,
        space: GREETING_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);
    }
    // token_account
  const TOKEN_SEED = 'hello4';
  token_program_pubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    TOKEN_SEED,
    programId,
  );

  // Check if the greeting account has already been created
  const tokenAccount = await connection.getAccountInfo(token_program_pubkey);
  if (tokenAccount === null) {
    console.log(
      'Creating account',
      token_program_pubkey.toBase58()
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      GREETING_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        seed: TOKEN_SEED,
        newAccountPubkey: token_program_pubkey,
        lamports,
        space: GREETING_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }
}

/**
 * Say hello
 */
export async function sayHello(): Promise<void> {

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true }, 
      { pubkey: flashloan_token_account_pubkey, isSigner: false, isWritable: true },
      { pubkey: flashloan_program_account_pubkey, isSigner: false, isWritable: true }, 
      { pubkey: token_program_pubkey, isSigner: false, isWritable: true }
    ],
    programId,
    data: Buffer.from(JSON.stringify(MyFlashloanProgramInstruction.InitMyFlashloanProgram)), // All instructions are hellos
  });

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer],
  );
}

/**
 * Report the number of times the greeted account has been said hello to
 */
export async function reportGreetings(): Promise<void> {
  const accountInfo = await connection.getAccountInfo(flashloan_program_account_pubkey);
  if (accountInfo === null) {
    throw 'Error: cannot find the greeted account';
  }
  // const greeting = borsh.deserialize(
  //   GreetingSchema,
  //   GreetingAccount,
  //   accountInfo.data,
  // );
  // console.log(
  //   greetedPubkey.toBase58(),
  //   'has been greeted',
  //   greeting.counter,
  //   'time(s)',
  // );

  console.log(accountInfo.data)
}
