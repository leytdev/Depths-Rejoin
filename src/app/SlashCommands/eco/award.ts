import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, User, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { BalanceModel } from "../../../schema/BalanceSchema";
import { addBalance, addShards, TRANSACTION_TYPES } from "../../../Utils/EconomyBase";
import { ownerUID } from "../../../config";
import DepthsLogger from "../../../client/DepthsLogger";

const logger = new DepthsLogger();

export default {
  data: new SlashCommandBuilder()
    .setName("award")
    .setDescription("Выдать деньги пользователю (Только для владельца)")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("Пользователь, которому выдать деньги")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("currency")
        .setDescription("Валюта для выдачи")
        .setRequired(true)
        .addChoices(
          { name: "Монеты", value: "coins" },
          { name: "Шарды", value: "shards" }
        )
    )
    .addIntegerOption(option =>
      option.setName("amount")
        .setDescription("Сумма для выдачи")
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    // Проверяем, является ли исполнитель владельцем
    if (interaction.user.id !== ownerUID) {
      return interaction.reply({
        content: "У вас нет прав для использования этой команды.",
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser("user");
    const currency = interaction.options.getString("currency") as "coins" | "shards";
    const amount = interaction.options.getInteger("amount");

    if (!targetUser || !currency || !amount) {
      return interaction.reply({
        content: "Ошибка: неправильные параметры команды.",
        ephemeral: true
      });
    }

    try {
      let newBalance: number;

      if (currency === "coins") {
        // Деньги выдаются напрямую от администратора
        newBalance = await addBalance(targetUser.id, amount, TRANSACTION_TYPES.AWARD, interaction.user.id);
      } else {
        // Шарды выдаются напрямую от администратора
        newBalance = await addShards(targetUser.id, amount, TRANSACTION_TYPES.AWARD, interaction.user.id);
      }

      // Логируем в консоль
      logger.success(`${interaction.user.tag} (${interaction.user.id}) выдал ${amount} ${currency === "coins" ? "монет" : "шардов"} пользователю ${targetUser.tag} (${targetUser.id})`);

      // Создаем эмбед с информацией о выдаче
      const embed = new EmbedBuilder()
        .setTitle(`—・Выдача валюты`)
        .setDescription(`Успешно выдано ${amount} ${currency === "coins" ? "монет" : "шардов"} пользователю ${targetUser.toString()}`)
        .addFields(
          { name: 'Текущий баланс:', value: `\`\`\`${newBalance}\`\`\``, inline: true },
          { name: 'Валюта:', value: `\`\`\`${currency === "coins" ? "Монеты" : "Шарды"}\`\`\``, inline: true }
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({ text: `Администратор: ${interaction.user.tag}` })
        .setTimestamp()
        .setColor(0x2f3136);

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error(`Ошибка при выдаче валюты: ${error}`);
      return interaction.reply({
        content: "Произошла ошибка при выдаче валюты. Пожалуйста, попробуйте позже.",
        ephemeral: true
      });
    }
  }
};
