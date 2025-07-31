import mongoose, { Schema, Document } from "mongoose";

export interface ILevel extends Document {
  UID: string;                       // ID пользователя
  xp: number;                        // Текущее количество опыта
  level: number;                     // Текущий уровень
  dailyMessageCount: number;         // Количество сообщений за день (для ограничения XP)
  lastMessageTimestamp?: Date;       // Время последнего сообщения (для анти-спама)
  lastDailyTimestamp?: Date;         // Время последнего получения ежедневного бонуса
  messageFrequency: number;          // Количество сообщений в минуту (для анти-спама)
  lastVoiceTimestamp?: Date;         // Время последнего учета голосовой активности
  voiceTimeToday: number;            // Время проведенное в голосовом канале за день (в секундах)
  referrals: string[];               // Список ID пользователей, приглашенных этим пользователем
  monthlyReferrals: number;          // Количество рефералов за текущий месяц
  monthlyReferralReset?: Date;       // Дата сброса счетчика ежемесячных рефералов
  joinedTimestamp?: Date;            // Дата присоединения к серверу (для проверки рефералов)
}

const LevelSchema: Schema = new Schema({
  UID: { type: String, required: true, unique: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  dailyMessageCount: { type: Number, default: 0 },
  lastMessageTimestamp: { type: Date, default: undefined },
  lastDailyTimestamp: { type: Date, default: undefined },
  messageFrequency: { type: Number, default: 0 },
  lastVoiceTimestamp: { type: Date, default: undefined },
  voiceTimeToday: { type: Number, default: 0 },
  referrals: { type: [String], default: [] },
  monthlyReferrals: { type: Number, default: 0 },
  joinedTimestamp: { type: Date, default: undefined },
  monthlyReferralReset: {
    type: Date, default: () => {
      // Установить дату сброса на первое число следующего месяца
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date;
    }
  }
});

// Добавляем ежедневный сброс счетчиков сообщений и голосового времени
const resetDaily = async () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  try {
    await LevelModel.updateMany(
      {
        $or: [
          { dailyMessageCount: { $gt: 0 } },
          { voiceTimeToday: { $gt: 0 } }
        ]
      },
      {
        $set: {
          dailyMessageCount: 0,
          voiceTimeToday: 0
        }
      }
    );
    console.log('[LEVELS] Daily reset completed');
  } catch (error) {
    console.error('[LEVELS] Error during daily reset:', error);
  }
};

// Добавляем ежемесячный сброс счетчиков рефералов
const resetMonthly = async () => {
  const now = new Date();

  try {
    await LevelModel.updateMany(
      {
        monthlyReferralReset: { $lte: now }
      },
      {
        $set: {
          monthlyReferrals: 0,
          monthlyReferralReset: (() => {
            // Установить дату сброса на первое число следующего месяца
            const date = new Date();
            date.setMonth(date.getMonth() + 1);
            date.setDate(1);
            date.setHours(0, 0, 0, 0);
            return date;
          })()
        }
      }
    );
    console.log('[LEVELS] Monthly referral reset completed');
  } catch (error) {
    console.error('[LEVELS] Error during monthly referral reset:', error);
  }
};

// Запускаем ежедневный сброс счетчиков
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    resetDaily();
  }

  // Проверяем необходимость ежемесячного сброса
  resetMonthly();
}, 60 * 1000); // Проверка каждую минуту

export const LevelModel = mongoose.model<ILevel>("Level", LevelSchema);
