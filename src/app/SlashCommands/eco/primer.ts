import {
  CommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  User
} from "discord.js";
import { money } from "../../../Utils/Ids";
import {
  getUserTransactionHistory,
  TRANSACTION_TYPES,
  BANK_ID,
  SYSTEM_ID,
  getTransactionName
} from "../../../Utils/EconomyBase";
import { ITransaction } from "../../../schema/TransactionSchema";

// Constants for transaction display
const ITEMS_PER_PAGE = 5;
const PLUS_EMOJI = '<:plus:1398693864126287954>';
const MINUS_EMOJI = '<:minus:1398693861567758447>';

/**
 * Formats a timestamp into a Russian date format
 */
function formatTimestamp(date: Date): string {
  const day = date.getDate();
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day} ${month} ${year}г., ${hours}:${minutes}`;
}

/**
 * Formats a transaction for display in the embed
 */
function formatTransaction(transaction: ITransaction, userId: string): string {
  const isIncome = transaction.receiverUID === userId;
  const emoji = isIncome ? PLUS_EMOJI : MINUS_EMOJI;
  const currencyEmoji = transaction.currency === "coins" ? money : '💎';
  const formattedTime = formatTimestamp(transaction.timestamp);
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

  return `${emoji} ${transaction.amount} ${currencyEmoji} **[${formattedTime}]** ${description}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName("primer")
    .setDescription("Демонстрация системы просмотра транзакций"),

  async execute(interaction: CommandInteraction) {
    const userId = interaction.user.id;
    const transactions = await getUserTransactionHistory(userId, 15);

    // Create initial page of transactions
    const embed = createTransactionsEmbed(interaction.user, transactions, 0, transactions.length);

    const selectRow = createFilterSelectMenu();
    const buttonRow = createPaginationButtons();

    await interaction.reply({
      embeds: [embed],
      components: [selectRow, buttonRow],
      ephemeral: true
    });
  }
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
        .setPlaceholder('Фильтровать транзакции')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Все транзакции')
            .setDescription('Показать все транзакции')
            .setValue('all'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Только доходы')
            .setDescription('Показать только входящие транзакции')
            .setValue('income'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Только расходы')
            .setDescription('Показать только исходящие транзакции')
            .setValue('expense')
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
        .setStyle(ButtonStyle.Primary)
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