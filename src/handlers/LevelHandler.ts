import { Client, Message, VoiceState, Events, GuildMember, Collection, Invite, Guild, GatewayIntentBits } from 'discord.js';
import { processMessage, processVoiceState, updateUserRoles, addXP, checkReferrals, addReferral, ensureLevelEntry } from '../Utils/LevelSystem';

export class LevelHandler {
  private voiceCheckInterval: NodeJS.Timeout | null = null;
  private client: Client;
  private invitesCache: Map<string, Collection<string, Invite>>;

  constructor(client: Client) {
    console.log('[LEVELS-DEBUG] Initializing LevelHandler');
    this.client = client;
    this.invitesCache = new Map();
    this.initializeEventListeners();

    console.log('[LEVELS-DEBUG] Checking client intents:', {
      guilds: client.options.intents.has(GatewayIntentBits.Guilds),
      members: client.options.intents.has(GatewayIntentBits.GuildMembers),
      invites: client.options.intents.has(GatewayIntentBits.GuildInvites),
    });

    // Запускаем периодическую проверку рефералов каждый день
    setInterval(checkReferrals, 24 * 60 * 60 * 1000);

    // Вызываем проверку рефералов при запуске для отладки
    console.log('[LEVELS-DEBUG] Running initial referral check...');
    checkReferrals().then(() => {
      console.log('[LEVELS-DEBUG] Initial referral check completed');
    }).catch(error => {
      console.error('[LEVELS-DEBUG] Error during initial referral check:', error);
    });

    console.log('[LEVELS-DEBUG] LevelHandler initialized');
  }

  private initializeEventListeners(): void {
    // Обработка сообщений для начисления XP
    this.client.on(Events.MessageCreate, this.handleMessage.bind(this));

    // Обработка изменений в голосовых каналах
    this.client.on(Events.VoiceStateUpdate, this.handleVoiceStateUpdate.bind(this));

    // Запускаем периодическую проверку пользователей в голосовых каналах
    this.startVoiceCheckInterval();

    // Ежедневный бонус теперь интегрирован непосредственно в команду /daily

    // Отслеживание инвайтов
    this.client.on(Events.ClientReady, this.handleReady.bind(this));
    this.client.on(Events.InviteCreate, this.handleInviteCreate.bind(this));
    this.client.on(Events.GuildMemberAdd, this.handleGuildMemberAdd.bind(this));
  }

  // Кэширование инвайтов при запуске бота
  private async handleReady(): Promise<void> {
    console.log('[LEVELS-DEBUG] Bot ready event fired, caching invites...');
    try {
      for (const guild of this.client.guilds.cache.values()) {
        console.log(`[LEVELS-DEBUG] Checking permissions for guild ${guild.name} (${guild.id})`);

        // Проверка прав бота
        const botMember = guild.members.me;
        if (!botMember) {
          console.log(`[LEVELS-DEBUG] Bot is not a member of guild ${guild.name}`);
          continue;
        }

        const hasManageGuildPerm = botMember.permissions.has('ManageGuild');
        console.log(`[LEVELS-DEBUG] Bot has ManageGuild permission in ${guild.name}: ${hasManageGuildPerm}`);

        if (!hasManageGuildPerm) {
          console.log(`[LEVELS-DEBUG] Bot does not have permission to view invites in ${guild.name}`);
          continue;
        }

        try {
          console.log(`[LEVELS-DEBUG] Attempting to fetch invites for guild ${guild.name} (${guild.id})`);
          const guildInvites = await guild.invites.fetch();
          this.invitesCache.set(guild.id, guildInvites);
          console.log(`[LEVELS-DEBUG] Successfully cached ${guildInvites.size} invites for guild ${guild.name}`);

          // Вывод деталей каждого инвайта для отладки
          guildInvites.forEach(invite => {
            console.log(`[LEVELS-DEBUG] Invite ${invite.code}: created by ${invite.inviterId || 'Unknown'}, uses: ${invite.uses}`);
          });
        } catch (inviteError) {
          console.error(`[LEVELS-DEBUG] Failed to fetch invites for guild ${guild.name}:`, inviteError);
        }
      }
    } catch (error) {
      console.error('[LEVELS-DEBUG] Error in handleReady:', error);
    }
    console.log('[LEVELS-DEBUG] Invite caching process completed');
  }

  // Обновление кэша при создании нового инвайта
  private handleInviteCreate(invite: Invite): void {
    console.log(`[LEVELS-DEBUG] New invite created: ${invite.code} by ${invite.inviterId || 'Unknown'}`);
    if (invite.guild) {
      const guildInvites = this.invitesCache.get(invite.guild.id) || new Collection();
      guildInvites.set(invite.code, invite);
      this.invitesCache.set(invite.guild.id, guildInvites);
      console.log(`[LEVELS-DEBUG] Added invite ${invite.code} to cache for guild ${invite.guild.name}`);
    }
  }

  // Обработка входа нового пользователя на сервер
  private async handleGuildMemberAdd(member: GuildMember): Promise<void> {
    console.log(`[LEVELS-DEBUG] GuildMemberAdd event fired! New member joined: ${member.user.tag} (${member.id}) to guild ${member.guild.name} (${member.guild.id})`);

    // Проверяем, есть ли у нас закэшированные инвайты для этой гильдии
    const cachedInvites = this.invitesCache.get(member.guild.id);
    console.log(`[LEVELS-DEBUG] Cache status for guild ${member.guild.id}: ${cachedInvites ? `${cachedInvites.size} invites cached` : 'No cached invites'}`);

    if (member.user.bot) {
      console.log(`[LEVELS-DEBUG] Ignoring bot user: ${member.user.tag}`);
      return;
    }

    // Импортируем модуль LevelModel для доступа к схеме
    const { ensureLevelEntry } = require('../Utils/LevelSystem');

    // Создаем запись для нового участника и устанавливаем дату присоединения
    try {
      const levelEntry = await ensureLevelEntry(member.id);
      levelEntry.joinedTimestamp = new Date();
      await levelEntry.save();
      console.log(`[LEVELS-DEBUG] Created/updated level entry for new member ${member.id} with join timestamp ${levelEntry.joinedTimestamp}`);
    } catch (dbError) {
      console.error(`[LEVELS-DEBUG] Error updating level entry with join timestamp:`, dbError);
    }

    try {
      // Получаем текущие инвайты
      const newInvites = await member.guild.invites.fetch();
      // Получаем старые инвайты из кэша
      const oldInvites = this.invitesCache.get(member.guild.id) || new Collection();
      console.log(`[LEVELS-DEBUG] Comparing invites: ${oldInvites.size} old vs ${newInvites.size} new`);

      // Находим инвайт, который был использован (у него количество использований увеличилось)
      let usedInvite: Invite | undefined;

      // Сначала проверяем, есть ли инвайты, которые были использованы
      for (const [code, newInvite] of newInvites) {
        const oldInvite = oldInvites.get(code);
        if (oldInvite && newInvite.uses && oldInvite.uses && newInvite.uses > oldInvite.uses) {
          usedInvite = newInvite;
          console.log(`[LEVELS-DEBUG] Found used invite: ${code} (uses: ${oldInvite.uses} -> ${newInvite.uses})`);
          break;
        }
      }

      // Обновляем кэш
      this.invitesCache.set(member.guild.id, newInvites);

      // Если нашли использованный инвайт и у него есть inviterId
      if (usedInvite && usedInvite.inviterId) {
        console.log(`[LEVELS-DEBUG] Member ${member.id} was invited by ${usedInvite.inviterId} using invite ${usedInvite.code}`);

        try {
          // Добавляем реферала
          const success = await addReferral(usedInvite.inviterId, member.id);
          console.log(`[LEVELS-DEBUG] Referral registration ${success ? 'succeeded' : 'failed'}`);

          if (!success) {
            console.log(`[LEVELS-DEBUG] Referral not added. Possible reasons: already in list or monthly limit reached.`);
          }
        } catch (referralError) {
          console.error(`[LEVELS-DEBUG] Error adding referral:`, referralError);
        }
      } else {
        console.log(`[LEVELS-DEBUG] Could not determine who invited member ${member.id} using standard method`);
        // Если нам не удалось определить инвайт, используем альтернативный метод
        console.log(`[LEVELS-DEBUG] Using alternative method - finding most recent invite`);

        // Поиск самого недавнего инвайта с использованиями
        let mostRecentInvite: Invite | undefined;
        let highestUses = 0;

        for (const [code, invite] of newInvites) {
          if (invite.uses && invite.uses > 0 && invite.inviterId) {
            console.log(`[LEVELS-DEBUG] Potential invite found: ${code} by ${invite.inviterId} (${invite.uses} uses)`);

            // Выбираем инвайт с наибольшим количеством использований как наиболее вероятный
            if (invite.uses > highestUses) {
              mostRecentInvite = invite;
              highestUses = invite.uses;
              console.log(`[LEVELS-DEBUG] New highest-use invite: ${code} with ${invite.uses} uses`);
            }
          }
        }

        if (mostRecentInvite && mostRecentInvite.inviterId) {
          console.log(`[LEVELS-DEBUG] Using most-used invite: ${mostRecentInvite.code} by ${mostRecentInvite.inviterId}`);

          try {
            // Добавляем реферала, используя наиболее вероятный инвайт
            const success = await addReferral(mostRecentInvite.inviterId, member.id);
            console.log(`[LEVELS-DEBUG] Referral registration using alternative method ${success ? 'succeeded' : 'failed'}`);

            if (!success) {
              console.log(`[LEVELS-DEBUG] Alternative referral not added. Possible reasons: already in list or monthly limit reached.`);
            }
          } catch (referralError) {
            console.error(`[LEVELS-DEBUG] Error adding alternative referral:`, referralError);
          }
        } else {
          console.log(`[LEVELS-DEBUG] Could not find any suitable invite for member ${member.id}`);
        }
      }
    } catch (error) {
      console.error(`[LEVELS-DEBUG] Error processing new member: ${error}`);
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild) return;

    try {
      const xpGained = await processMessage(message);

      if (xpGained > 0 && message.member) {
        const { oldLevel, newLevel } = await this.checkLevelUp(message.author.id, message.member);
      }
    } catch (error) {
      console.error('Error processing message for XP:', error);
    }
  }

  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (newState.member?.user.bot) return;

    try {
      const xpGained = await processVoiceState(oldState, newState);

      if (xpGained > 0 && newState.member) {
        const { oldLevel, newLevel } = await this.checkLevelUp(newState.id, newState.member);
      }
    } catch (error) {
      console.error('Error processing voice state for XP:', error);
    }
  }

  /**
   * Запускает периодическую проверку пользователей в голосовых каналах
   */
  private startVoiceCheckInterval() {
    // Проверяем каждые 5 минут
    this.voiceCheckInterval = setInterval(() => this.checkActiveVoiceUsers(), 5 * 60 * 1000);
    console.log('[LEVELS-DEBUG] Voice check interval started');
  }

  /**
   * Останавливает периодическую проверку пользователей в голосовых каналах
   */
  public stopVoiceCheckInterval() {
    if (this.voiceCheckInterval) {
      clearInterval(this.voiceCheckInterval);
      this.voiceCheckInterval = null;
      console.log('[LEVELS-DEBUG] Voice check interval stopped');
    }
  }

  /**
   * Проверяет всех активных пользователей в голосовых каналах и обновляет их опыт
   */
  private async checkActiveVoiceUsers() {
    try {
      console.log('[LEVELS-DEBUG] Checking active voice users...');
      let activeUsersCount = 0;

      // Проходим по всем серверам, на которых присутствует бот
      for (const guild of this.client.guilds.cache.values()) {
        // Проходим по всем голосовым каналам сервера
        for (const voiceChannel of guild.channels.cache.filter(c => c.isVoiceBased()).values()) {
          // Пропускаем AFK каналы
          if (voiceChannel.name.toLowerCase().includes('afk')) continue;

          // Проходим по всем участникам канала
          for (const member of voiceChannel.members.values()) {
            // Пропускаем ботов
            if (member.user.bot) continue;

            // Проверяем, что пользователь не в мьюте и не в дефе
            if (!member.voice.selfMute && !member.voice.selfDeaf && voiceChannel.members.size > 1) {
              activeUsersCount++;

              // Получаем запись пользователя в БД
              const entry = await ensureLevelEntry(member.id);
              const now = new Date();

              // Если нет метки времени начала, устанавливаем её
              if (!entry.lastVoiceTimestamp) {
                entry.lastVoiceTimestamp = now;
                await entry.save();
                continue;
              }

              // Рассчитываем время в канале и начисляем XP
              const timeInVoice = (now.getTime() - entry.lastVoiceTimestamp.getTime()) / (1000 * 60);
              if (timeInVoice >= 5) { // Начисляем XP только если прошло не менее 5 минут
                const xpBase = Math.floor(timeInVoice * 1); // 1 XP за минуту
                const xpBonus = member.voice.streaming ? Math.floor(timeInVoice * 0.5) : 0; // +0.5 XP/мин за стрим

                const xpEarned = xpBase + xpBonus;
                await addXP(member.id, xpEarned);

                // Обновляем счетчик времени и устанавливаем новую метку
                entry.voiceTimeToday = (entry.voiceTimeToday || 0) + Math.floor(timeInVoice);
                entry.lastVoiceTimestamp = now;
                await entry.save();

                console.log(`[LEVELS-DEBUG] User ${member.user.username} earned ${xpEarned} XP for ${timeInVoice.toFixed(1)} minutes in voice`);
              }
            }
          }
        }
      }

      console.log(`[LEVELS-DEBUG] Checked ${activeUsersCount} active voice users`);
    } catch (error) {
      console.error('Error checking active voice users:', error);
    }
  }

  /**
   * Проверяет, поднялся ли уровень пользователя, и обновляет роли
   */
  private async checkLevelUp(userId: string, member: GuildMember): Promise<{ oldLevel: number; newLevel: number }> {
    const levelInfo = await addXP(userId, 0); // Не добавляем XP, просто получаем текущую информацию

    // Если уровень повысился, обновляем роли
    if (levelInfo.newLevel > levelInfo.oldLevel) {
      await updateUserRoles(member, levelInfo.newLevel);
    }

    return levelInfo;
  }
}
