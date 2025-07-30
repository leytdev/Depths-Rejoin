import mongoose from "mongoose";
import { economyConnection } from "../db/Mongoosse";

export interface ITransaction extends mongoose.Document {
  senderUID: string;
  receiverUID: string;
  amount: number;
  currency: "coins" | "shards";
  timestamp: Date;
  type: string;
}

const TransactionSchema = new mongoose.Schema<ITransaction>({
  senderUID: { type: String, required: true, index: true },
  receiverUID: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true, enum: ["coins", "shards"] },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, required: true }
}, {
  collection: 'transactions'
});

export const TransactionModel = economyConnection.model<ITransaction>('Transaction', TransactionSchema);
