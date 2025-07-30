import { StringSelectMenuInteraction } from "discord.js";
import { tochka } from "../../Utils/Ids";
export default {
  customId: "leaderboard_filter",
  async run(interaction: StringSelectMenuInteraction) {
    await interaction.deferUpdate();

    try {
      const selectedFilter = interaction.values[0];
      let filterText = "";

      // Определяем текст фильтра
      switch (selectedFilter) {
        case 'xp':
          filterText = "по опыту";
          break;
        case 'balance':
          filterText = "по балансу";
          break;
        case 'level':
          filterText = "по уровню";
          break;
        case 'messages':
          filterText = "по сообщениям";
          break;
        case 'voice':
          filterText = "по времени онлайн";
          break;
        default:
          filterText = "по опыту";
      }

      // Обновляем текст вне эмбеда
      if (interaction.message.content) {
        // Получаем ID пользователя из текущего сообщения
        const userIdMatch = interaction.message.content.match(/<@(\d+)>/);
        if (userIdMatch && userIdMatch[1]) {
          const userId = userIdMatch[1];

          // Обновляем контент сообщения
          await interaction.message.edit({
            content: `<@${userId}>, Вы на **${interaction.message.content.match(/на \*\*(\d+)\*\*/)?.[1] || '??'}** месте в рейтинге ${filterText}.`
          });
        }
      }

      // В реальном коде здесь будет логика фильтрации
      // в зависимости от выбранного фильтра
    } catch (error) {
      console.error(`Error handling leaderboard_filter:`, error);
      await interaction.followUp({
        content: 'Произошла ошибка при применении фильтра.',
        ephemeral: true
      });
    }
  }
};
