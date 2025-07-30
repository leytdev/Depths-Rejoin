import { ButtonInteraction } from "discord.js";

export default {
  data: {
    name: "leaderboard_prev"
  },
  async execute(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    try {
      // Получаем текущую страницу из футера эмбеда
      const embed = interaction.message.embeds[0];
      const footerText = embed.footer?.text || '';
      const pageMatch = footerText.match(/Страница (\d+)/);

      if (!pageMatch) {
        await interaction.followUp({
          content: 'Не удалось определить текущую страницу.',
          ephemeral: true
        });
        return;
      }

      const currentPage = parseInt(pageMatch[1]);
      if (currentPage <= 1) {
        await interaction.followUp({
          content: 'Вы уже на первой странице.',
          ephemeral: true
        });
        return;
      }

      const prevPage = currentPage - 1;

      // Пока что просто сообщаем, что функционал будет добавлен
      await interaction.followUp({
        content: `Переход на страницу ${prevPage}. Эта функция будет добавлена позже.`,
        ephemeral: true
      });

      // В реальном коде здесь будет логика перехода на предыдущую страницу
    } catch (error) {
      console.error(`Error handling leaderboard_prev:`, error);
      await interaction.followUp({
        content: 'Произошла ошибка при переходе на предыдущую страницу.',
        ephemeral: true
      });
    }
  }
};
