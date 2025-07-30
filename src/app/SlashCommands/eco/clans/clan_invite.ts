import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from "discord.js";
import { ColorResolvable, EmbedBuilder, toColorResolvable } from "../../../../Utils/DiscordTypes";
import { addBalance } from "../../../../Utils/EconomyBase";
import { CLAN_TRANSACTIONS } from "./clan_constants";
import { ClanModel } from "../../../../schema/ClanSchema";

export default {
  data: new SlashCommandBuilder()
    .setName("clan_invite")
    .setDescription("Пригласить пользователя в клан")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Пользователь, которого нужно пригласить")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const userId = interaction.user.id;
      const targetUser = interaction.options.getUser("user");

      if (!targetUser) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Приглашение в клан")
              .setDescription("Необходимо указать пользователя для приглашения.")
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Проверяем, состоит ли пользователь в клане и имеет ли права приглашать
      const clan = await ClanModel.findOne({
        "members.userId": userId,
        $or: [
          { ownerId: userId },
          { deputyId: userId }
        ]
      });

      if (!clan) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Приглашение в клан")
              .setDescription("Вы не являетесь владельцем или заместителем клана.")
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Проверяем, не состоит ли уже целевой пользователь в клане
      const targetUserClan = await ClanModel.findOne({ "members.userId": targetUser.id });
      if (targetUserClan) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Приглашение в клан")
              .setDescription(`${targetUser.username} уже состоит в клане ${targetUserClan.name}.`)
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Проверяем, не достигнут ли лимит участников
      if (clan.members.length >= 10) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Приглашение в клан")
              .setDescription("В клане достигнуто максимальное количество участников (10).")
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Проверяем, не приглашен ли пользователь уже
      if (clan.invites && clan.invites.includes(targetUser.id)) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Приглашение в клан")
              .setDescription(`${targetUser.username} уже приглашен в ваш клан.`)
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Добавляем пользователя в список приглашенных
      if (!clan.invites) clan.invites = [];
      clan.invites.push(targetUser.id);
      await clan.save();

      // Создаем кнопки для принятия/отклонения приглашения
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`clan_join_${clan.clanId}`)
            .setLabel("Принять приглашение")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`clan_decline_${clan.clanId}`)
            .setLabel("Отклонить")
            .setStyle(ButtonStyle.Danger)
        );

      // Пробуем отправить приглашение в личку
      try {
        await targetUser.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Приглашение в клан")
              .setDescription(`Вы приглашены в клан **${clan.name}** ${clan.clanId}.\n\n**Описание клана:**\n${clan.description}\n\n**Владелец:** <@${clan.ownerId}>`)
              .setColor(toColorResolvable(clan.color))
              .setTimestamp()
              .setFooter({ text: `Приглашение от ${interaction.user.username}` })
          ],
          components: [row]
        });

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Приглашение в клан")
              .setDescription(`${targetUser.username} получил приглашение в клан **${clan.name}**.`)
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      } catch (error) {
        // Если не удалось отправить в личку, уведомляем об этом
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Приглашение в клан")
              .setDescription(`${targetUser.username} приглашен в клан **${clan.name}**, но не может получать личные сообщения. Для вступления необходимо использовать команду \`/clan_join ${clan.clanId}\`.`)
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }
    } catch (error) {
      console.error("Ошибка при приглашении в клан:", error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("—・Ошибка")
            .setDescription("Произошла ошибка при отправке приглашения. Пожалуйста, попробуйте позже.")
            .setColor("#ff0000")
            .setTimestamp()
        ]
      });
    }
  }
};
