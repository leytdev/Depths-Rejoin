import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { DailyModel } from "../../schema/DailySchema";
import mongoose from "mongoose";

// Модель для хранения напоминаний
const ReminderSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  nextNotify: { type: Date, required: true }
}, { collection: 'economy.daily_reminders' });

const ReminderModel = mongoose.models.DailyReminder || mongoose.model('DailyReminder', ReminderSchema);

export default {
  customId: "enable_daily_reminder",
  async run(interaction: ButtonInteraction) {
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
}; 