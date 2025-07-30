import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  User
} from "discord.js";
import { money } from "../../Utils/Ids";
import { getUserTransactionHistory, TRANSACTION_TYPES, BANK_ID, SYSTEM_ID, getTransactionName } from "../../Utils/EconomyBase";
import { ITransaction } from "../../schema/TransactionSchema";

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

  // Return in Discord timestamp format - <t:timestamp:R> for relative time
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
  let description = '';

  // Получаем человекочитаемое название транзакции
  description = getTransactionName(transaction.type);

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
 * Creates the transaction history embed
 */
function createTransactionsEmbed(
  user: User,
  transactions: ITransaction[],
  page: number = 0,
  totalTransactions: number
): EmbedBuilder {
  const startIndex = page * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, transactions.length);
  const pageTransactions = transactions.slice(startIndex, endIndex);
  const totalPages = Math.ceil(totalTransactions / ITEMS_PER_PAGE);

  // Format each transaction for display
  const transactionLines = pageTransactions.map(tx => formatTransaction(tx, user.id));
  const description = transactionLines.length > 0
    ? transactionLines.join('\n')
    : 'Нет транзакций для отображения';

  return new EmbedBuilder()
    .setTitle(`—・Транзакции — ${user.username}`)
    .setDescription(description)
    .setColor('#2f3136')
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: `Страница ${page + 1}/${totalPages || 1}` })
    .setTimestamp();
}

/**
 * Creates the filter select menu
 */
function createFilterSelectMenu() {
  return new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('transaction-filter')
        .setPlaceholder('Фильтр')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`Все транзакции`)
            .setValue('all')
            .setEmoji(`${TOCHKA_EMOJI}`),
          new StringSelectMenuOptionBuilder()
            .setLabel(`Доходы`)
            .setValue('income')
            .setEmoji(`${TOCHKA_EMOJI}`),
          new StringSelectMenuOptionBuilder()
            .setLabel(`Расходы`)
            .setValue('expense')
            .setEmoji(`${TOCHKA_EMOJI}`),
        )
    );
}

/**
 * Creates the pagination button row
 */
function createPaginationButtons() {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('tx-first-page')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('<:leftleft:1398693870883311668>'),

      new ButtonBuilder()
        .setCustomId('tx-prev-page')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('<:left:1398693859910877365>'),

      new ButtonBuilder()
        .setCustomId('tx-close')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('<:trash:1398693867376742521>'),

      new ButtonBuilder()
        .setCustomId('tx-next-page')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('<:right:1398693857645957140>'),

      new ButtonBuilder()
        .setCustomId('tx-last-page')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('<:rightright:1398693877501923398>')
    );
}

export default {
  // The custom ID for the button
  customId: "view-transactions",

  // Execute when button is pressed
  async run(interaction: ButtonInteraction) {
    const userId = interaction.user.id;

    try {
      // Показываем пользователю, что идёт загрузка
      await interaction.deferUpdate();

      // Загружаем самые свежие транзакции
      const transactions = await getUserTransactionHistory(userId, 20);

      // Create initial page of transactions
      const embed = createTransactionsEmbed(interaction.user, transactions, 0, transactions.length);

      const selectRow = createFilterSelectMenu();
      const buttonRow = createPaginationButtons();

      // После deferUpdate используем editReply вместо update
      await interaction.editReply({
        embeds: [embed],
        components: [selectRow, buttonRow]
      });
    } catch (error) {
      console.error('Ошибка при обновлении транзакций:', error);
    }
  }
};
