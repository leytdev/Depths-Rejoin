import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, StringSelectMenuOptionBuilder, ComponentType } from 'discord.js';
import { BalanceModel } from '../../../schema/BalanceSchema';
import { BankModel } from '../../../schema/BankSchema';
import { ensureBalanceEntry, addBalance, logTransaction, TRANSACTION_TYPES, BANK_ID } from '../../../Utils/EconomyBase';
import { money } from '../../../Utils/Ids';
import { tochka } from '../../../Utils/Ids';

// Константа комиссии (5%)
const COMMISSION_RATE = 0.05;

export default {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Перевести монеты другому пользователю')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Пользователь, которому вы хотите перевести монеты')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Сумма для перевода')
        .setRequired(true)
        .setMinValue(1)
    ),


  async execute(interaction: ChatInputCommandInteraction) {
    const sender = interaction.user;
    const receiver = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);

    // Проверяем, что пользователь не пытается перевести деньги самому себе
    if (sender.id === receiver.id) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('—・Перевод средств')
            .setDescription(`${sender}, вы не можете перевести монеты самому себе!`)
            .setColor('#2f3136')
            .setThumbnail(sender.displayAvatarURL())
        ],
        ephemeral: true
      });
    }

    // Проверяем баланс отправителя
    await ensureBalanceEntry(sender.id);
    const senderBalanceEntry = await BalanceModel.findOne({ UID: sender.id });
    const senderBalance = senderBalanceEntry?.balance ?? 0;

    // Максимальная возможная сумма списания (с учетом комиссии)
    const maxAmountWithCommission = amount + (amount * COMMISSION_RATE);

    // Проверяем достаточно ли средств у отправителя (с учетом возможной комиссии)
    if (senderBalance < maxAmountWithCommission) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('—・Перевод средств')
            .setDescription(`${sender}, у вас недостаточно средств для перевода с учетом возможной комиссии 5%.

Вам нужно иметь не менее **${Math.ceil(maxAmountWithCommission)}** ${money} на балансе.`)
            .setColor('#2f3136')
            .setThumbnail(sender.displayAvatarURL())
        ],
        ephemeral: true
      });
    }

    // Создаем селект-меню для выбора способа списания комиссии
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('pay_commission_choice')
      .setPlaceholder('Выберите способ списания комиссии (5%)')
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel('Списать с суммы перевода')
          .setDescription(`Получатель получит ${Math.floor(amount * (1 - COMMISSION_RATE))} монет`)
          .setValue('from_amount')
          .setEmoji(tochka),
        new StringSelectMenuOptionBuilder()
          .setLabel('Списать дополнительно с меня')
          .setDescription(`С вас спишется дополнительно ${Math.ceil(amount * COMMISSION_RATE)} монет`)
          .setValue('from_sender')
          .setEmoji(tochka)
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    // Отправляем сообщение с выбором способа списания комиссии
    const response = await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('—・Перевод средств')
          .setDescription(`${sender}, Вы собираетесь **перевести**  пользователю ${receiver}.\n
            **Выберите**, откуда будет **списана** коммисия.\n
            ${tochka} **Коммисия:** 5%\n
            ${tochka} **Количество:** ${amount} ${money}`)
          .setColor('#2f3136')
          .setThumbnail(sender.displayAvatarURL())
      ],
      components: [row],
      fetchReply: true
    });

    // Ожидаем ответ пользователя с выбором способа списания комиссии
    try {
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000,
        filter: i => i.user.id === sender.id
      });

      collector.on('collect', async (selectInteraction) => {
        const choice = selectInteraction.values[0];
        await selectInteraction.deferUpdate();

        let amountToReceiver = amount;
        let amountFromSender = amount;
        let commissionAmount = Math.ceil(amount * COMMISSION_RATE);

        if (choice === 'from_amount') {
          // Списываем комиссию с суммы перевода
          amountToReceiver = Math.floor(amount * (1 - COMMISSION_RATE));
          let transferCommission = amount - amountToReceiver;

          // Списываем всю сумму у отправителя и сразу логируем полную транзакцию
          // с учетом комиссии (вместо отдельной транзакции для комиссии)
          await BalanceModel.findOneAndUpdate(
            { UID: sender.id },
            { $inc: { balance: -amount } },
            { new: true, upsert: true }
          );

          // Переводим получателю сумму за вычетом комиссии
          await BalanceModel.findOneAndUpdate(
            { UID: receiver.id },
            { $inc: { balance: amountToReceiver } },
            { new: true, upsert: true }
          );

          // Логируем одну транзакцию с учетом комиссии
          await logTransaction(
            sender.id,
            receiver.id,
            amountToReceiver,
            "coins",
            TRANSACTION_TYPES.USER_TRANSFER
          );

          // Добавляем комиссию в центральный банк
          await BankModel.findOneAndUpdate(
            { bankId: BANK_ID },
            {
              $inc: { balance: transferCommission, totalTransactions: 1 },
              $set: { lastUpdated: new Date() }
            },
            { new: true, upsert: true }
          );

          // Логируем информацию о комиссии отдельно, но только для внутреннего учета банка
          await logTransaction(
            sender.id,
            BANK_ID,
            transferCommission,
            "coins",
            TRANSACTION_TYPES.COMMISSION
          );

          // Показываем результат перевода
          await selectInteraction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('—・Перевод выполнен')
                .setDescription(`${sender}, вы успешно перевели **${amountToReceiver}** ${money} пользователю ${receiver}.
                
Комиссия в размере **${commissionAmount}** ${money} была списана с суммы перевода.`)
                .setColor('#2f3136')
                .setThumbnail(sender.displayAvatarURL())
            ],
            components: []
          });
        } else {
          // Списываем комиссию дополнительно с отправителя
          amountFromSender = amount + commissionAmount;

          // Списываем полную сумму и комиссию у отправителя напрямую
          await BalanceModel.findOneAndUpdate(
            { UID: sender.id },
            { $inc: { balance: -(amount + commissionAmount) } },
            { new: true, upsert: true }
          );

          // Переводим получателю всю указанную сумму напрямую
          await BalanceModel.findOneAndUpdate(
            { UID: receiver.id },
            { $inc: { balance: amount } },
            { new: true, upsert: true }
          );

          // Логируем одну транзакцию между пользователями
          await logTransaction(
            sender.id,
            receiver.id,
            amount,
            "coins",
            TRANSACTION_TYPES.USER_TRANSFER
          );

          // Добавляем комиссию в центральный банк
          await BankModel.findOneAndUpdate(
            { bankId: BANK_ID },
            {
              $inc: { balance: commissionAmount, totalTransactions: 1 },
              $set: { lastUpdated: new Date() }
            },
            { new: true, upsert: true }
          );

          // Логируем информацию о комиссии отдельно, но только для внутреннего учета банка
          await logTransaction(
            sender.id,
            BANK_ID,
            commissionAmount,
            "coins",
            TRANSACTION_TYPES.COMMISSION
          );

          // Показываем результат перевода
          await selectInteraction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('—・Перевод выполнен')
                .setDescription(`${sender}, вы успешно перевели **${amount}** ${money} пользователю ${receiver}.
                
> Комиссия в размере **${commissionAmount}** ${money} была дополнительно **списана** с вашего баланса.`)
                .setColor('#2f3136')
                .setThumbnail(sender.displayAvatarURL())
            ],
            components: []
          });
        }

        collector.stop();
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('—・Перевод отменен')
                .setDescription(`${sender}, время ожидания истекло. Перевод отменен.`)
                .setColor('#2f3136')
                .setThumbnail(sender.displayAvatarURL())
            ],
            components: []
          });
        }
      });
    } catch (error) {
      console.error('Error during payment process:', error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('—・Ошибка')
            .setDescription(`${sender}, произошла ошибка при выполнении перевода. Пожалуйста, попробуйте позже.`)
            .setColor('#2f3136')
            .setThumbnail(sender.displayAvatarURL())
        ],
        components: []
      });
    }
  }
};
