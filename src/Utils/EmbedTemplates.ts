import { EmbedBuilder, User, ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import { getUserLevel } from './LevelSystem';

/**
 * Создает эмбед для таблицы лидеров
 * @param leaderboard - массив данных таблицы лидеров
 * @param interaction - объект взаимодействия (команда или кнопка)
 * @param page - номер страницы (начинается с 1)
 * @param pageSize - количество пользователей на странице
 */
export async function leaderboardEmbed(
  leaderboard: Array<{ userId: string; level: number; xp: number }>,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  page = 1,
  pageSize = 10
) {
  const startIndex = (page - 1) * pageSize;
  const pageItems = leaderboard.slice(startIndex, startIndex + pageSize);
  const userId = interaction.user.id;

  // Получаем позицию запросившего пользователя, если его нет в текущей выборке
  const userIsInLeaderboard = pageItems.some(entry => entry.userId === userId);
  let userRankText = '';

  if (!userIsInLeaderboard) {
    // Находим позицию пользователя в общем рейтинге
    const { rank, level, xp } = await getUserLevel(userId);
    if (rank) {
      userRankText = `\n\n**Ваша позиция:** #${rank} | Уровень ${level} (${xp.toLocaleString()} XP)`;
    }
  }

  const medals = ['🥇', '🥈', '🥉'];
  const leaderboardText = await Promise.all(pageItems.map(async (entry, index) => {
    const actualIndex = startIndex + index; // Реальная позиция в общем списке

    // Получаем информацию о пользователе
    try {
      const user = await interaction.client.users.fetch(entry.userId);
      const medal = actualIndex < 3 ? `${medals[actualIndex]} ` : `**${actualIndex + 1}.** `;
      const isUser = entry.userId === userId ? '👤 ' : '';
      return `${medal}${isUser}${user.username} ➜ **Уровень ${entry.level}** (${entry.xp.toLocaleString()} XP)`;
    } catch (error) {
      return `**${actualIndex + 1}.** ID: ${entry.userId} ➜ **Уровень ${entry.level}** (${entry.xp.toLocaleString()} XP)`;
    }
  }));

  return new EmbedBuilder()
    .setTitle('🏆 Таблица лидеров по уровням')
    .setDescription(leaderboardText.join('\n') + userRankText)
    .setColor('#2f3136')
    .setFooter({ text: `Depths XP System • Страница ${page}` })
    .setTimestamp();
}

/**
 * Создает эмбед для отображения уровня пользователя
 */
export async function userLevelEmbed(targetUser: User) {
  const { level, xp, nextLevelXP, progress, voiceTimeToday, dailyMessageCount, totalReferrals, rank } =
    await getUserLevel(targetUser.id);

  // Вычисляем XP текущего уровня и необходимый XP для следующего уровня
  const currentLevelXP = level > 1 ? xpForLevel(level - 1) : 0;
  const xpInCurrentLevel = xp - currentLevelXP;
  const xpRequiredForNextLevel = nextLevelXP - currentLevelXP;

  // Создаем индикатор прогресса
  const progressBarLength = 15;
  const filledBlocks = Math.floor((progress / 100) * progressBarLength);
  const emptyBlocks = progressBarLength - filledBlocks;
  const progressBar = '■'.repeat(filledBlocks) + '□'.repeat(emptyBlocks);

  // Формируем строку статистики
  let statsText = '';
  if (rank) statsText += `🏆 **Ранг:** #${rank}\n`;
  if (dailyMessageCount !== undefined) statsText += `💬 **Сообщений сегодня:** ${dailyMessageCount}\n`;
  if (voiceTimeToday !== undefined) statsText += `🎤 **Время в голосовых каналах:** ${voiceTimeToday} мин.\n`;
  if (totalReferrals !== undefined) statsText += `👥 **Приглашено:** ${totalReferrals} пользователей\n`;

  return new EmbedBuilder()
    .setAuthor({
      name: `${targetUser.username} — Уровень ${level}`,
      iconURL: targetUser.displayAvatarURL()
    })
    .setColor('#2f3136')
    .setDescription(`**XP:** ${xp.toLocaleString()} XP\n**До следующего уровня:** ${(nextLevelXP - xp).toLocaleString()} XP
    
**Прогресс до ${level + 1} уровня:**
${xpInCurrentLevel.toLocaleString()} / ${xpRequiredForNextLevel.toLocaleString()} XP
${progressBar} ${progress}%

${statsText}`)
    .setFooter({ text: 'Depths XP System' })
    .setTimestamp();
}

// Функция для подсчета XP для уровня из LevelSystem.ts
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}
