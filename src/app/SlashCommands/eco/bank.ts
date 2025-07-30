import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { getBankStatus } from "../../../Utils/EconomyBase";
import { ownerUID } from "../../../config";
import { money } from "../../../Utils/Ids";

export default {
  data: new SlashCommandBuilder()
    .setName("bank")
    .setDescription("Просмотреть состояние банка сервера")
    .addSubcommand(subcommand =>
      subcommand
        .setName("status")
        .setDescription("Показать текущий баланс и статистику банка")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    // Проверяем, является ли исполнитель владельцем (опционально)
    // Если хотите, чтобы только владелец мог смотреть состояние банка, раскомментируйте эти строки
    /*
    if (interaction.user.id !== ownerUID) {
      return interaction.reply({
        content: "У вас нет прав для использования этой команды.",
        ephemeral: true
      });
    }
    */

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "status") {
      try {
        const bankStatus = await getBankStatus();

        if (!bankStatus) {
          return interaction.reply({
            content: "Не удалось получить информацию о банке.",
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(`—・Банк сервера`)
          .setDescription(`Статистика центрального банка сервера`)
          .addFields(
            { name: 'Монеты:', value: `\`\`\`${bankStatus.balance.toLocaleString()}\`\`\``, inline: true },
            { name: 'Шарды:', value: `\`\`\`${bankStatus.shards.toLocaleString()}\`\`\``, inline: true },
            { name: 'Всего транзакций:', value: `\`\`\`${bankStatus.totalTransactions.toLocaleString()}\`\`\``, inline: false },
            { name: 'Последнее обновление:', value: `<t:${Math.floor(bankStatus.lastUpdated.getTime() / 1000)}:R>`, inline: false }
          )
          .setColor(0x2f3136)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error("Ошибка при получении данных банка:", error);
        return interaction.reply({
          content: "Произошла ошибка при получении данных банка.",
          ephemeral: true
        });
      }
    }
  }
};
