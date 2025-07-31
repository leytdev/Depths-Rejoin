import { LevelModel } from '../schema/LevelSchema';
import { Message, VoiceState, GuildMember } from 'discord.js';
import {
  FIVE_LVL, TEN_LVL, FIFTEEN_LVL, TWENTY_LVL, TWENTYFIVE_LVL,
  THIRTY_LVL, THIRTYFIVE_LVL, FORTY_LVL, FORTYFIVE_LVL, FIFTY_LVL
} from './Ids';

// Константы системы опыта
const MAX_DAILY_MESSAGES = 20;                   // Максимальное количество сообщений за день, за которые дается опыт
const MESSAGE_XP = 15;                           // Количество опыта за сообщение
const MAX_MESSAGES_PER_MINUTE = 5;               // Максимальное количество сообщений в минуту для получения опыта
const VOICE_XP_PER_MINUTE = 6;                   // Количество опыта за минуту в голосовом канале
const STREAM_BONUS_XP_PER_MINUTE = 3;            // Бонусный опыт за стрим в минуту
const DAILY_BONUS_XP = 200;                      // Количество опыта за ежедневный бонус
const REFERRAL_XP = 2000;                        // Количество опыта за реферала
const REFERRAL_DAYS_THRESHOLD = 7;               // Количество дней, через которое начисляется опыт за реферала
const MAX_MONTHLY_REFERRALS = 3;                 // Максимальное количество рефералов в месяц

// Формула расчета XP для следующего уровня
export function xpForLevel(level: number): number {
  return Math.ceil(25 * Math.pow(level, 1.3));
}

// Таблица соответствия уровней и ролей
const LEVEL_ROLES = [
  { level: 5, roleId: FIVE_LVL },
  { level: 10, roleId: TEN_LVL },
  { level: 15, roleId: FIFTEEN_LVL },
  { level: 20, roleId: TWENTY_LVL },
  { level: 25, roleId: TWENTYFIVE_LVL },
  { level: 30, roleId: THIRTY_LVL },
  { level: 35, roleId: THIRTYFIVE_LVL },
  { level: 40, roleId: FORTY_LVL },
  { level: 45, roleId: FORTYFIVE_LVL },
  { level: 50, roleId: FIFTY_LVL }
];

/**
 * Обеспечивает наличие записи уровня для пользователя
 */
export async function ensureLevelEntry(UID: string) {
  let entry = await LevelModel.findOne({ UID });
  if (!entry) {
    entry = new LevelModel({ UID });
    await entry.save();
  }
  return entry;
}

import { updateMemberClanXP } from './ClanUtils';

/**
 * Добавляет опыт пользователю и обновляет его уровень
 */
export async function addXP(UID: string, amount: number): Promise<{ oldLevel: number; newLevel: number; totalXP: number }> {
  const entry = await ensureLevelEntry(UID);
  const oldLevel = entry.level;

  // Добавляем опыт
  entry.xp += amount;

  // Пересчитываем уровень
  let xpRequired = xpForLevel(entry.level);
  while (entry.xp >= xpRequired) {
    entry.level++;
    xpRequired = xpForLevel(entry.level);
  }

  await entry.save();

  // Обновляем XP клана, если пользователь состоит в клане
  try {
    await updateMemberClanXP(UID, amount);
  } catch (error) {
    console.error('Ошибка при обновлении XP клана:', error);
  }

  return { oldLevel, newLevel: entry.level, totalXP: entry.xp };
}

/**
 * Обрабатывает сообщение для начисления опыта
 */
export async function processMessage(message: Message): Promise<number> {
  // Игнорируем ботов и DM
  if (message.author.bot || !message.guild) return 0;

  const userId = message.author.id;
  const entry = await ensureLevelEntry(userId);

  // Проверяем дневной лимит сообщений
  if (entry.dailyMessageCount >= MAX_DAILY_MESSAGES) return 0;

  // Проверяем анти-спам (слишком частые сообщения)
  const now = new Date();
  if (entry.lastMessageTimestamp) {
    const timeDiff = now.getTime() - entry.lastMessageTimestamp.getTime();
    const minutesPassed = timeDiff / (1000 * 60);

    // Обновляем счетчик частоты сообщений
    if (minutesPassed < 1) {
      entry.messageFrequency = (entry.messageFrequency || 0) + 1;
    } else {
      entry.messageFrequency = 1;
    }

    // Проверяем, не превышена ли частота сообщений
    if (entry.messageFrequency > MAX_MESSAGES_PER_MINUTE) return 0;
  }

  // Игнорируем односложные сообщения
  const content = message.content.trim();
  if (content.split(/\s+/).length <= 1 && content.length < 5) return 0;

  // Начисляем опыт
  entry.lastMessageTimestamp = now;
  entry.dailyMessageCount++;
  await entry.save();

  return await addXP(userId, MESSAGE_XP).then(result => MESSAGE_XP);
}

/**
 * Обрабатывает изменение состояния голосового канала
 */
export async function processVoiceState(oldState: VoiceState, newState: VoiceState): Promise<number> {
  // Игнорируем ботов
  if (newState.member?.user.bot) return 0;

  const userId = newState.id;
  const entry = await ensureLevelEntry(userId);
  const now = new Date();

  let xpEarned = 0;

  if (oldState.channelId && (!newState.channelId || newState.channel?.name.toLowerCase().includes('afk'))) {
    if (entry.lastVoiceTimestamp) {
      const timeInVoiceMs = now.getTime() - entry.lastVoiceTimestamp.getTime();
      const timeInVoiceMin = timeInVoiceMs / (1000 * 60);
      const timeInVoiceSec = timeInVoiceMs / 1000;

      if (
        !oldState.selfMute &&
        !oldState.selfDeaf &&
        oldState.channel &&
        oldState.channel.members.size > 1
      ) {
        // Add XP only if they've been in voice for at least 1 minute
        if (timeInVoiceMin >= 1) {
          const xpBase = Math.floor(timeInVoiceMin * VOICE_XP_PER_MINUTE);
          const xpBonus = oldState.streaming ? Math.floor(timeInVoiceMin * STREAM_BONUS_XP_PER_MINUTE) : 0;

          xpEarned = xpBase + xpBonus;
          await addXP(userId, xpEarned);
        }

        // Always update voice time in seconds, even for short sessions
        entry.voiceTimeToday = (entry.voiceTimeToday || 0) + Math.floor(timeInVoiceSec);
        console.log(`[VOICE] User ${userId} spent ${Math.floor(timeInVoiceSec)} seconds in voice`);
      }      // Сбрасываем метку времени, так как пользователь вышел
      entry.lastVoiceTimestamp = undefined;
    }
  }
  // Пользователь зашел в канал (не AFK)
  else if (newState.channelId && !newState.channel?.name.toLowerCase().includes('afk')) {
    // Если пользователь зашел в канал или включил микрофон/звук
    if (
      !newState.selfMute &&
      !newState.selfDeaf &&
      newState.channel &&
      newState.channel.members.size > 1
    ) {
      // Устанавливаем метку времени начала подсчета
      entry.lastVoiceTimestamp = now;
    } else {
      // Если пользователь в AFK или один в канале, сбрасываем метку времени
      entry.lastVoiceTimestamp = undefined;
    }
  }

  else if (oldState.channelId && newState.channelId && oldState.channelId === newState.channelId) {

    if (
      (oldState.selfMute === false && newState.selfMute === true) ||
      (oldState.selfDeaf === false && newState.selfDeaf === true) ||
      (newState.channel && newState.channel.members.size <= 1)
    ) {

      if (entry.lastVoiceTimestamp) {
        const timeInVoiceMs = now.getTime() - entry.lastVoiceTimestamp.getTime();
        const timeInVoiceMin = timeInVoiceMs / (1000 * 60);
        const timeInVoiceSec = timeInVoiceMs / 1000;

        // Always update voice time in seconds, even for short sessions
        entry.voiceTimeToday = (entry.voiceTimeToday || 0) + Math.floor(timeInVoiceSec);
        console.log(`[VOICE] User ${userId} spent ${Math.floor(timeInVoiceSec)} seconds in voice (mute/deaf change)`);

        if (timeInVoiceMin >= 1) {
          const xpBase = Math.floor(timeInVoiceMin * VOICE_XP_PER_MINUTE);
          const xpBonus = oldState.streaming ? Math.floor(timeInVoiceMin * STREAM_BONUS_XP_PER_MINUTE) : 0;

          xpEarned = xpBase + xpBonus;
          await addXP(userId, xpEarned);
        }

        entry.lastVoiceTimestamp = undefined;
      }
    }

    else if (
      (oldState.selfMute === true && newState.selfMute === false) ||
      (oldState.selfDeaf === true && newState.selfDeaf === false)
    ) {
      // Если условия для начисления XP выполнены
      if (!newState.selfMute && !newState.selfDeaf && newState.channel && newState.channel.members.size > 1) {
        entry.lastVoiceTimestamp = now;
      }
    }
    // Если пользователь начал/прекратил стримить
    else if (oldState.streaming !== newState.streaming) {
      // Если начал стримить, просто продолжаем отсчет, бонус будет учтен при выходе
      // Если прекратил стримить, начисляем XP с бонусом за предыдущее время
      if (oldState.streaming && !newState.streaming && entry.lastVoiceTimestamp) {
        const timeInVoiceMs = now.getTime() - entry.lastVoiceTimestamp.getTime();
        const timeInVoiceMin = timeInVoiceMs / (1000 * 60);
        const timeInVoiceSec = timeInVoiceMs / 1000;

        // Always update voice time in seconds, even for short sessions
        entry.voiceTimeToday = (entry.voiceTimeToday || 0) + Math.floor(timeInVoiceSec);
        console.log(`[VOICE] User ${userId} spent ${Math.floor(timeInVoiceSec)} seconds in voice (streaming change)`);

        if (timeInVoiceMin >= 1) {
          const xpBase = Math.floor(timeInVoiceMin * VOICE_XP_PER_MINUTE);
          const xpBonus = Math.floor(timeInVoiceMin * STREAM_BONUS_XP_PER_MINUTE);

          xpEarned = xpBase + xpBonus;
          await addXP(userId, xpEarned);
        }

        // Устанавливаем новую метку без бонуса за стрим
        entry.lastVoiceTimestamp = now;
      }
    }
  }

  await entry.save();
  return xpEarned;
}

/**
 * Выдает ежедневный бонус XP
 */
export async function claimDaily(userId: string): Promise<{ success: boolean; cooldown?: number; xpAwarded?: number }> {
  const entry = await ensureLevelEntry(userId);
  const now = new Date();

  // Проверяем, прошло ли 24 часа с последнего получения бонуса
  if (entry.lastDailyTimestamp) {
    const timeDiff = now.getTime() - entry.lastDailyTimestamp.getTime();
    const hoursPassed = timeDiff / (1000 * 60 * 60);

    if (hoursPassed < 24) {
      const cooldownRemaining = Math.ceil(24 - hoursPassed);
      return { success: false, cooldown: cooldownRemaining };
    }
  }

  // Выдаем бонус
  entry.lastDailyTimestamp = now;
  await entry.save();

  const { newLevel } = await addXP(userId, DAILY_BONUS_XP);
  return { success: true, xpAwarded: DAILY_BONUS_XP };
}

/**
 * Добавляет реферальную связь
 */
export async function addReferral(inviterId: string, invitedId: string): Promise<boolean> {
  console.log(`[LEVELS] Attempting to add referral: inviter=${inviterId}, invited=${invitedId}`);

  // Проверяем, не приглашает ли пользователь сам себя
  if (inviterId === invitedId) {
    console.log(`[LEVELS] Referral failed: User ${inviterId} tried to invite themselves`);
    return false;
  }

  const inviterEntry = await ensureLevelEntry(inviterId);

  // Проверяем, что пользователь еще не приглашен этим приглашающим
  if (inviterEntry.referrals.includes(invitedId)) {
    console.log(`[LEVELS] Referral failed: User ${invitedId} is already in referrals list of ${inviterId}`);
    return false;
  }

  // Проверяем, не истек ли срок сброса месячного лимита
  const now = new Date();
  if (inviterEntry.monthlyReferralReset && inviterEntry.monthlyReferralReset < now) {
    // Если срок сброса истек, обнуляем счетчик и устанавливаем новую дату
    inviterEntry.monthlyReferrals = 0;

    // Устанавливаем новую дату сброса (первое число следующего месяца)
    const newResetDate = new Date();
    newResetDate.setMonth(newResetDate.getMonth() + 1);
    newResetDate.setDate(1);
    newResetDate.setHours(0, 0, 0, 0);
    inviterEntry.monthlyReferralReset = newResetDate;

    console.log(`[LEVELS] Monthly referral count reset for user ${inviterId}, next reset: ${newResetDate}`);
  }

  // Проверяем месячный лимит рефералов
  if (inviterEntry.monthlyReferrals >= MAX_MONTHLY_REFERRALS) {
    console.log(`[LEVELS] Referral failed: Monthly limit reached for ${inviterId} (${inviterEntry.monthlyReferrals}/${MAX_MONTHLY_REFERRALS})`);
    return false;
  }

  // Добавляем пользователя в список приглашенных
  inviterEntry.referrals.push(invitedId);
  inviterEntry.monthlyReferrals++;
  await inviterEntry.save();
  console.log(`[LEVELS] Referral added successfully: ${inviterId} invited ${invitedId}, current monthly count: ${inviterEntry.monthlyReferrals}/${MAX_MONTHLY_REFERRALS}`);

  // Создаем запись для приглашенного пользователя, чтобы установить дату присоединения
  try {
    const invitedEntry = await ensureLevelEntry(invitedId);
    if (!invitedEntry.joinedTimestamp) {
      invitedEntry.joinedTimestamp = new Date();
      await invitedEntry.save();
      console.log(`[LEVELS] Set join timestamp for new user ${invitedId}`);
    }
  } catch (error) {
    console.error(`[LEVELS] Error setting join timestamp for invited user:`, error);
  }

  // XP будет начислено через 7 дней через механизм проверки рефералов
  return true;
}

/**
 * Проверяет рефералов на соответствие условиям и выдает XP
 */
export async function checkReferrals(): Promise<void> {
  try {
    console.log('[LEVELS] Starting referral check process');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - REFERRAL_DAYS_THRESHOLD);

    // Находим всех пользователей, у которых есть рефералы
    const allUsers = await LevelModel.find({ referrals: { $ne: [] } });
    console.log(`[LEVELS] Found ${allUsers.length} users with referrals`);

    let totalProcessed = 0;
    let totalAwarded = 0;

    // Для каждого пользователя с рефералами
    for (const user of allUsers) {
      if (!user.referrals || user.referrals.length === 0) continue;

      console.log(`[LEVELS] Processing user ${user.UID} with ${user.referrals.length} referrals`);
      const processedReferrals: string[] = [];

      // Для каждого реферала пользователя
      for (const referralId of user.referrals) {
        try {
          totalProcessed++;
          // Получаем информацию о реферале
          const referralEntry = await LevelModel.findOne({ UID: referralId });

          // Если реферал существует в базе (значит, он все еще на сервере)
          if (referralEntry) {
            // Проверяем дату создания записи (первой активности на сервере)
            let referralAge: Date | undefined;

            // Проверяем сначала joinedTimestamp если он есть (самый точный способ)
            if (referralEntry.joinedTimestamp) {
              referralAge = new Date(referralEntry.joinedTimestamp);
            }
            // Затем проверяем дату создания по MongoDB ObjectId
            else {
              const mongoObjectId = referralEntry._id?.toString();

              if (mongoObjectId && mongoObjectId.length >= 8) {
                // Извлекаем timestamp из MongoDB ObjectId (первые 4 байта как hex число)
                const timestamp = parseInt(mongoObjectId.substring(0, 8), 16);
                referralAge = new Date(timestamp * 1000); // конвертируем из секунд в миллисекунды
              }
            }

            // Если у нас есть дата, проверяем возраст реферала
            if (referralAge && referralAge < sevenDaysAgo) {
              // Если реферал пробыл на сервере больше 7 дней
              // Выдаем XP приглашающему
              const { oldLevel, newLevel } = await addXP(user.UID, REFERRAL_XP);
              totalAwarded++;

              // Сохраняем реферала в список обработанных
              processedReferrals.push(referralId);

              console.log(`[LEVELS] Awarded ${REFERRAL_XP} XP to ${user.UID} for referral ${referralId} (joined ${referralAge.toISOString()})`);

              // Проверяем, повысился ли уровень пользователя
              if (newLevel > oldLevel) {
                console.log(`[LEVELS] User ${user.UID} leveled up to ${newLevel} from referral rewards!`);

                // Здесь можно добавить логику для оповещения о повышении уровня от рефералов
                // например, отправку сообщения в специальный канал
              }
            } else {
              console.log(`[LEVELS] Referral ${referralId} not yet eligible for reward (needs ${REFERRAL_DAYS_THRESHOLD} days on server)`);
            }
          } else {
            // Реферал не найден в базе данных - вероятно, покинул сервер
            // Удаляем его из списка рефералов
            console.log(`[LEVELS] Referral ${referralId} not found in database, removing from list`);
            processedReferrals.push(referralId);
          }
        } catch (refError) {
          console.error(`[LEVELS] Error processing referral ${referralId} for user ${user.UID}:`, refError);
        }
      }

      // Удаляем обработанных рефералов из списка пользователя
      if (processedReferrals.length > 0) {
        user.referrals = user.referrals.filter(id => !processedReferrals.includes(id));
        await user.save();
        console.log(`[LEVELS] Removed ${processedReferrals.length} processed referrals from user ${user.UID}`);
      }
    }

    console.log(`[LEVELS] Referral check completed. Processed ${totalProcessed} referrals, awarded XP for ${totalAwarded} eligible referrals`);
  } catch (error) {
    console.error('[LEVELS] Error during referral check:', error);
  }
}

/**
 * Обновляет роли пользователя в соответствии с его уровнем
 */
export async function updateUserRoles(member: GuildMember, newLevel: number): Promise<void> {

  let targetRole = null;
  for (let i = LEVEL_ROLES.length - 1; i >= 0; i--) {
    if (newLevel >= LEVEL_ROLES[i].level) {
      targetRole = LEVEL_ROLES[i].roleId;
      break;
    }
  }

  if (!targetRole) return;


  const levelRoleIds = LEVEL_ROLES.map(lr => lr.roleId);
  const rolesToRemove = member.roles.cache.filter(role => levelRoleIds.includes(role.id));


  if (rolesToRemove.size === 1 && rolesToRemove.first()?.id === targetRole) {
    return;
  }


  try {
    if (rolesToRemove.size > 0) {
      await member.roles.remove(rolesToRemove);
    }

    const role = member.guild.roles.cache.get(targetRole);
    if (role) {
      await member.roles.add(role);
    }
  } catch (error) {
    console.error(`Error updating roles for user ${member.id}:`, error);
  }
}


export async function getUserLevel(userId: string): Promise<{
  level: number;
  xp: number;
  nextLevelXP: number;
  progress: number;
  voiceTimeToday?: number;
  dailyMessageCount?: number;
  totalReferrals?: number;
  rank?: number;
}> {
  const entry = await ensureLevelEntry(userId);
  const nextLevelXP = xpForLevel(entry.level);
  const currentLevelXP = entry.level > 1 ? xpForLevel(entry.level - 1) : 0;
  const xpInCurrentLevel = entry.xp - currentLevelXP;
  const xpRequiredForNextLevel = nextLevelXP - currentLevelXP;
  const progress = Math.min(100, Math.floor((xpInCurrentLevel / xpRequiredForNextLevel) * 100));

  // Определяем ранг пользователя (его позиция среди всех по XP)
  let rank;
  try {
    // Находим количество пользователей с большим XP
    const betterUsers = await LevelModel.countDocuments({ xp: { $gt: entry.xp } });
    rank = betterUsers + 1; // Ранг = количество людей с большим XP + 1
  } catch (error) {
    console.error(`[LEVELS] Error getting rank for user ${userId}:`, error);
  }

  // Получаем количество рефералов за все время
  const totalReferrals = entry.referrals ? entry.referrals.length : 0;

  return {
    level: entry.level,
    xp: entry.xp,
    nextLevelXP,
    progress,
    voiceTimeToday: entry.voiceTimeToday,
    dailyMessageCount: entry.dailyMessageCount,
    totalReferrals,
    rank
  };
}

/**
 * Получает топ пользователей по различным критериям
 * @param sortBy Критерий сортировки: 'xp', 'level', 'messages', 'voice', 'balance'
 * @param limit Ограничение количества пользователей
 */
export async function getLevelLeaderboard(
  limit: number = 10,
  sortBy: 'xp' | 'level' | 'messages' | 'voice' | 'balance' = 'xp'
): Promise<Array<{ userId: string; level: number; xp: number }>> {
  let leaders;

  // Сортировка по различным критериям
  switch (sortBy) {
    case 'xp':
      leaders = await LevelModel.find({})
        .sort({ xp: -1 })
        .limit(limit)
        .select('UID level xp');
      break;

    case 'level':
      leaders = await LevelModel.find({})
        .sort({ level: -1, xp: -1 }) // Если уровни равны, смотрим на опыт
        .limit(limit)
        .select('UID level xp');
      break;

    case 'messages':
      // Для сортировки по сообщениям
      leaders = await LevelModel.find({})
        .sort({ dailyMessageCount: -1 })
        .limit(limit)
        .select('UID level xp dailyMessageCount');
      break;

    case 'voice':
      // Для сортировки по времени в голосе
      leaders = await LevelModel.find({})
        .sort({ voiceTimeToday: -1 })
        .limit(limit)
        .select('UID level xp voiceTimeToday');
      break;

    case 'balance':
      // Для сортировки по балансу нам нужно использовать агрегацию с BalanceModel
      try {
        const { BalanceModel } = require('../schema/BalanceSchema');
        // Получаем всех пользователей с балансами
        const balances = await BalanceModel.find({})
          .sort({ balance: -1 })
          .limit(limit)
          .select('UID balance');

        // Затем для каждого получаем данные уровня
        const userIds = balances.map(b => b.UID);
        const levels = await LevelModel.find({ UID: { $in: userIds } })
          .select('UID level xp');

        const levelMap = new Map(levels.map(l => [l.UID, { level: l.level, xp: l.xp }]));

        // Строим результат в порядке балансов
        leaders = balances.map(balance => ({
          UID: balance.UID,
          level: levelMap.get(balance.UID)?.level || 1,
          xp: levelMap.get(balance.UID)?.xp || 0,
          balance: balance.balance
        }));

        if (leaders.length < limit) {
          // Если не хватает пользователей с балансами, дополняем из LevelModel
          const remainingCount = limit - leaders.length;
          const existingIds = new Set(leaders.map(l => l.UID));

          const additionalUsers = await LevelModel.find({ UID: { $nin: Array.from(existingIds) } })
            .sort({ xp: -1 })
            .limit(remainingCount)
            .select('UID level xp');

          leaders = [...leaders, ...additionalUsers];
        }
      } catch (error) {
        console.error("Error sorting by balance:", error);
        // В случае ошибки возвращаем сортировку по опыту
        leaders = await LevelModel.find({})
          .sort({ xp: -1 })
          .limit(limit)
          .select('UID level xp');
      }
      break;

    default:
      // По умолчанию сортируем по XP
      leaders = await LevelModel.find({})
        .sort({ xp: -1 })
        .limit(limit)
        .select('UID level xp');
  }

  return leaders.map(leader => ({
    userId: leader.UID,
    level: leader.level,
    xp: leader.xp
  }));
}

/**
 * Получает топ пользователей по различным критериям с поддержкой пагинации
 * @param limit Ограничение количества пользователей
 * @param sortBy Критерий сортировки: 'xp', 'level', 'messages', 'voice', 'balance'
 * @param skip Количество пользователей для пропуска (для пагинации)
 */
export async function getLevelLeaderboardPaginated(
  limit: number = 10,
  sortBy: 'xp' | 'level' | 'messages' | 'voice' | 'balance' = 'xp',
  skip: number = 0
): Promise<Array<{ userId: string; level: number; xp: number }>> {
  let leaders;

  // Сортировка по различным критериям
  switch (sortBy) {
    case 'xp':
      leaders = await LevelModel.find({})
        .sort({ xp: -1 })
        .skip(skip)
        .limit(limit)
        .select('UID level xp');
      break;

    case 'level':
      leaders = await LevelModel.find({})
        .sort({ level: -1, xp: -1 }) // Если уровни равны, смотрим на опыт
        .skip(skip)
        .limit(limit)
        .select('UID level xp');
      break;

    case 'messages':
      // Для сортировки по сообщениям
      leaders = await LevelModel.find({})
        .sort({ dailyMessageCount: -1 })
        .skip(skip)
        .limit(limit)
        .select('UID level xp dailyMessageCount');
      break;

    case 'voice':
      // Для сортировки по времени в голосе
      leaders = await LevelModel.find({})
        .sort({ voiceTimeToday: -1 })
        .skip(skip)
        .limit(limit)
        .select('UID level xp voiceTimeToday');
      break;

    case 'balance':
      // Для сортировки по балансу нам нужно использовать агрегацию с BalanceModel
      try {
        const { BalanceModel } = require('../schema/BalanceSchema');
        // Получаем всех пользователей с балансами
        const balances = await BalanceModel.find({})
          .sort({ balance: -1 })
          .skip(skip)
          .limit(limit)
          .select('UID balance');

        // Затем для каждого получаем данные уровня
        const userIds = balances.map((b: { UID: string }) => b.UID);
        const levels = await LevelModel.find({ UID: { $in: userIds } })
          .select('UID level xp');

        const levelMap = new Map(levels.map((l: { UID: string, level: number, xp: number }) =>
          [l.UID, { level: l.level, xp: l.xp }]));

        // Строим результат в порядке балансов
        leaders = balances.map((balance: { UID: string, balance: number }) => ({
          UID: balance.UID,
          level: levelMap.get(balance.UID)?.level || 1,
          xp: levelMap.get(balance.UID)?.xp || 0,
          balance: balance.balance
        }));
      } catch (error) {
        console.error("Error sorting by balance:", error);
        // В случае ошибки возвращаем сортировку по опыту
        leaders = await LevelModel.find({})
          .sort({ xp: -1 })
          .skip(skip)
          .limit(limit)
          .select('UID level xp');
      }
      break;

    default:
      // По умолчанию сортируем по XP
      leaders = await LevelModel.find({})
        .sort({ xp: -1 })
        .skip(skip)
        .limit(limit)
        .select('UID level xp');
  }

  return leaders.map(leader => ({
    userId: leader.UID,
    level: leader.level,
    xp: leader.xp
  }));
}
