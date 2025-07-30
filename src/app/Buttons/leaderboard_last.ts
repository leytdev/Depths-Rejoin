import { ButtonInteraction } from "discord.js";

export default {
  data: {
    name: "leaderboard_last"
  },
  async execute(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    try {
      // В реальном коде здесь будет логика получения последней страницы

      // Пока что просто сообщаем, что функционал будет добавлен
      await interaction.followUp({
        content: `Переход на последнюю страницу. Эта функция будет добавлена позже.`,
        ephemeral: true
      });

    } catch (error) {
      console.error(`Error handling leaderboard_last:`, error);
      await interaction.followUp({
        content: 'Произошла ошибка при переходе на последнюю страницу.',
        ephemeral: true
      });
    }
  }
};
