import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export default {
  data: {
    name: "leaderboard_button"
  },
  async execute(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    try {
      // Импортируем напрямую здесь, чтобы избежать проблем с путями
      const { getLevelLeaderboard } = require('../../../Utils/LevelSystem');
      const leaderboard = await getLevelLeaderboard(10); // По умолчанию 10 пользователей

      // Создаем эмбед вручную
      const { EmbedBuilder } = require('discord.js');
      const { getUserLevel } = require('../../../Utils/LevelSystem');

      // Получаем позицию запросившего пользователя
      const userId = interaction.user.id;
      const userIsInLeaderboard = leaderboard.some((entry: { userId: string }) => entry.userId === userId);
      let userRankText = '';

      if (!userIsInLeaderboard) {
        // Находим позицию пользователя в общем рейтинге
        const { rank, level, xp } = await getUserLevel(userId);
        if (rank) {
          userRankText = `\n\n**Ваша позиция:** #${rank} | Уровень ${level} (${xp.toLocaleString()} XP)`;
        }
      }

      const medals = ['🥇', '🥈', '🥉'];
      const leaderboardText = await Promise.all(leaderboard.map(async (entry: { userId: string; level: number; xp: number }, index: number) => {
        // Получаем информацию о пользователе
        try {
          const user = await interaction.client.users.fetch(entry.userId);
          const medal = index < 3 ? `${medals[index]} ` : `**${index + 1}.** `;
          const isUser = entry.userId === userId ? '👤 ' : '';
          return `${medal}${isUser}${user.username} ➜ **Уровень ${entry.level}** (${entry.xp.toLocaleString()} XP)`;
        } catch (error) {
          return `**${index + 1}.** ID: ${entry.userId} ➜ **Уровень ${entry.level}** (${entry.xp.toLocaleString()} XP)`;
        }
      }));

      const embed = new EmbedBuilder()
        .setTitle('🏆 Таблица лидеров по уровням')
        .setDescription(leaderboardText.join('\n') + userRankText)
        .setColor('#2f3136')
        .setFooter({ text: `Depths XP System • Топ 10 пользователей` })
        .setTimestamp();

      // Создаем кнопку "Мой уровень"
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('show_my_level')
            .setLabel('Мой уровень')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊')
        );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    } catch (error) {
      console.error(`[LEVELS] Error handling leaderboard_button:`, error);
    }
  }
};
