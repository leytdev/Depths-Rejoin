import mongoose from "mongoose";
import { economyConnection } from "../db/Mongoosse";

export interface IBalance extends mongoose.Document {
  UID: string;
  balance: number;
  DepthsShards: number;
}

const BalanceSchema = new mongoose.Schema<IBalance>({
  UID: { type: String, required: true, index: true },
  balance: { type: Number, required: true, default: 0 },
  DepthsShards: { type: Number, required: true, default: 0 }
}, {
  collection: 'balance'
});

export const BalanceModel = economyConnection.model<IBalance>('Balance', BalanceSchema); 