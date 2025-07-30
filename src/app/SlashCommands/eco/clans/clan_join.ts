import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ApplicationCommandOptionType,
  GuildMember
} from "discord.js";
import { CLAN_TRANSACTIONS } from "./clan_constants";
import { updateClanXP } from "../../../../Utils/ClanUtils";
import { ColorResolvable, EmbedBuilder, toColorResolvable } from "../../../../Utils/DiscordTypes";
import { ClanModel } from "../../../../schema/ClanSchema";

export default {
  data: new SlashCommandBuilder()
    .setName("clan_join")
    .setDescription("Принять приглашение в клан")
    .addStringOption(option =>
      option
        .setName("id")
        .setDescription("ID клана (например, #1234)")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const userId = interaction.user.id;
      let clanId: string | null = interaction.options.getString("id");

      // Если ID не был предоставлен (хотя это маловероятно из-за required: true)
      if (!clanId) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Вступление в клан")
              .setDescription("Необходимо указать ID клана.")
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Проверяем, не состоит ли пользователь уже в клане
      const existingClan = await ClanModel.findOne({ "members.userId": userId });
      if (existingClan) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Вступление в клан")
              .setDescription(`Вы уже состоите в клане **${existingClan.name}**. Сначала покиньте текущий клан.`)
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Нормализуем ID (добавляем #, если его нет)
      if (clanId && !clanId.startsWith('#')) {
        clanId = `#${clanId}`;
      }

      // Находим клан по ID
      const clan = await ClanModel.findOne({ clanId });
      if (!clan) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Вступление в клан")
              .setDescription(`Клан с ID **${clanId}** не найден.`)
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Проверяем, есть ли приглашение
      if (!clan.invites || !clan.invites.includes(userId)) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Вступление в клан")
              .setDescription(`У вас нет приглашения в клан **${clan.name}**.`)
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
              .setTitle("—・Вступление в клан")
              .setDescription(`В клане **${clan.name}** достигнуто максимальное количество участников (10).`)
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Добавляем пользователя в клан и удаляем из приглашенных
      clan.members.push({
        userId,
        role: "member",
        joinedAt: new Date()
      });

      clan.invites = clan.invites.filter((id: string) => id !== userId);
      await clan.save();

      // Обновляем XP клана с учетом нового участника
      await updateClanXP(clan);

      // Выдаем роль клана, если возможно
      if (interaction.guild && clan.roleId) {
        try {
          const member = interaction.guild.members.cache.get(userId) ||
            await interaction.guild.members.fetch(userId).catch(() => null);

          if (member) {
            // Используем кеш, если роль уже была загружена
            const role = interaction.guild.roles.cache.get(clan.roleId) ||
              await interaction.guild.roles.fetch(clan.roleId);

            if (role) {
              await member.roles.add(role);
            }
          }
        } catch (error) {
          console.error("Ошибка при выдаче роли клана:", error);
        }
      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("—・Вступление в клан")
            .setDescription(`Вы успешно вступили в клан **${clan.name}** ${clan.clanId}.`)
            .setColor(toColorResolvable(clan.color))
            .setTimestamp()
            .setFooter({ text: "Добро пожаловать в клан!" })
        ]
      });
    } catch (error) {
      console.error("Ошибка при вступлении в клан:", error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("—・Ошибка")
            .setDescription("Произошла ошибка при вступлении в клан. Пожалуйста, попробуйте позже.")
            .setColor("#ff0000")
            .setTimestamp()
        ]
      });
    }
  }
};
