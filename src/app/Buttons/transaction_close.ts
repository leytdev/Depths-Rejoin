import { ButtonInteraction } from "discord.js";

export default {
  customId: "tx-close",

  async run(interaction: ButtonInteraction) {
    try {
      // Подтверждаем получение интеракции
      await interaction.deferUpdate();
      // Удаляем сообщение
      await interaction.message.delete();
    } catch (error) {
      console.error('Ошибка при закрытии сообщения с транзакциями:', error);
    }
  }
};
