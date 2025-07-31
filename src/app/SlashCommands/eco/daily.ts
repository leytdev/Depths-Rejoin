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

// Constants for optimization
const COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const XP_AMOUNT = 200; // Fixed XP amount for daily reward

export default {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Получить ежедневную награду")
  ,

  async execute(interaction: CommandInteraction) {
    try {
      // Immediately defer reply to prevent timeout errors
      await interaction.deferReply().catch(e => {
        console.error('Failed to defer reply:', e);
        return; // Exit if we can't defer - interaction may be invalid
      });

      const userId = interaction.user.id;
      const now = new Date();
      const cooldown = COOLDOWN;

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

      // Добавляем XP пользователю
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
            .setDescription(`Вы **забрали** свои **${reward}** ${money} монет!
— Возращайтесь ${nextTimeFormatted}`)
            .setColor('#2f3136')
            .setThumbnail(interaction.user.displayAvatarURL())
        ],
        components: [row]
      });
    } catch (error) {
      console.error('Error executing daily command:', error);

      try {
        // Check if interaction is still valid and we can reply
        if (!interaction.isRepliable()) return;

        // Handle the response based on interaction state
        if (!interaction.deferred) {
          try {
            await interaction.deferReply().catch(() => { }); // Catch and ignore any errors if deferring fails
          } catch { }
        }

        if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('—・Ежедневная награда')
                .setDescription('Произошла ошибка при получении награды. Пожалуйста, попробуйте позже.')
                .setColor('#ff0000')
            ]
          }).catch(e => console.error('Failed to edit reply after error:', e));
        }
      } catch (replyError) {
        console.error('Error handling error response:', replyError);
      }
    }
  }
};

// Cache for daily reminders to minimize database hits
const reminderCache = new Map<string, Date>();

// Обработка кнопки и запуск напоминаний
export function listenDailyReminders(client: Client) {
  // Set up button handler
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== "enable_daily_reminder") return;

    try {
      const userId = interaction.user.id;

      // Get the next notification time from cache or database
      let nextNotify: Date;

      if (reminderCache.has(userId)) {
        nextNotify = reminderCache.get(userId)!;
      } else {
        // Find the last daily reward
        const daily = await DailyModel.findOne({ UID: userId });
        nextNotify = daily && daily.LastDaily
          ? new Date(daily.LastDaily.getTime() + COOLDOWN)
          : new Date(Date.now() + COOLDOWN);

        // Update the cache
        reminderCache.set(userId, nextNotify);
      }

      // Update the database
      await ReminderModel.updateOne(
        { userId },
        { $set: { nextNotify } },
        { upsert: true }
      );

      // Update the button UI
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("enable_daily_reminder")
          .setLabel("Включить напоминания о награде")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      // Safe interaction handling
      try {
        await interaction.update({ components: [row] });
        await interaction.followUp({
          content: "Напоминания включены! Вы получите уведомление, когда сможете забрать награду.",
          ephemeral: true
        });
      } catch (error) {
        console.error('Error updating reminder button:', error);
      }
    } catch (error) {
      console.error('Error enabling daily reminder:', error);
      try {
        await interaction.followUp({
          content: "Произошла ошибка при включении напоминаний. Пожалуйста, попробуйте позже.",
          ephemeral: true
        });
      } catch { }
    }
  });

  // Optimized reminder check interval - runs every 2 minutes
  setInterval(async () => {
    try {
      const now = new Date();
      // Get only the reminders that are due
      const reminders = await ReminderModel.find({
        nextNotify: { $lte: now }
      }).limit(25); // Process in batches to avoid overload

      if (reminders.length === 0) return;

      // Process reminders in parallel for better performance
      await Promise.all(reminders.map(async (reminder) => {
        try {
          // Remove from cache if exists
          reminderCache.delete(reminder.userId);

          // Fetch user and send notification
          const user = await client.users.fetch(reminder.userId);
          const embed = new EmbedBuilder()
            .setTitle("—・Напоминание о награде")
            .setDescription(`<@${user.id}>, Вы **можете** получить **ежедневную** награду`)
            .setThumbnail(user.displayAvatarURL())
            .setColor(0x2f3136);

          await user.send({ embeds: [embed] });

          // Delete the reminder after sending
          await ReminderModel.deleteOne({ _id: reminder._id });
        } catch (error) {
          // If we can't DM the user or other error, still delete the reminder to avoid spam
          await ReminderModel.deleteOne({ _id: reminder._id }).catch(() => { });
          console.error(`Error sending reminder to user ${reminder.userId}:`, error);
        }
      }));
    } catch (error) {
      console.error('Error processing daily reminders:', error);
    }
  }, 2 * 60 * 1000); // Check every 2 minutes instead of 5
}


