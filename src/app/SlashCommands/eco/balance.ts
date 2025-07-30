import {
  CommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  User,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { BalanceModel } from "../../../schema/BalanceSchema";
import { money } from "../../../Utils/Ids";

export default {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Показать баланс пользователя")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("Пользователь, чей баланс показать")
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user") || interaction.user;
    const balanceEntry = await BalanceModel.findOne({ UID: user.id });
    const balance = balanceEntry?.balance ?? 0;
    const shards = balanceEntry?.DepthsShards ?? 0;

    const embed = new EmbedBuilder()
      .setTitle(`—・Текущий баланс — ${user.username}`)
      .addFields(
        { name: 'Монеты:', value: `\`\`\`${balance}\`\`\``, inline: true },
        { name: 'Шарды:', value: `\`\`\`${shards}\`\`\``, inline: true }
      )
      .setThumbnail(user.displayAvatarURL())
      .setColor(0x2f3136);

    // Only add transaction history button if viewing own balance
    const components = [];
    if (user.id === interaction.user.id) {
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('view-transactions')
            .setLabel('Посмотреть транзакции')
            .setStyle(ButtonStyle.Secondary)
        );

      components.push(row);
    }

    await interaction.reply({
      embeds: [embed],
      components: components
    });
  }
};
