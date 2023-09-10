import {AccountMeta} from "@solana/web3.js";

interface MarketInfo {
  id: string;
  label: string;
  inputMint: string;
  outputMint: string;
  notEnoughLiquidity: boolean;
  inAmount: string;
  outAmount: string;
  minInAmount?: string | null;
  minOutAmount?: string | null;
  priceImpactPct: number;
  lpFee: {
    amount: string;
    mint: string;
    pct: number;
  };
  platformFee: {
    amount: string;
    mint: string;
    pct: number;
  };
}

interface Fees {
  signatureFee: number;
  openOrdersDeposits: number[];
  ataDeposits: number[];
  totalFeeAndDeposits: number;
  minimumSOLForTransaction: number;
}

interface MarketResponseData {
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  marketInfos: MarketInfo[];
  amount: string;
  slippageBps: number;
  minimum: number;
  maximum: number;
  otherAmountThreshold: string;
  swapMode: string;
  fees?: Fees | null;
}

interface MarketResponse {
  description: string;
  data: MarketResponseData[];
  timeTaken: number;
  contextSlot: number;
}

interface PlatformFee {
  amount?: string;
  feeBps?: number;
}

interface RoutePlan {
  swapInfo: object;
  ammKey: string;
  label?: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  feeAmount: string;
  feeMint: string;
  percent: number;
}

export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  platformFee?: PlatformFee;
  priceImpactPct: string;
  routePlan: RoutePlan[];
  ammKey: string;
  label?: string;
  contextSlot?: number;
  timeTaken?: number;
}


export interface SwapInstructionsInstruction {
  programId: string;
  accounts: AccountMeta[];
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
  data: string;
}

export interface SwapInstructions {
  tokenLedgerInstruction?: SwapInstructionsInstruction;
  computeBudgetInstructions: SwapInstructionsInstruction[];
  setupInstructions: SwapInstructionsInstruction[];
  swapInstruction: SwapInstructionsInstruction;
  cleanupInstruction?: SwapInstructionsInstruction;
  addressLookupTableAddresses: string[];
}
