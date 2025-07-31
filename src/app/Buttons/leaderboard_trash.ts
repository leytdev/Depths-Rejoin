import { ButtonInteraction } from "discord.js";

export default {
  customId: "leaderboard_trash",
  async run(interaction: ButtonInteraction) {
    try {
      // Проверяем, что кнопку нажал тот, кто отправил команду
      if (interaction.message.interaction && interaction.message.interaction.user.id !== interaction.user.id) {
        await interaction.reply({
          content: 'Только автор команды может удалить это сообщение.',
          ephemeral: true
        });
        return;
      }

      // Удаляем сообщение
      await interaction.message.delete();
    } catch (error) {
      console.error(`Error handling leaderboard_trash button:`, error);
      try {
        await interaction.reply({
          content: 'Произошла ошибка при удалении сообщения.',
          ephemeral: true
        }).catch(() => { });
      } catch { }
    }
  }
};
