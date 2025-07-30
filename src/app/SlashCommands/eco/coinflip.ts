import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BalanceModel } from '../../../schema/BalanceSchema';
import { ensureBalanceEntry, addBalance, TRANSACTION_TYPES, BANK_ID } from '../../../Utils/EconomyBase';
import { money } from '../../../Utils/Ids';

const GIF_HEADS = 'https://media.discordapp.net/attachments/1275788132117250090/1394758233951834242/aea2d4d9b43c4b16.gif?ex=6877f954&is=6876a7d4&hm=c49b71543895140d967fabd93f2bddc4524c3c211219aec3b27550b69c1b2231&=&width=909&height=375';
const GIF_TAILS = 'https://media.discordapp.net/attachments/1275788132117250090/1394758240876626103/bc3ffec8e313882b.gif?ex=6877f955&is=6876a7d5&hm=030cd1fb8ddee7ee055fd3691fc008738469e50e9119087090c924daa21ffeb5&=&width=909&height=375';

function roundTo2(x: number) {
  return Math.round(x * 100) / 100;
}

export default {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Подбросить монетку и попытаться выиграть!')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Сумма ставки')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option.setName('side')
        .setDescription('Выберите сторону')
        .setRequired(true)
        .addChoices(
          { name: 'Орел', value: 'heads' },
          { name: 'Решка', value: 'tails' }
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const amount = interaction.options.getInteger('amount', true);
    const side = interaction.options.getString('side', true);
    // Проверка: сумма должна делиться на 5 и быть целым числом
    if (amount % 5 !== 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('—・Орёл или решка')
            .setDescription(`${interaction.user}, сумма ставки должна быть **целым числом**`)
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
            .setTitle('—・Орёл или решка')
            .setDescription(`${interaction.user}, у Вас **недостаточно средств** для ставки`)
            .setColor('#2f3136')
            .setThumbnail(interaction.user.displayAvatarURL())
        ],
        ephemeral: true
      });
    }
    // Списываем ставку - деньги идут в банк
    await addBalance(userId, -amount, TRANSACTION_TYPES.COINFLIP_LOSE);
    // Выбираем результат
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const gif = result === 'heads' ? GIF_HEADS : GIF_TAILS;
    // Отправляем embed только с гифкой
    const embed = new EmbedBuilder()
      .setImage(gif);
    await interaction.reply({ embeds: [embed] });
    // Ждем 2 секунды
    setTimeout(async () => {
      let resultText = '';
      let win = false;
      let winAmount = 0;
      if (side === result) {
        win = true;
        winAmount = roundTo2(amount * 1.6);
        // Выигрыш выдается из банка
        await addBalance(userId, winAmount, TRANSACTION_TYPES.COINFLIP_WIN, BANK_ID);
        resultText = `— Поздравляем! Вы **выиграли** и получили **${winAmount}** ${money}`;
      } else {
        // При проигрыше деньги уже отправлены в банк
        resultText = `— Увы, вы **проиграли** свою ставку. Попробуйте еще раз!`;
      }
      const resultEmbed = new EmbedBuilder()
        .setTitle('—・Орёл или решка')
        .setDescription(`${interaction.user}, вы поставили **${amount}** ${money} на **${side === 'heads' ? 'Орел' : 'Решка'}**!
${resultText}`)
        .setColor('#2f3136')
        .setThumbnail(interaction.user.displayAvatarURL());
      await interaction.editReply({ embeds: [resultEmbed], content: null });
    }, 2000);
  }
};
