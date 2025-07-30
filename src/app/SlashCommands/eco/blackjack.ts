import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BalanceModel } from '../../../schema/BalanceSchema';
import { ensureBalanceEntry, addBalance, TRANSACTION_TYPES, BANK_ID } from '../../../Utils/EconomyBase';
import { money, tuzecard } from '../../../Utils/Ids';

export default {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Сыграть в блекджек (21) и попытаться выиграть!')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Сумма ставки (минимум 50)')
        .setRequired(true)
        .setMinValue(50)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const userId = interaction.user.id;
      const amount = interaction.options.getInteger('amount', true);
      if (amount < 50) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('—・Блекджек')
              .setDescription(`${interaction.user}, минимальная ставка — **50** ${money}`)
              .setColor('#2f3136')
              .setThumbnail(interaction.user.displayAvatarURL())
          ],
          ephemeral: true
        });
      }
      await ensureBalanceEntry(userId);
      const balanceEntry = await BalanceModel.findOne({ UID: userId });
      const balance = balanceEntry?.balance ?? 0;
      if (amount > balance) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('—・Блекджек')
              .setDescription(`${interaction.user}, у Вас **недостаточно средств** для ставки`)
              .setColor('#2f3136')
              .setThumbnail(interaction.user.displayAvatarURL())
          ],
          ephemeral: true
        });
      }
      // Списываем ставку - деньги идут в банк
      try {
        await addBalance(userId, -amount, TRANSACTION_TYPES.BLACKJACK_LOSE);
        console.log(`Successfully placed bet for user ${userId}: ${amount}`);
      } catch (betError) {
        console.error(`Error placing bet for ${userId}:`, betError);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('—・Блекджек')
              .setDescription(`${interaction.user}, произошла ошибка при размещении ставки. Попробуйте позже.`)
              .setColor('#2f3136')
              .setThumbnail(interaction.user.displayAvatarURL())
          ],
          ephemeral: true
        });
      }
      // --- Механика раздачи карт ---
      // Колода: 2-10, валет, дама, король, туз
      const deck = [
        ...Array(4).fill(2), ...Array(4).fill(3), ...Array(4).fill(4), ...Array(4).fill(5), ...Array(4).fill(6), ...Array(4).fill(7), ...Array(4).fill(8), ...Array(4).fill(9), ...Array(4).fill(10),
        ...Array(4).fill('J'), ...Array(4).fill('Q'), ...Array(4).fill('K'), ...Array(4).fill('A')
      ];
      function draw(deck: any[]) {
        const idx = Math.floor(Math.random() * deck.length);
        return deck.splice(idx, 1)[0];
      }
      // Перемешиваем копию колоды
      const gameDeck = [...deck];
      // Игрок
      const playerCards = [draw(gameDeck), draw(gameDeck)];
      // Дилер
      const dealerCards = [draw(gameDeck), draw(gameDeck)];

      function cardToEmoji(card: any) {
        if (card === 'A') return tuzecard[0];
        if (card === 'K') return '<:Group79326685:1397261205764309103>';
        if (card === 'Q') return '<:Group79326687:1397261093046583336>';
        if (card === 'J') return '<:Group79326688:1397261155805954109>';
        if (card === 10) return '<:Group79326673:1397261201590849577>';
        if (card === 9) return '<:Group79326672:1397261336353706044>';
        if (card === 8) return '<:Group79326674:1397261219743666328>';
        if (card === 7) return '<:Group79326675:1397261217822670949>';
        if (card === 6) return '<:Group79326675:1397261217822670949>';
        if (card === 5) return '<:Group79326677:1397261213917909163>';
        if (card === 4) return '<:Group79326678:1397261211644461096>';
        if (card === 3) return '<:Group79326679:1397261209673400340>';
        if (card === 2) return '<:Group79326670:1397261338073370725>';
        return card;
      }
      function getCardValue(card: any) {
        if (card === 'A') return 11;
        if (card === 'K') return 4;
        if (card === 'Q') return 3;
        if (card === 'J') return 2;
        return card;
      }
      function getHandValue(cards: any[]) {
        let sum = 0;
        let aces = 0;
        for (const c of cards) {
          if (c === 'A') aces++;
          sum += getCardValue(c);
        }
        // Если перебор с тузом, туз становится 1
        while (sum > 21 && aces > 0) {
          sum -= 10;
          aces--;
        }
        return sum;
      }
      const playerValue = getHandValue(playerCards);
      const dealerValue = getHandValue([dealerCards[0]]); // Показываем только одну карту дилера
      // --- Кнопки ---
      const canDouble = [9, 10, 11, 18, 19, 20].includes(playerValue);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`blackjack_hit:${userId}:${JSON.stringify(playerCards)}:${JSON.stringify(dealerCards)}:${amount}:false`)
          .setLabel('Взять')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`blackjack_stand:${userId}:${JSON.stringify(playerCards)}:${JSON.stringify(dealerCards)}:${amount}:false`)
          .setLabel('Пасс')
          .setStyle(ButtonStyle.Secondary),
        ...(canDouble ? [
          new ButtonBuilder()
            .setCustomId(`blackjack_double:${userId}:${JSON.stringify(playerCards)}:${JSON.stringify(dealerCards)}:${amount}:false`)
            .setLabel('Дабл-ставка')
            .setStyle(ButtonStyle.Secondary)
        ] : [])
      );
      // --- Embed ---
      const embed = new EmbedBuilder()
        .setTitle(`—・Блекджек — ${interaction.user.username}`)
        .addFields(
          { name: 'Ваш счёт:', value: `\`\`\`${playerValue}\`\`\``, inline: true },
          { name: 'Счёт дилера:', value: `\`\`\`${dealerValue}\`\`\``, inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: 'Ваши карты:', value: `${playerCards.map(cardToEmoji).join(' ')}`, inline: true },
          { name: 'Карты дилера:', value: `${cardToEmoji(dealerCards[0])} ❓`, inline: true },
          { name: 'Ставка:', value: `**${amount}** ${money}`, inline: false }
        )
        .setColor('#2f3136')
        .setThumbnail(interaction.user.displayAvatarURL());
      return interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error("Ошибка в команде blackjack:", error);
      return interaction.reply({
        content: "Произошла ошибка при выполнении команды. Попробуйте позже.",
        ephemeral: true
      });
    }
  }
};
