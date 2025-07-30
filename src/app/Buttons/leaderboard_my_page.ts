import { ButtonInteraction } from "discord.js";

export default {
  data: {
    name: "leaderboard_my_page"
  },
  async execute(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    try {
      // Получаем позицию пользователя
      const { getUserLevel } = require('../../../Utils/LevelSystem');
      const userData = await getUserLevel(interaction.user.id);

      // Вычисляем номер страницы
      const page = Math.ceil(userData.rank / 10);

      // Вызываем команду leaderboard с указанной страницей
      // В реальном коде здесь будет обработчик, который покажет страницу с пользователем

      // Пока что просто сообщаем, что функционал будет добавлен
      await interaction.followUp({
        content: `Эта функция будет добавлена позже. Ваша позиция: #${userData.rank}, страница: ${page}`,
        ephemeral: true
      });
    } catch (error) {
      console.error(`Error handling leaderboard_my_page:`, error);
      await interaction.followUp({
        content: 'Произошла ошибка при поиске вашей позиции.',
        ephemeral: true
      });
    }
  }
};
