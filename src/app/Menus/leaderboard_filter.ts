import { EmbedBuilder, StringSelectMenuInteraction, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { tochka, LEFTLEFT_BUTTON_EMOJI, LEFT_BUTTON_EMOJI, TRASH_BUTTON_EMOJI, RIGHT_BUTTON_EMOJI, RIGHTRIGHT_BUTTON_EMOJI } from "../../Utils/Ids";
import { getLevelLeaderboard, getUserLevel } from "../../Utils/LevelSystem";
import { ErrorHandler } from "../../Utils/ErrorHandler";

export default {
  customId: "leaderboard_filter",
  async run(interaction: StringSelectMenuInteraction) {
    await interaction.deferUpdate();

    try {
      const selectedFilter = interaction.values[0] as 'xp' | 'balance' | 'level' | 'messages' | 'voice';
      const page = 1;
      let filterText = "";

      // Определяем текст фильтра
      switch (selectedFilter) {
        case 'xp':
          filterText = "по опыту";
          break;
        case 'balance':
          filterText = "по балансу";
          break;
        case 'level':
          filterText = "по уровню";
          break;
        case 'messages':
          filterText = "по сообщениям";
          break;
        case 'voice':
          filterText = "по времени онлайн";
          break;
        default:
          filterText = "по опыту";
      }

      // Получаем топ 10 пользователей с новым фильтром
      const leaderboard = await getLevelLeaderboard(10, selectedFilter);

      if (leaderboard.length === 0) {
        await interaction.followUp({
          content: 'В таблице лидеров пока нет данных.',
          ephemeral: true
        });
        return;
      }

      // Получаем позицию запросившего пользователя
      let userRank = 0;
      const userId = interaction.user.id;

      // Для фильтра по балансу нужно особое получение ранга
      if (selectedFilter === 'balance') {
        try {
          const { BalanceModel } = require('../../schema/BalanceSchema');
          // Находим все балансы, большие или равные балансу пользователя
          const userBalance = await BalanceModel.findOne({ UID: userId });
          if (userBalance) {
            const higherBalances = await BalanceModel.countDocuments({
              balance: { $gt: userBalance.balance }
            });
            userRank = higherBalances + 1; // +1 потому что счет начинается с 0
          }
        } catch (error) {
          ErrorHandler.logError("Balance Rank Calculation", error);
        }
      }
      // Для остальных фильтров смотрим, есть ли пользователь в топе
      else {
        for (let i = 0; i < leaderboard.length; i++) {
          if (leaderboard[i].userId === userId) {
            userRank = i + 1;
            break;
          }
        }
      }

      // Если пользователя нет в топе и не баланс, получаем его ранг
      if (userRank === 0 && selectedFilter !== 'balance') {
        const userData = await getUserLevel(userId);
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
            const { BalanceModel } = require('../../schema/BalanceSchema');
            const balanceEntry = await BalanceModel.findOne({ UID: entry.userId });
            balance = balanceEntry ? balanceEntry.balance : 0;
          } catch (balanceError) {
            ErrorHandler.logError("Balance Fetch", balanceError);
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
        .setTitle(`—・Лидеры ${filterText}`)
        .setDescription(leaderboardText.join('\n'))
        .setColor('#2f3136')
        .setFooter({ text: `Depths • Страница ${page} • Ваш ранг: #${userRank}` })
        .setTimestamp()
        .setThumbnail(interaction.user.displayAvatarURL());

      // Создаем фильтр (селект-меню) с установленным выбранным фильтром
      const filterRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('leaderboard_filter')
            .setPlaceholder('Фильтровать по...')
            .addOptions([
              new StringSelectMenuOptionBuilder()
                .setLabel('По опыту')
                .setValue('xp')
                .setDefault(selectedFilter === 'xp'),
              new StringSelectMenuOptionBuilder()
                .setLabel('По балансу')
                .setValue('balance')
                .setEmoji(tochka)
                .setDefault(selectedFilter === 'balance'),
              new StringSelectMenuOptionBuilder()
                .setLabel('По уровню')
                .setValue('level')
                .setEmoji(tochka)
                .setDefault(selectedFilter === 'level'),
              new StringSelectMenuOptionBuilder()
                .setLabel('По сообщениям')
                .setValue('messages')
                .setEmoji(tochka)
                .setDefault(selectedFilter === 'messages'),
              new StringSelectMenuOptionBuilder()
                .setLabel('По времени онлайн')
                .setValue('voice')
                .setEmoji(tochka)
                .setDefault(selectedFilter === 'voice'),
            ])
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
      const contentText = `<@${interaction.user.id}>, Вы на **${userRank}** месте в рейтинге ${filterText}.`;

      // Обновляем сообщение с новым эмбедом и компонентами
      await interaction.message.edit({
        content: contentText,
        embeds: [embed],
        components: [filterRow, paginationRow]
      });

    } catch (error) {
      ErrorHandler.logError(`Leaderboard Filter Handler`, error);
      await interaction.followUp({
        content: 'Произошла ошибка при применении фильтра.',
        ephemeral: true
      }).catch(() => { });
    }
  }
};
