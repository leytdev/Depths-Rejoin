import mongoose from "mongoose";
import { economyConnection } from "../db/Mongoosse";

export interface IDaily extends mongoose.Document {
  UID: string;
  Date: Date;
  Money: number;
  LastDaily: Date;
}

const DailySchema = new mongoose.Schema<IDaily>({
  UID: { type: String, required: true, index: true },
  Date: { type: Date, required: true },
  Money: { type: Number, required: true },
  LastDaily: { type: Date, required: true }
}, {
  collection: 'daily'
});

export const DailyModel = economyConnection.model<IDaily>('Daily', DailySchema);