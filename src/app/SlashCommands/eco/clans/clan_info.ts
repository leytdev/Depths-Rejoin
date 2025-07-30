import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ApplicationCommandOptionType
} from "discord.js";
import { updateClanXP } from "../../../../Utils/ClanUtils";
import { ClanModel } from "../../../../schema/ClanSchema";
import { ColorResolvable, EmbedBuilder, toColorResolvable } from "../../../../Utils/DiscordTypes";

export default {
  data: new SlashCommandBuilder()
    .setName("clan_info")
    .setDescription("Показать информацию о клане")
    .addStringOption(option =>
      option
        .setName("id")
        .setDescription("ID клана (например, #1234)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const userId = interaction.user.id;
      const clanId = interaction.options.getString("id");

      let clan;

      // Если ID клана указан, ищем по нему
      if (clanId) {
        // Нормализуем ID (добавляем #, если его нет)
        const normalizedId = clanId.startsWith('#') ? clanId : `#${clanId}`;
        clan = await ClanModel.findOne({ clanId: normalizedId });
      } else {
        // Иначе ищем клан, в котором состоит пользователь
        clan = await ClanModel.findOne({ "members.userId": userId });
      }

      // Если клан не найден
      if (!clan) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Информация о клане")
              .setDescription(clanId
                ? `Клан с ID **${clanId}** не найден.`
                : `Вы не состоите ни в одном клане.`)
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Получаем информацию о владельце и заместителе
      let ownerName = "Неизвестно";
      let deputyName = "Не назначен";

      try {
        if (clan.ownerId) {
          const owner = await interaction.client.users.fetch(clan.ownerId);
          ownerName = owner.username;
        }

        if (clan.deputyId) {
          const deputy = await interaction.client.users.fetch(clan.deputyId);
          deputyName = deputy.username;
        }
      } catch (error) {
        console.error("Ошибка при получении информации о пользователях:", error);
      }

      // Обновляем информацию о XP клана перед отображением
      await updateClanXP(clan);

      // Формируем список участников
      let membersList = "";
      const memberPromises = clan.members.map(async (member: any) => {
        try {
          const user = await interaction.client.users.fetch(member.userId);
          const roleName =
            member.role === "owner" ? "👑 Владелец" :
              member.role === "deputy" ? "⭐ Заместитель" :
                "👤 Участник";

          return `${roleName}: ${user.username}\n`;
        } catch {
          return `${member.role === "owner" ? "👑 Владелец" :
            member.role === "deputy" ? "⭐ Заместитель" :
              "👤 Участник"}: ID: ${member.userId}\n`;
        }
      });

      const membersStrings = await Promise.all(memberPromises);
      membersList = membersStrings.join("");

      // Создаем эмбед с информацией о клане
      const embed = new EmbedBuilder()
        .setTitle(`—・${clan.name} ${clan.clanId}`)
        .setDescription(clan.description || "Описание отсутствует")
        .setColor(toColorResolvable(clan.color))
        .addFields(
          { name: "Владелец", value: `<@${clan.ownerId}> (${ownerName})`, inline: true },
          { name: "Заместитель", value: clan.deputyId ? `<@${clan.deputyId}> (${deputyName})` : "Не назначен", inline: true },
          { name: "Создан", value: `<t:${Math.floor(clan.createdAt.getTime() / 1000)}:R>`, inline: true },
          { name: "Участники", value: `${clan.members.length}/10`, inline: true },
          { name: "Опыт", value: `${clan.xp} XP`, inline: true },
          { name: "Казна", value: `${clan.balance}`, inline: true },
          { name: "Участники клана", value: membersList || "Нет участников", inline: false }
        )
        .setTimestamp();

      // Если у клана есть логотип, добавляем его
      if (clan.icon) {
        embed.setThumbnail(clan.icon);
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Ошибка при получении информации о клане:", error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("—・Ошибка")
            .setDescription("Произошла ошибка при получении информации о клане. Пожалуйста, попробуйте позже.")
            .setColor("#ff0000")
            .setTimestamp()
        ]
      });
    }
  }
};
