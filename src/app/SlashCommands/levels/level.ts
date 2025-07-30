import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUserLevel, xpForLevel } from '../../../Utils/LevelSystem';

export default {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Посмотреть ваш уровень или уровень другого пользователя')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Пользователь, чей уровень вы хотите узнать')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    await interaction.deferReply();

    try {
      // Получаем всю информацию об уровне пользователя
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

      // Создаем кнопку для перехода к таблице лидеров
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('leaderboard_button')
            .setLabel('Таблица лидеров')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊')
        );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    } catch (error) {
      console.error('Error fetching user level:', error);
      await interaction.editReply({
        content: 'Произошла ошибка при получении информации об уровне. Пожалуйста, попробуйте позже.'
      });
    }
  }
};
