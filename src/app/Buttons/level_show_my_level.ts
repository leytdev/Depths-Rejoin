import { ButtonInteraction, EmbedBuilder } from "discord.js";

export default {
  data: {
    name: "show_my_level"
  },
  async execute(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    try {
      // Импортируем напрямую здесь, чтобы избежать проблем с путями
      const { getUserLevel } = require('../../../Utils/LevelSystem');

      const targetUser = interaction.user;

      // Получаем всю информацию об уровне пользователя
      const { level, xp, nextLevelXP, progress, voiceTimeToday, dailyMessageCount, totalReferrals, rank } =
        await getUserLevel(targetUser.id);

      // Вычисляем XP текущего уровня и необходимый XP для следующего уровня
      const xpForLevel = (level: number): number => Math.floor(100 * Math.pow(level, 1.5));
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

      const embed = new EmbedBuilder()
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

      await interaction.editReply({
        embeds: [embed],
        components: []
      });
    } catch (error) {
      console.error(`[LEVELS] Error handling show_my_level button:`, error);
    }
  }
};
