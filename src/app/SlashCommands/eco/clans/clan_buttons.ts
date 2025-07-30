import { Client } from "discord.js";
import { ClanModel } from "../../../../schema/ClanSchema";
import { updateClanXP } from "../../../../Utils/ClanUtils";
import { ColorResolvable } from "../../../../Utils/DiscordTypes";

// Обработчик кнопок для приглашений в клан
export function setupClanButtonHandlers(client: Client) {

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;

    // Обработка кнопок принятия и отклонения приглашений в клан
    if (customId.startsWith("clan_join_") || customId.startsWith("clan_decline_")) {
      const isJoin = customId.startsWith("clan_join_");
      const clanId = customId.replace(isJoin ? "clan_join_" : "clan_decline_", "");
      const userId = interaction.user.id;

      try {
        // Проверяем, существует ли клан
        const clan = await ClanModel.findOne({ clanId });
        if (!clan) {
          return interaction.reply({
            content: `Клан с ID ${clanId} не найден или был удален.`,
            ephemeral: true
          });
        }

        if (isJoin) {
          // Проверяем, не состоит ли пользователь уже в клане
          const existingClan = await ClanModel.findOne({ "members.userId": userId });
          if (existingClan) {
            return interaction.reply({
              content: `Вы уже состоите в клане **${existingClan.name}**. Сначала покиньте текущий клан.`,
              ephemeral: true
            });
          }

          // Проверяем, не достигнут ли лимит участников
          if (clan.members.length >= 10) {
            return interaction.reply({
              content: `В клане **${clan.name}** достигнуто максимальное количество участников (10).`,
              ephemeral: true
            });
          }

          // Проверяем, есть ли приглашение
          if (!clan.invites || !clan.invites.includes(userId)) {
            return interaction.reply({
              content: `У вас нет активного приглашения в клан **${clan.name}** или приглашение было отменено.`,
              ephemeral: true
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

          // Пробуем выдать роль клана, если есть сервер и роль
          const guild = client.guilds.cache.find(g =>
            g.members.cache.has(userId) && g.members.cache.has(clan.ownerId)
          );

          if (guild && clan.roleId) {
            try {
              const member = await guild.members.fetch(userId);
              if (member) {
                const role = await guild.roles.fetch(clan.roleId);
                if (role) {
                  await member.roles.add(role);
                }
              }
            } catch (error) {
              console.error("Ошибка при выдаче роли клана:", error);
            }
          }

          return interaction.update({
            content: `Вы успешно вступили в клан **${clan.name}** ${clan.clanId}.`,
            embeds: [],
            components: []
          });
        } else {
          // Отклоняем приглашение
          if (clan.invites && clan.invites.includes(userId)) {
            clan.invites = clan.invites.filter((id: string) => id !== userId);
            await clan.save();
          }

          return interaction.update({
            content: `Вы отклонили приглашение в клан **${clan.name}**.`,
            embeds: [],
            components: []
          });
        }
      } catch (error) {
        console.error("Ошибка при обработке кнопки клана:", error);
        return interaction.reply({
          content: "Произошла ошибка при обработке вашего действия. Пожалуйста, попробуйте позже.",
          ephemeral: true
        });
      }
    }
  });
}
