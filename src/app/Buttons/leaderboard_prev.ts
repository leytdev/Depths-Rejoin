import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { getLevelLeaderboard, getLevelLeaderboardPaginated, getUserLevel } from "../../Utils/LevelSystem";
import { tochka, LEFTLEFT_BUTTON_EMOJI, LEFT_BUTTON_EMOJI, TRASH_BUTTON_EMOJI, RIGHT_BUTTON_EMOJI, RIGHTRIGHT_BUTTON_EMOJI } from "../../Utils/Ids";
import { ErrorHandler } from "../../Utils/ErrorHandler";

export default {
  customId: "leaderboard_prev",
  async run(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    try {
      // Получаем текущую страницу из футера эмбеда
      const embed = interaction.message.embeds[0];
      const footerText = embed.footer?.text || '';
      const pageMatch = footerText.match(/Страница (\d+)/);

      if (!pageMatch) {
        await interaction.followUp({
          content: 'Не удалось определить текущую страницу.',
          ephemeral: true
        });
        return;
      }

      const currentPage = parseInt(pageMatch[1]);

      if (currentPage <= 1) {
        await interaction.followUp({
          content: 'Вы уже на первой странице.',
          ephemeral: true
        });
        return;
      }

      const prevPage = currentPage - 1;

      // Определяем текущий тип фильтра из заголовка эмбеда
      const embedTitle = embed.title || '';
      let filterType: 'xp' | 'level' | 'balance' | 'messages' | 'voice' = 'xp';

      if (embedTitle.includes('по балансу')) {
        filterType = 'balance';
      } else if (embedTitle.includes('по уровню')) {
        filterType = 'level';
      } else if (embedTitle.includes('по сообщениям')) {
        filterType = 'messages';
      } else if (embedTitle.includes('по времени онлайн')) {
        filterType = 'voice';
      }

      // Получаем текст фильтра для отображения
      let filterText = "";
      switch (filterType) {
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
      }

      // Получаем данные для предыдущей страницы
      const itemsPerPage = 10;
      const skip = (prevPage - 1) * itemsPerPage;
      const leaderboard = await getLevelLeaderboardPaginated(itemsPerPage, filterType, skip);

      if (leaderboard.length === 0) {
        await interaction.followUp({
          content: 'На предыдущей странице нет данных.',
          ephemeral: true
        });
        return;
      }

      // Получаем позицию запросившего пользователя
      let userRank = 0;
      const userId = interaction.user.id;

      // Для фильтра по балансу нужно особое получение ранга
      if (filterType === 'balance') {
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
      // Для остальных фильтров получаем ранг через getUserLevel
      else {
        const userData = await getUserLevel(userId);
        if (userData.rank) {
          userRank = userData.rank;
        }
      }

      // Формируем текст с информацией о каждом пользователе
      const startIndex = (prevPage - 1) * itemsPerPage;
      const leaderboardText = await Promise.all(leaderboard.map(async (entry: { userId: string; level: number; xp: number }, index: number) => {
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

          // Формируем строку для пользователя с учетом пропущенных записей
          const position = `**#${startIndex + index + 1} ${user.username}**`;
          const details = `Опыт: **${entry.xp.toLocaleString()}** | Баланс: **${balance.toLocaleString()}** | Уровень: **${entry.level}**
Сообщений: **${userData.dailyMessageCount || 0}** | Онлайн: **${voiceString}**`;

          return `${position}\n${details}\n`;
        } catch (error) {
          // Пытаемся получить хотя бы username
          try {
            const user = await interaction.client.users.fetch(entry.userId);
            return `#${startIndex + index + 1} ${user.username}\nОпыт: **${entry.xp.toLocaleString()}** | Баланс: **$0** | Уровень: **${entry.level}**\nСообщений: **0** | Онлайн: **0 ч. 0 мин.**\n`;
          } catch {
            return `#${startIndex + index + 1} Неизвестный пользователь\nОпыт: **${entry.xp.toLocaleString()}** | Баланс: **$0** | Уровень: **${entry.level}**\nСообщений: **0** | Онлайн: **0 ч. 0 мин.**\n`;
          }
        }
      }));

      const newEmbed = new EmbedBuilder()
        .setTitle(`—・Лидеры ${filterText}`)
        .setDescription(leaderboardText.join('\n'))
        .setColor('#2f3136')
        .setFooter({ text: `Depths • Страница ${prevPage} • Ваш ранг: #${userRank}` })
        .setTimestamp()
        .setThumbnail(interaction.user.displayAvatarURL());

      // Создаем фильтр (селект-меню) с сохранением текущего фильтра
      const filterRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('leaderboard_filter')
            .setPlaceholder('Фильтровать по...')
            .addOptions([
              new StringSelectMenuOptionBuilder()
                .setLabel('По опыту')
                .setValue('xp')
                .setDefault(filterType === 'xp'),
              new StringSelectMenuOptionBuilder()
                .setLabel('По балансу')
                .setValue('balance')
                .setEmoji(tochka)
                .setDefault(filterType === 'balance'),
              new StringSelectMenuOptionBuilder()
                .setLabel('По уровню')
                .setValue('level')
                .setEmoji(tochka)
                .setDefault(filterType === 'level'),
              new StringSelectMenuOptionBuilder()
                .setLabel('По сообщениям')
                .setValue('messages')
                .setEmoji(tochka)
                .setDefault(filterType === 'messages'),
              new StringSelectMenuOptionBuilder()
                .setLabel('По времени онлайн')
                .setValue('voice')
                .setEmoji(tochka)
                .setDefault(filterType === 'voice'),
            ])
        );

      // Создаем кнопки пагинации
      const paginationRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('leaderboard_first')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(prevPage <= 1)
            .setEmoji(LEFTLEFT_BUTTON_EMOJI),
          new ButtonBuilder()
            .setCustomId('leaderboard_prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(prevPage <= 1)
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

      // Обновляем текст вне эмбеда с пингом пользователя
      const contentText = `<@${interaction.user.id}>, Вы на **${userRank}** месте в рейтинге ${filterText}.`;

      // Обновляем сообщение с новой страницей и сохраненным фильтром
      await interaction.message.edit({
        content: contentText,
        embeds: [newEmbed],
        components: [filterRow, paginationRow]
      });
    } catch (error) {
      ErrorHandler.logError(`Leaderboard Prev Button Handler`, error);
      await interaction.followUp({
        content: 'Произошла ошибка при переходе на предыдущую страницу.',
        ephemeral: true
      }).catch(() => { });
    }
  }
};
