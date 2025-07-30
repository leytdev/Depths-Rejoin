import {
  StringSelectMenuInteraction,
  EmbedBuilder
} from "discord.js";
import { getUserTransactionHistory, BANK_ID, getTransactionName } from "../../Utils/EconomyBase";
import { money } from "../../Utils/Ids";

// Constants for transaction display
const ITEMS_PER_PAGE = 5;
const PLUS_EMOJI = '<:plus:1398693864126287954>';
const MINUS_EMOJI = '<:minus:1398693861567758447>';
const TOCHKA_EMOJI = '<:tochka:1398693865921314990>';

/**
 * Formats a timestamp into Discord timestamp format
 */
function formatTimestamp(date: Date): string {
  // Convert to Unix timestamp (seconds)
  const unixTime = Math.floor(date.getTime() / 1000);

  // Return in Discord timestamp format - <t:timestamp:F> for full date/time
  return `<t:${unixTime}:F>`;
}

/**
 * Formats a transaction for display in the embed
 */
function formatTransaction(transaction: any, userId: string): string {
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

export default {
  customId: "transaction-filter",

  async run(interaction: StringSelectMenuInteraction) {
    try {
      // Показываем пользователю, что идёт загрузка
      await interaction.deferUpdate();

      const userId = interaction.user.id;
      const filterType = interaction.values[0]; // 'all', 'income', or 'expense'    // Загружаем самые свежие транзакции
      const allTransactions = await getUserTransactionHistory(userId, 30);

      // Filter transactions based on selected filter type
      let filteredTransactions;
      switch (filterType) {
        case 'income':
          filteredTransactions = allTransactions.filter(tx => tx.receiverUID === userId);
          break;
        case 'expense':
          filteredTransactions = allTransactions.filter(tx => tx.senderUID === userId && tx.receiverUID !== userId);
          break;
        default: // 'all'
          filteredTransactions = allTransactions;
          break;
      }

      // Format transactions for display
      const transactionLines = filteredTransactions
        .slice(0, ITEMS_PER_PAGE)
        .map(tx => formatTransaction(tx, userId));

      const description = transactionLines.length > 0
        ? transactionLines.join('\n')
        : 'Нет транзакций для отображения';


      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setDescription(description)
        .setFooter({ text: `Страница 1/${Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE) || 1}` });

      // Update the message - используем editReply после deferUpdate
      await interaction.editReply({
        embeds: [embed],
        components: interaction.message.components
      });
    } catch (error) {
      console.error('Ошибка при обработке фильтра транзакций:', error);
    }
  }
};
