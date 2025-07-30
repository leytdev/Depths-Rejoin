import mongoose from "mongoose";
import { mongoUrl } from "../config";
import DepthsLogger from "../client/DepthsLogger";

export default class Mongoosse {
  public inited: boolean = false;
  public ping: number = -1;
  private logger = new DepthsLogger();

  async connect() {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoUrl, { autoIndex: true });
    await this.getPing();
    setInterval(() => this.getPing(), 300_000);
    this.inited = true;
  }

  private async getPing() {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        this.ping = -1;
        this.logger.error('Ping error: no db connection');
        return;
      }
      const ping = await db.admin().ping();
      if (ping?.ok) {
        this.ping = ping.ok;
        this.logger.success(`Database MongoDB is inited! Ping: ${this.ping}`);
      }
    } catch (e) {
      this.ping = -1;
      this.logger.error('Ping error');
    }
  }
}

export const economyConnection = mongoose.createConnection(
  'mongodb+srv://leyt:QaU9yjBdtNgqTAcl@leytdev.4xni7.mongodb.net/economy?retryWrites=true&w=majority&appName=leytDev'
); 