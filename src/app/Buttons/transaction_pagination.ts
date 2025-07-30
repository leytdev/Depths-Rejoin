import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageComponentInteraction
} from "discord.js";
import { getUserTransactionHistory, getTransactionName } from "../../Utils/EconomyBase";
import { money } from "../../Utils/Ids";
import { ITransaction } from "../../schema/TransactionSchema";

// Constants for transaction display
const ITEMS_PER_PAGE = 5;
const PLUS_EMOJI = '<:plus:1398693864126287954>';
const MINUS_EMOJI = '<:minus:1398693861567758447>';

/**
 * Formats a timestamp into Discord timestamp format
 */
function formatTimestamp(date: Date): string {
  // Convert to Unix timestamp (seconds)
  const unixTime = Math.floor(date.getTime() / 1000);

  // Return in Discord timestamp format - <t:timestamp:F> for full date/time format
  return `<t:${unixTime}:F>`;
}

/**
 * Formats a transaction for display in the embed
 */
function formatTransaction(transaction: ITransaction, userId: string): string {
  const isIncome = transaction.receiverUID === userId;
  const emoji = isIncome ? PLUS_EMOJI : MINUS_EMOJI;
  const currencyEmoji = transaction.currency === "coins" ? money : '💎';
  const timestamp = formatTimestamp(transaction.timestamp);

  // Получаем человекочитаемое название транзакции
  let description = getTransactionName(transaction.type);

  // Особые случаи для переводов, где нужно указать направление
  if (transaction.type === 'user_transfer') {
    if (transaction.receiverUID === userId) {
      description = 'Перевод денежных средств от пользователя';
    } else if (transaction.senderUID === userId) {
      description = 'Перевод денежных средств пользователю';
    }
  }

  return `${emoji} ${transaction.amount} ${currencyEmoji} **[${timestamp}]**\n${description}`;
}

/**
 * Updates the page in the transaction history
 */
async function handlePagination(interaction: ButtonInteraction, newPage: number) {
  const userId = interaction.user.id;
  const transactions = await getUserTransactionHistory(userId, 30);

  // Calculate valid page range
  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  newPage = Math.max(0, Math.min(newPage, totalPages - 1));

  // Get transactions for the page
  const startIndex = newPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, transactions.length);
  const pageTransactions = transactions.slice(startIndex, endIndex);

  // Format transactions for display
  const transactionLines = pageTransactions.map(tx => formatTransaction(tx, userId));
  const description = transactionLines.length > 0
    ? transactionLines.join('\n')
    : 'Нет транзакций для отображения';

  // Update the embed
  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setDescription(description)
    .setFooter({ text: `Страница ${newPage + 1}/${totalPages}` });

  // Update the message - используем editReply после deferUpdate
  try {
    await interaction.editReply({
      embeds: [embed],
      components: interaction.message.components
    });
  } catch (error) {
    console.error('Ошибка при обновлении страницы транзакций:', error);
  }
}

export default {
  // Using RegExp to handle all pagination buttons
  customId: /^tx-(first|prev|next|last)-page$/,

  async run(interaction: ButtonInteraction) {
    try {
      // Показываем пользователю, что идёт загрузка
      await interaction.deferUpdate();

      // Get the current page from the footer
      const footer = interaction.message.embeds[0].footer?.text || 'Страница 1/1';
      const match = footer.match(/Страница (\d+)\/(\d+)/);
      if (!match) return; const currentPage = parseInt(match[1], 10) - 1; // Convert to 0-based
      const totalPages = parseInt(match[2], 10);

      // Determine the new page based on the button clicked
      let newPage = currentPage;
      const action = interaction.customId.split('-')[1]; // first, prev, next, or last

      switch (action) {
        case 'first':
          newPage = 0;
          break;
        case 'prev':
          newPage = Math.max(0, currentPage - 1);
          break;
        case 'next':
          newPage = Math.min(totalPages - 1, currentPage + 1);
          break;
        case 'last':
          newPage = totalPages - 1;
          break;
      }

      // Update the page
      await handlePagination(interaction, newPage);
    } catch (error) {
      console.error('Ошибка при обработке кнопки пагинации:', error);
    }
  }
};
