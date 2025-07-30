import mongoose from "mongoose";
import { economyConnection } from "../db/Mongoosse";

export interface IBank extends mongoose.Document {
  bankId: string;
  balance: number;
  shards: number;
  totalTransactions: number;
  lastUpdated: Date;
}

const BankSchema = new mongoose.Schema<IBank>({
  bankId: { type: String, required: true, index: true, default: "server-bank" },
  balance: { type: Number, required: true, default: 1000000 }, 
  shards: { type: Number, required: true, default: 10000 },   
  totalTransactions: { type: Number, required: true, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
}, {
  collection: 'bank'
});

export const BankModel = economyConnection.model<IBank>('Bank', BankSchema);

// Create the bank if it doesn't exist yet
export async function ensureBank() {
  const bankId = "server-bank";
  let bank = await BankModel.findOne({ bankId });
  if (!bank) {
    bank = new BankModel({ bankId });
    await bank.save();
  }
  return bank;
}
