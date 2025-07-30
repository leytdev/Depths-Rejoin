import { CommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, User, GuildMember } from "discord.js";
import { DailyModel } from "../../../schema/DailySchema";
import mongoose from "mongoose";
import { money } from "../../../Utils/Ids";
import { ensureBalanceEntry, transferFromBank, TRANSACTION_TYPES, BANK_ID, getBankStatus } from "../../../Utils/EconomyBase";
import { addXP, updateUserRoles } from "../../../Utils/LevelSystem";

// Модель для хранения напоминаний
const ReminderSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  nextNotify: { type: Date, required: true }
}, { collection: 'economy.daily_reminders' });

const ReminderModel = mongoose.models.DailyReminder || mongoose.model('DailyReminder', ReminderSchema);

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `**${hours}** ч. **${minutes}** мин. **${seconds}** сек.`;
}

export default {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Получить ежедневную награду"),
  async execute(interaction: CommandInteraction) {
    try {
      // Сразу отправляем сигнал Discord, что мы обрабатываем взаимодействие
      await interaction.deferReply();

      const userId = interaction.user.id;
      const now = new Date();
      const cooldown = 24 * 60 * 60 * 1000;

      // Убедиться, что у пользователя есть запись в балансе
      await ensureBalanceEntry(userId);

      let daily = await DailyModel.findOne({ UID: userId });
      if (daily && daily.LastDaily) {
        const diff = now.getTime() - daily.LastDaily.getTime();
        if (diff < cooldown) {
          const next = new Date(daily.LastDaily.getTime() + cooldown);
          const nextTimeFormatted = `<t:${Math.floor(next.getTime() / 1000)}:R>`;
          const timeFormatted = formatTime(next.getTime() - now.getTime());
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('—・Ежедневная награда')
                .setDescription(`${interaction.user}, Вы **уже** забрали **временную** награду!\nВы можете **получить** следующую через ${timeFormatted}\n${nextTimeFormatted}`)
                .setColor('#2f3136')
                .setThumbnail(interaction.user.displayAvatarURL())
            ]
          });
        }
      }

      const reward = Math.floor(Math.random() * 20 + 1) * 5; // 1*5=5, 20*5=100
      const nextTimeFormatted = `<t:${Math.floor((now.getTime() + cooldown) / 1000)}:R>`;
      if (!daily) {
        daily = await DailyModel.create({
          UID: userId,
          Date: now,
          Money: reward,
          LastDaily: now
        });
      } else {
        daily.Money += reward;
        daily.LastDaily = now;
        await daily.save();
      }

      // Получаем состояние банка
      const bankStatus = await getBankStatus();

      // Проверяем, достаточно ли средств в банке
      if (!bankStatus || bankStatus.balance < reward) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('—・Ежедневная награда')
              .setDescription(`${interaction.user}, к сожалению, в банке недостаточно средств для выдачи награды!`)
              .setColor('#2f3136')
              .setThumbnail(interaction.user.displayAvatarURL())
          ]
        });
      }

      // Переводим награду из банка пользователю
      await transferFromBank(userId, reward, "coins", TRANSACTION_TYPES.DAILY);

      // Добавляем 200 XP пользователю
      const XP_AMOUNT = 200;
      const { oldLevel, newLevel } = await addXP(userId, XP_AMOUNT);

      // Если пользователь повысил уровень и находится в гильдии, обновляем его роли
      if (newLevel > oldLevel && interaction.member instanceof GuildMember) {
        await updateUserRoles(interaction.member, newLevel);
      }

      // Обновляем nextNotify при получении награды, чтобы кнопка была активна
      await ReminderModel.updateOne(
        { userId },
        { $set: { nextNotify: new Date(now.getTime() + cooldown) } },
        { upsert: true }
      );

      // Проверяем, включены ли напоминания (должно быть false, так как мы только что обновили)
      const reminder = await ReminderModel.findOne({ userId });
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("enable_daily_reminder")
          .setLabel("Включить напоминания о награде")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(false) // Всегда активна при получении награды
      );

      // Добавляем сообщение о повышении уровня, если это произошло
      let levelUpMessage = '';
      if (newLevel > oldLevel) {
        levelUpMessage = `\n\n**Поздравляем!** Вы достигли **${newLevel}** уровня! 🎉`;
      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('—・Ежедневная награда')
            .setDescription(`Вы **забрали** свои **${reward}** ${money} монет и получили **+${XP_AMOUNT} XP**!
— Возращайтесь ${nextTimeFormatted}${levelUpMessage}`)
            .setColor('#2f3136')
            .setThumbnail(interaction.user.displayAvatarURL())
        ],
        components: [row]
      });
    } catch (error) {
      console.error('Error executing daily command:', error);
      // Проверяем, что взаимодействие все еще валидно и можем ответить
      if (interaction.isRepliable()) {
        try {
          if (!interaction.deferred) {
            await interaction.deferReply();
          }
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('—・Ежедневная награда')
                .setDescription('Произошла ошибка при получении награды. Пожалуйста, попробуйте позже.')
                .setColor('#ff0000')
            ]
          });
        } catch (replyError) {
          console.error('Error sending error response:', replyError);
        }
      }
    }
  }
};

// Обработка кнопки и запуск напоминаний
export function listenDailyReminders(client: Client) {
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton() && interaction.customId === "enable_daily_reminder") {
      const userId = interaction.user.id;
      // Найти последний daily
      const daily = await DailyModel.findOne({ UID: userId });
      let nextNotify = new Date();
      if (daily && daily.LastDaily) {
        nextNotify = new Date(daily.LastDaily.getTime() + 24 * 60 * 60 * 1000);
      } else {
        nextNotify = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      await ReminderModel.updateOne(
        { userId },
        { $set: { nextNotify } },
        { upsert: true }
      );
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("enable_daily_reminder")
          .setLabel("Включить напоминания о награде")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      await interaction.update({ components: [row] });
      await interaction.followUp({ content: "Напоминания включены!", ephemeral: true });
    }
  });

  // Таймер для отправки напоминаний
  setInterval(async () => {
    const now = new Date();
    const reminders = await ReminderModel.find({ nextNotify: { $lte: now } });
    for (const reminder of reminders) {
      try {
        const user = await client.users.fetch(reminder.userId);
        const embed = new EmbedBuilder()
          .setTitle("—・Напоминание о награде")
          .setDescription(`<@${user.id}>, Вы **можете** получить **ежедневную** награду`)
          .setThumbnail(user.displayAvatarURL())
          .setColor(0x2f3136);
        await user.send({ embeds: [embed] });
      } catch { }
      await ReminderModel.deleteOne({ _id: reminder._id });
    }
  }, 5 * 60 * 1000);
}


