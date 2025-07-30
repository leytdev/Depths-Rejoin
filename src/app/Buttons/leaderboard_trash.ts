import { ButtonInteraction } from "discord.js";

export default {
  data: {
    name: "leaderboard_trash"
  },
  async execute(interaction: ButtonInteraction) {
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
  }
};
