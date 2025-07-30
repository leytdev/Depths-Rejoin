import { Client, Options, Partials, GatewayIntentBits } from "discord.js";
import DepthsLogger from "./DepthsLogger";
import InteractionHandlers from "../handlers/InteractionHandlers";
import SlashCommandHandler from "../handlers/SlashCommandHandler";
import { LevelHandler } from "../handlers/LevelHandler";
import Mongoosse from "../db/Mongoosse";
import path from "path";
import { clientId, guildId } from "../config";

export class DepthsClient extends Client<true> {
  public logger: DepthsLogger;
  public interactions: InteractionHandlers;
  public slashCommands: SlashCommandHandler;
  public levelHandler!: LevelHandler; // ! означает, что поле будет инициализировано позже
  public mongo: Mongoosse;
  public clientId: string;
  public guildId: string;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
      ],
      partials: [Partials.GuildMember],
      allowedMentions: {
        parse: ['roles', 'users'],
        repliedUser: true,
      },
      sweepers: {
        messages: {
          interval: 1800,
          lifetime: 1800
        }
      },
      makeCache: Options.cacheWithLimits({
        MessageManager: {
          maxSize: 5,
          keepOverLimit: message => false,
        },
        GuildMemberManager: {
          maxSize: 100,
          keepOverLimit: member => Boolean(member?.voice?.channelId || member.permissions.has('Administrator'))
        },
        // Все остальные менеджеры отключены для экономии памяти
        ReactionManager: 0,
        GuildTextThreadManager: 0,
        GuildBanManager: 0,
        DMMessageManager: 0,
        GuildForumThreadManager: 0,
        GuildInviteManager: 0,
        GuildScheduledEventManager: 0,
        ReactionUserManager: 0,
        StageInstanceManager: 0,
        AutoModerationRuleManager: 0,
        ApplicationCommandManager: 0,
        ThreadMemberManager: 0
      })
    });
    this.logger = new DepthsLogger();
    this.slashCommands = new SlashCommandHandler(path.resolve(__dirname, "../app/SlashCommands"));
    this.interactions = new InteractionHandlers(
      path.resolve(__dirname, "../app/Modals"),
      path.resolve(__dirname, "../app/Buttons"),
      path.resolve(__dirname, "../app/Menus")
    );
    this.mongo = new Mongoosse();
    this.clientId = clientId;
    this.guildId = guildId;
  }

  async start(token: string) {
    this.logger.info("Starting bot...");
    await this.mongo.connect();
    await this.login(token);
    this.logger.success(`Bot started! ${this.user?.tag}`);
    await this.slashCommands.load();
    await this.interactions.loadAll();

    // Инициализация системы уровней после успешного входа
    this.levelHandler = new LevelHandler(this);
    this.logger.info("Level system initialized");

    this.slashCommands.listen(this);
  }
}
