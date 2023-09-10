import {
  Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js';
import fetch from 'cross-fetch';
import dotenv from "dotenv";
import promiseRetry from "promise-retry";
import {Wallet} from '@project-serum/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createSyncNativeInstruction,
  getAssociatedTokenAddress, TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {QuoteResponse, SwapInstructions, SwapInstructionsInstruction} from "./types";

dotenv.config();
const connection = new Connection(process.env.RPC_ENDPOINT || "");
const wallet = new Wallet(Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.BOT_PKEY || ""))));
console.log(wallet.publicKey);
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const SOL_MINT = "So11111111111111111111111111111111111111112";

const createWSolAccount = async () => {
  const wsolAddress = await getAssociatedTokenAddress(
    new PublicKey(SOL_MINT),
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const wsolAccount = await connection.getAccountInfo(wsolAddress);

  if (!wsolAccount) {
    const {blockhash} = await connection.getLatestBlockhash();

    const instructions = [
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        wsolAddress,
        wallet.publicKey,
        new PublicKey(SOL_MINT),
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wsolAddress,
        lamports: 0.1 * LAMPORTS_PER_SOL, // 0.1 sol
      }),
      createSyncNativeInstruction(wsolAddress, TOKEN_PROGRAM_ID)
    ];

    const msg = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
      instructions
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg,);
    tx.sign([wallet.payer]);

    const result = await connection.sendTransaction(tx);
    console.log({result});
  }

  return wsolAccount;
};

const getCoinQuote = async (inputMint: string, outputMint: string, amount: string | number, swapMode: "ExactIn" | "ExactOut" = "ExactIn"): Promise<QuoteResponse> =>
  (await fetch(`https://quote-api.jup.ag/v6/quote?outputMint=${outputMint}&inputMint=${inputMint}&amount=${amount}&slippageBps=50&swapMode=${swapMode}`)).json();

const getSwapTx = async (quoteResponse: QuoteResponse) => (await fetch('https://quote-api.jup.ag/v6/swap-instructions', {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    userPublicKey: wallet.publicKey.toString(),
    quoteResponse,
    wrapAndUnwrapSol: false,
    //computeUnitPriceMicroLamports: 1_000_000
  })
})).json();

const getConfirmTx = async (txId: string) => {
  const res = await promiseRetry(async (retry, attempt) => {
    console.log("Attempt ", attempt);
    let txResult = await connection.getParsedTransaction(txId, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    });

    if (!txResult) {
      const error = new Error("Transaction was not confirmed" + txId);

      retry(error);
      return;
    }
    return txResult;
  }, {
    retries: 40,
    minTimeout: 500,
    maxTimeout: 1000,
  });

  if (res?.meta?.err) {
    throw new Error("Transaction failed " + txId);
  }
  return txId;
}

const initial = 5 * 1_000_000;

(async () => {
  await createWSolAccount();

  while (true) {
    const usdcToSol = await getCoinQuote(USDT_MINT, SOL_MINT, initial);
    const solToUsdc = await getCoinQuote(SOL_MINT, USDT_MINT, usdcToSol.outAmount);
    const outAmt = Number(solToUsdc.outAmount);

    console.log(`Retry at ${new Date()}. Initial: ${initial / 1_000_000}. Final: ${outAmt / 1_000_000}`);
    // if (outAmt > initial) {
    const usdcToSolIx: SwapInstructions = await getSwapTx(usdcToSol);
    const solToUsdcIx: SwapInstructions = await getSwapTx(solToUsdc);

    const {blockhash} = await connection.getLatestBlockhash();
    const toTxIns = (ins: SwapInstructionsInstruction | SwapInstructionsInstruction[]) => {
      const txIns: TransactionInstruction[] = [];

      if (Array.isArray(ins)) {
        ins.forEach(it => {
          txIns.push({
            data: Buffer.from(it.data),
            keys: it.accounts.map(it => ({...it, pubkey: new PublicKey(it.pubkey)})),
            programId: new PublicKey(it.programId)
          })
        })
      } else {
        txIns.push({
          data: Buffer.from(ins.data),
          keys: ins.accounts.map(it => ({...it, pubkey: new PublicKey(it.pubkey)})),
          programId: new PublicKey(ins.programId)
        })
      }

      return txIns;
    }

    const instructions: TransactionInstruction[] =  [
      ...toTxIns(usdcToSolIx.computeBudgetInstructions),
      ...toTxIns(usdcToSolIx.setupInstructions),
      ...toTxIns(usdcToSolIx.swapInstruction),
      ...toTxIns(solToUsdcIx.setupInstructions),
      ...toTxIns(solToUsdcIx.swapInstruction)
    ];

    const msg = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(msg);
    tx.sign([wallet.payer]);

    console.log(JSON.stringify(await connection.simulateTransaction(tx)))
    // const txid = await connection.sendTransaction(tx);
    //
    // try {
    //   await getConfirmTx(txid);
    //   console.log(`Success https://solscan.io/tx/${txid}`);
    // } catch (err) {
    //   console.log(err);
    // }

    // await swap(usdcToSol);
    // await swap(solToUsdc);
    break;
    // }
  }
})();