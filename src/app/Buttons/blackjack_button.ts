import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { addBalance, TRANSACTION_TYPES, BANK_ID } from '../../Utils/EconomyBase';
import { money, twoocard, tuzecard } from '../../Utils/Ids';
import { BalanceModel } from '../../schema/BalanceSchema';

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
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces--;
  }
  return sum;
}
function draw(deck: any[]) {
  const idx = Math.floor(Math.random() * deck.length);
  return deck.splice(idx, 1)[0];
}

export default {
  customId: /blackjack_(hit|stand|double):.*/,
  async run(interaction: ButtonInteraction) {
    const [action, userId, playerRaw, dealerRaw, amountRaw, doubledRaw] = interaction.customId.split(':');
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: 'Это не ваша игра!', ephemeral: true });
    }
    let playerCards = JSON.parse(playerRaw);
    let dealerCards = JSON.parse(dealerRaw);
    let amount = parseInt(amountRaw);
    let doubled = doubledRaw === 'true';

    const baseDeck = [
      ...Array(4).fill(2), ...Array(4).fill(3), ...Array(4).fill(4), ...Array(4).fill(5), ...Array(4).fill(6), ...Array(4).fill(7), ...Array(4).fill(8), ...Array(4).fill(9), ...Array(4).fill(10),
      ...Array(4).fill('J'), ...Array(4).fill('Q'), ...Array(4).fill('K'), ...Array(4).fill('A')
    ];
    const used = [...playerCards, ...dealerCards];
    const deck = baseDeck.filter((c, i, arr) => {
      const idx = used.indexOf(c);
      if (idx !== -1) {
        used.splice(idx, 1);
        return false;
      }
      return true;
    });

    if (action === 'blackjack_hit') {
      playerCards.push(draw(deck));
      const playerValue = getHandValue(playerCards);
      const canDouble = [9, 10, 11, 18, 19, 20].includes(playerValue) && !doubled;
      if (playerValue > 21) {
        const embed = new EmbedBuilder()
          .setTitle(`—・Блекджек — ${interaction.user.username}`)
          .addFields(
            { name: 'Ваш счёт:', value: `${playerValue}`, inline: true },
            { name: 'Счёт дилера:', value: `${getHandValue([dealerCards[0]])}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: 'Ваши карты:', value: `${playerCards.map(cardToEmoji).join(' ')}`, inline: true },
            { name: 'Карты дилера:', value: `${cardToEmoji(dealerCards[0])} ❓`, inline: true },
            { name: 'Результат:', value: `Вы **перебрали**! Вы проиграли **${amount * (doubled ? 2 : 1)}** ${money}`, inline: false }
          )
          .setColor('#992d22')
          .setThumbnail(interaction.user.displayAvatarURL());
        return interaction.update({ embeds: [embed], components: [] });
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`blackjack_hit:${userId}:${JSON.stringify(playerCards)}:${JSON.stringify(dealerCards)}:${amount}:${doubled}`)
          .setLabel('Взять')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`blackjack_stand:${userId}:${JSON.stringify(playerCards)}:${JSON.stringify(dealerCards)}:${amount}:${doubled}`)
          .setLabel('Пасс')
          .setStyle(ButtonStyle.Secondary),
        ...(canDouble ? [
          new ButtonBuilder()
            .setCustomId(`blackjack_double:${userId}:${JSON.stringify(playerCards)}:${JSON.stringify(dealerCards)}:${amount}:true`)
            .setLabel('Дабл-ставка')
            .setStyle(ButtonStyle.Secondary)
        ] : [])
      );
      const embed = new EmbedBuilder()
        .setTitle(`—・Блекджек — ${interaction.user.username}`)
        .addFields(
          { name: 'Ваш счёт:', value: `${playerValue}`, inline: true },
          { name: 'Счёт дилера:', value: `${getHandValue([dealerCards[0]])}`, inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: 'Ваши карты:', value: `${playerCards.map(cardToEmoji).join(' ')}`, inline: true },
          { name: 'Карты дилера:', value: `${cardToEmoji(dealerCards[0])} ❓`, inline: true },
          { name: 'Ставка:', value: `**${amount * (doubled ? 2 : 1)}** ${money}`, inline: false }
        )
        .setColor('#2f3136')
        .setThumbnail(interaction.user.displayAvatarURL());
      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (action === 'blackjack_double') {
      doubled = true;
      const balanceEntry = await BalanceModel.findOne({ UID: userId });
      if (!balanceEntry || balanceEntry.balance < amount) {
        return interaction.reply({
          content: 'Недостаточно средств для удвоения ставки!',
          ephemeral: true
        });
      }

      // Деньги уже были списаны при начале игры, не нужно списывать снова
      playerCards.push(draw(deck));
      const playerValue = getHandValue(playerCards);
      if (playerValue > 21) {
        const embed = new EmbedBuilder()
          .setTitle(`—・Блекджек — ${interaction.user.username}`)
          .addFields(
            { name: 'Ваш счёт:', value: `${playerValue}`, inline: true },
            { name: 'Счёт дилера:', value: `${getHandValue([dealerCards[0]])}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: 'Ваши карты:', value: `${playerCards.map(cardToEmoji).join(' ')}`, inline: true },
            { name: 'Карты дилера:', value: `${cardToEmoji(dealerCards[0])} ❓`, inline: true },
            { name: 'Результат:', value: `Вы **перебрали**! Вы проиграли **${amount * 2}** ${money}`, inline: false }
          )
          .setColor('#992d22')
          .setThumbnail(interaction.user.displayAvatarURL());
        return interaction.update({ embeds: [embed], components: [] });
      }

      return playDealer(interaction, userId, playerCards, dealerCards, amount, true);
    }

    if (action === 'blackjack_stand') {
      return playDealer(interaction, userId, playerCards, dealerCards, amount, doubled);
    }
  }
};

async function playDealer(interaction: ButtonInteraction, userId: string, playerCards: any[], dealerCards: any[], amount: number, doubled: boolean) {

  const baseDeck = [
    ...Array(4).fill(2), ...Array(4).fill(3), ...Array(4).fill(4), ...Array(4).fill(5), ...Array(4).fill(6), ...Array(4).fill(7), ...Array(4).fill(8), ...Array(4).fill(9), ...Array(4).fill(10),
    ...Array(4).fill('J'), ...Array(4).fill('Q'), ...Array(4).fill('K'), ...Array(4).fill('A')
  ];

  const used = [...playerCards, ...dealerCards];
  const deck = baseDeck.filter((c, i, arr) => {
    const idx = used.indexOf(c);
    if (idx !== -1) {
      used.splice(idx, 1);
      return false;
    }
    return true;
  });

  while (getHandValue(dealerCards) < 17) {
    dealerCards.push(draw(deck));
  }
  const playerValue = getHandValue(playerCards);
  const dealerValue = getHandValue(dealerCards);
  let result = '';
  let color = 0x2f3136;
  let win: boolean = false;
  let isDraw = false;
  let payout = 0;
  if (playerValue > 21) {
    result = `Вы **перебрали**! Вы проиграли **${amount * (doubled ? 2 : 1)}** ${money}`;
    color = 0x992d22;
    win = false;
    payout = 0;
  } else if (dealerValue > 21 || playerValue > dealerValue) {
    result = `Вы **выиграли**! Получаете **${amount * (doubled ? 4 : 2)}** ${money}`;
    color = 0x2ecc71;
    win = true;
    payout = amount * (doubled ? 4 : 2);
  } else if (playerValue === dealerValue) {
    result = `Ничья! Ваша ставка возвращается.`;
    color = 0xf1c40f;
    isDraw = true;
    payout = amount * (doubled ? 2 : 1);
  } else {
    result = `Вы проиграли **${amount * (doubled ? 2 : 1)}** ${money}`;
    color = 0x992d22;
    win = false;
    payout = 0;
  }

  if (win === true) {
    // Выигрыш выплачивается из банка
    await addBalance(userId, payout, TRANSACTION_TYPES.BLACKJACK_WIN, BANK_ID);
  } else if (isDraw) {
    // Возврат ставки из банка
    await addBalance(userId, payout, TRANSACTION_TYPES.BLACKJACK_DRAW, BANK_ID);
  }
  // При проигрыше ничего не происходит, деньги уже в банке

  const embed = new EmbedBuilder()
    .setTitle(`—・Блекджек — ${interaction.user.username}`)
    .addFields(
      { name: 'Ваш счёт:', value: `${playerValue}`, inline: true },
      { name: 'Счёт дилера:', value: `${dealerValue}`, inline: true },
      { name: '\u200B', value: '\u200B', inline: false },
      { name: 'Ваши карты:', value: `${playerCards.map(cardToEmoji).join(' ')}`, inline: true },
      { name: 'Карты дилера:', value: `${dealerCards.map(cardToEmoji).join(' ')}`, inline: true },
      { name: 'Результат:', value: result, inline: false }
    )
    .setColor(color)
    .setThumbnail(interaction.user.displayAvatarURL());
  return interaction.update({ embeds: [embed], components: [] });
}
