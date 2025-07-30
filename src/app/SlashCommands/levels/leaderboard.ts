import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getLevelLeaderboard, getUserLevel } from '../../../Utils/LevelSystem';
import { tochka, LEFTLEFT_BUTTON_EMOJI, LEFT_BUTTON_EMOJI, TRASH_BUTTON_EMOJI, RIGHT_BUTTON_EMOJI, RIGHTRIGHT_BUTTON_EMOJI } from '../../../Utils/Ids';
export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Показать таблицу лидеров'),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Получаем топ 10 пользователей
      const leaderboard = await getLevelLeaderboard(10);
      const page = 1;

      if (leaderboard.length === 0) {
        return interaction.editReply({
          content: 'В таблице лидеров пока нет данных.'
        });
      }

      // Получаем позицию запросившего пользователя
      let userRank = 0;
      for (let i = 0; i < leaderboard.length; i++) {
        if (leaderboard[i].userId === interaction.user.id) {
          userRank = i + 1;
          break;
        }
      }

      // Если пользователя нет в топе, получаем его ранг
      if (userRank === 0) {
        const userData = await getUserLevel(interaction.user.id);
        if (userData.rank) {
          userRank = userData.rank;
        }
      }

      // Формируем текст с информацией о каждом пользователе
      const leaderboardText = await Promise.all(leaderboard.map(async (entry, index) => {
        try {
          // Получаем информацию о пользователе
          const user = await interaction.client.users.fetch(entry.userId);

          // Получаем дополнительную информацию (баланс и статистика)
          const userData = await getUserLevel(entry.userId);

          // Форматируем время в голосе (преобразуем из секунд в часы и минуты)
          const voiceTimeSeconds = userData.voiceTimeToday || 0;
          const voiceHours = Math.floor(voiceTimeSeconds / 3600);
          const voiceMinutes = Math.floor((voiceTimeSeconds % 3600) / 60);
          const voiceString = `${voiceHours} ч. ${voiceMinutes} мин.`;

          // Получаем баланс пользователя
          let balance = 0;
          try {
            const { BalanceModel } = require('../../../schema/BalanceSchema');
            const balanceEntry = await BalanceModel.findOne({ UID: entry.userId });
            balance = balanceEntry ? balanceEntry.balance : 0;
          } catch (balanceError) {
            console.error(`Ошибка при получении баланса для ${entry.userId}:`, balanceError);
          }

          // Формируем строку для пользователя
          const position = `**#${index + 1} ${user.username}**`;
          const details = `Опыт: **${entry.xp.toLocaleString()}** | Баланс: **${balance.toLocaleString()}** | Уровень: **${entry.level}**
Сообщений: **${userData.dailyMessageCount || 0}** | Онлайн: **${voiceString}**`;

          return `${position}\n${details}\n`;
        } catch (error) {
          // Пытаемся получить хотя бы username
          try {
            const user = await interaction.client.users.fetch(entry.userId);
            return `#${index + 1} ${user.username}\nОпыт: **${entry.xp.toLocaleString()}** | Баланс: **$0** | Уровень: **${entry.level}**\nСообщений: **0** | Онлайн: **0 ч. 0 мин.**\n`;
          } catch {
            return `#${index + 1} Неизвестный пользователь\nОпыт: **${entry.xp.toLocaleString()}** | Баланс: **$0** | Уровень: **${entry.level}**\nСообщений: **0** | Онлайн: **0 ч. 0 мин.**\n`;
          }
        }
      }));

      const embed = new EmbedBuilder()
        .setTitle('—・Лидеры')
        .setDescription(leaderboardText.join('\n'))
        .setColor('#2f3136')
        .setFooter({ text: `Depths • Страница ${page} • Ваш ранг: #${userRank}` })
        .setTimestamp();

      // Создаем фильтр (селект-меню)
      const filterRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('leaderboard_filter')
            .setPlaceholder('Фильтровать по...')
            .addOptions([
              new StringSelectMenuOptionBuilder()
                .setLabel('По опыту')
                .setValue('xp')
                .setDefault(true),
              new StringSelectMenuOptionBuilder()
                .setLabel('По балансу')
                .setValue('balance')
                .setEmoji(tochka),
              new StringSelectMenuOptionBuilder()
                .setLabel('По уровню')
                .setValue('level')
                .setEmoji(tochka),
              new StringSelectMenuOptionBuilder()
                .setLabel('По сообщениям')
                .setValue('messages')
                .setEmoji(tochka),
              new StringSelectMenuOptionBuilder()
                .setLabel('По времени онлайн')
                .setValue('voice')
                .setEmoji(tochka),
            ])
        );

      // Создаем кнопки перехода
      const navigationRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('leaderboard_my_page')
            .setLabel('Перейти к себе на странице')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('leaderboard_goto_page')
            .setLabel('Перейти на страницу')
            .setStyle(ButtonStyle.Secondary)
        );

      // Создаем кнопки пагинации
      const paginationRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('leaderboard_first')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 1)
            .setEmoji(LEFTLEFT_BUTTON_EMOJI),
          new ButtonBuilder()
            .setCustomId('leaderboard_prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 1)
            .setEmoji(LEFT_BUTTON_EMOJI),
          new ButtonBuilder()
            .setCustomId('leaderboard_trash')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(TRASH_BUTTON_EMOJI),
          new ButtonBuilder()
            .setCustomId('leaderboard_next')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(RIGHT_BUTTON_EMOJI),
          new ButtonBuilder()
            .setCustomId('leaderboard_last')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(RIGHTRIGHT_BUTTON_EMOJI)
        );

      // Формируем сообщение вне эмбеда с пингом пользователя
      const contentText = `<@${interaction.user.id}>, Вы на **${userRank}** месте в рейтинге по опыту.`;

      await interaction.editReply({
        content: contentText,
        embeds: [embed],
        components: [filterRow, navigationRow, paginationRow]
      });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      await interaction.editReply({
        content: 'Произошла ошибка при получении таблицы лидеров. Пожалуйста, попробуйте позже.'
      });
    }
  }
};
