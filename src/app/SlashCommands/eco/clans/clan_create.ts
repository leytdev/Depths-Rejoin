import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  Guild,
  ColorResolvable,
  Role
} from "discord.js";
import { addBalance, TRANSACTION_TYPES, BANK_ID, logTransaction } from "../../../../Utils/EconomyBase";
import { CLAN_TRANSACTIONS } from "./clan_constants";
import { money } from "../../../../Utils/Ids";
import { ClanModel } from "../../../../schema/ClanSchema";

// Цена создания клана
const CLAN_CREATE_COST = 1000;

// Проверить, есть ли у пользователя уже клан
async function getUserClan(userId: string) {
  return ClanModel.findOne({ "members.userId": userId });
}

// Генерация случайного 4-х значного ID
function generateClanId(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `#${randomNum}`;
}

// Создать роль клана на сервере
async function createClanRole(guild: Guild, clanName: string, clanId: string): Promise<Role | null> {
  try {
    const roleName = `клан-${clanId}`;
    const role = await guild.roles.create({
      name: roleName,
      color: '#2f3136' as ColorResolvable,
      mentionable: true,
      reason: `Создание клана ${clanName}`
    });
    return role;
  } catch (error) {
    console.error('Ошибка при создании роли клана:', error);
    return null;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName("clan_create")
    .setDescription("Создать новый клан"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const userId = interaction.user.id;

      // Проверяем, состоит ли пользователь уже в клане
      const existingClan = await getUserClan(userId);
      if (existingClan) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Клан")
              .setDescription(`Вы уже состоите в клане **${existingClan.name}**.\n > Сначала **покиньте** текущий клан.`)
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Генерируем уникальный ID клана
      let clanId = generateClanId();
      while (await ClanModel.findOne({ clanId })) {
        clanId = generateClanId();
      }

      // Проверяем, есть ли у пользователя достаточно монет
      try {
        // Списываем средства с пользователя (деньги уйдут в банк)
        // addBalance автоматически запишет транзакцию типа clan_create
        await addBalance(userId, -CLAN_CREATE_COST, CLAN_TRANSACTIONS.CREATE);

        // Важно: не нужно вызывать logTransaction второй раз,
        // так как addBalance уже создает запись транзакции
      } catch (error) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Клан")
              .setDescription(`У вас **недостаточно монет** для создания клана.\n> Необходимо: **${CLAN_CREATE_COST}** ${money}.`)
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Название клана по умолчанию
      const clanName = `Клан${clanId}`;

      // Создаем роль для клана, если команда вызвана на сервере
      let roleId = null;
      if (interaction.guild) {
        const role = await createClanRole(interaction.guild, clanName, clanId);
        if (role) {
          roleId = role.id;

          // Выдаем роль создателю клана
          try {
            const member = interaction.guild.members.cache.get(userId);
            if (member) {
              await member.roles.add(role);
            }
          } catch (error) {
            console.error('Ошибка при выдаче роли клана:', error);
          }
        }
      }

      // Создаем клан
      const clan = new ClanModel({
        name: clanName,
        clanId: clanId,
        description: "Описание клана отсутствует",
        ownerId: userId,
        members: [{ userId, role: "owner", joinedAt: new Date() }],
        roleId: roleId
      });

      await clan.save();

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("—・Клан")
            .setDescription(`<@${userId}>, Поздравляем! Вы создали клан.\nС вашего счета списано **${CLAN_CREATE_COST}** ${money}.\n
              > Используйте /clan_settings для **настройки** клана.`)
            .setColor("#2f3136")
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp()
        ]
      });
    } catch (error) {
      console.error("Ошибка при создании клана:", error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("—・Ошибка")
            .setDescription("Произошла ошибка при создании клана. Пожалуйста, попробуйте позже.")
            .setColor("#ff0000")
            .setTimestamp()
        ]
      });
    }
  }
};
