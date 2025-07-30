import { LevelModel } from '../schema/LevelSchema';
import { ClanModel } from '../schema/ClanSchema';

/**
 * Обновляет XP клана на основе суммарного XP всех его участников
 * @param clanId ID клана или объект клана
 */
export async function updateClanXP(clanId: string | any) {
  try {
    // Получаем клан по ID, если передана строка
    const clan = typeof clanId === 'string'
      ? await ClanModel.findOne({ clanId })
      : clanId;

    if (!clan) return null;

    // Получаем список ID участников клана
    const memberIds = clan.members.map((member: any) => member.userId);

    // Получаем записи уровней для всех участников
    const memberLevels = await LevelModel.find({ UID: { $in: memberIds } });

    // Суммируем XP всех участников
    const totalXP = memberLevels.reduce((sum, member) => sum + (member.xp || 0), 0);

    // Обновляем XP клана
    clan.xp = totalXP;
    await clan.save();

    return totalXP;
  } catch (error) {
    console.error('Ошибка при обновлении XP клана:', error);
    return null;
  }
}

/**
 * Обновляет XP клана при изменении XP участника
 * @param userId ID пользователя
 * @param xpChange Изменение XP (положительное или отрицательное)
 */
export async function updateMemberClanXP(userId: string, xpChange: number) {
  try {
    // Находим клан, в котором состоит пользователь
    const clan = await ClanModel.findOne({ "members.userId": userId });
    if (!clan) return null;

    // Обновляем XP клана
    clan.xp += xpChange;
    await clan.save();

    return clan.xp;
  } catch (error) {
    console.error('Ошибка при обновлении XP клана для участника:', error);
    return null;
  }
}
