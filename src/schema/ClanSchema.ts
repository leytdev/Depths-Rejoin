import mongoose from "mongoose";
import { economyConnection } from "../db/Mongoosse";

export interface IClanMember {
  userId: string;
  role: "owner" | "deputy" | "member";
  joinedAt: Date;
}

export interface IClan extends mongoose.Document {
  name: string;
  clanId: string;
  description: string;
  ownerId: string;
  deputyId: string | null;
  members: IClanMember[];
  balance: number;
  xp: number;
  icon: string | null;
  color: string;
  createdAt: Date;
  invites: string[];
  roleId: string | null;
}

const ClanSchema = new mongoose.Schema<IClan>({
  name: { type: String, required: true },
  clanId: { type: String, required: true, unique: true },
  description: { type: String, default: "Описание клана отсутствует" },
  ownerId: { type: String, required: true },
  deputyId: { type: String, default: null },
  members: [
    {
      userId: { type: String, required: true },
      role: { type: String, enum: ["owner", "deputy", "member"], default: "member" },
      joinedAt: { type: Date, default: Date.now }
    }
  ],
  balance: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  icon: { type: String, default: null },
  color: { type: String, default: "#2f3136" },
  createdAt: { type: Date, default: Date.now },
  invites: [{ type: String }], // Список приглашенных пользователей
  roleId: { type: String, default: null } // ID роли клана на сервере
}, { collection: "clans" });

export const ClanModel = economyConnection.model<IClan>('Clan', ClanSchema);
