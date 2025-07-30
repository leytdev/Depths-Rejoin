import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

export default {
  data: {
    name: "leaderboard_goto_page"
  },
  async execute(interaction: ButtonInteraction) {
    // Создаем модальное окно для ввода номера страницы
    const modal = new ModalBuilder()
      .setCustomId('leaderboard_goto_page_modal')
      .setTitle('Перейти на страницу');

    // Создаем поле для ввода номера страницы
    const pageNumberInput = new TextInputBuilder()
      .setCustomId('pageNumber')
      .setLabel('Введите номер страницы')
      .setPlaceholder('Например: 2')
      .setMinLength(1)
      .setMaxLength(3)
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    // Создаем строку с полем
    const actionRow = new ActionRowBuilder<TextInputBuilder>()
      .addComponents(pageNumberInput);

    // Добавляем строку в модальное окно
    modal.addComponents(actionRow);

    // Отправляем модальное окно
    await interaction.showModal(modal);
  }
};
