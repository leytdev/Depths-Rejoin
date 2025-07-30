/**
 * Modal handler helpers - these functions handle the modal submissions
 * without requiring direct schema imports which are causing TypeScript issues
 */
import { ModalSubmitInteraction, EmbedBuilder } from "discord.js";
import mongoose from "mongoose";
import path from "path";

// Helper function to get a model from global mongoose
function getMongooseModel(modelName: string) {
  return mongoose.models[modelName] || null;
}

/**
 * Handles clan rename modal submission
 */
export async function handleClanRenameModal(interaction: ModalSubmitInteraction) {
  const userId = interaction.user.id;

  // Get the ClanModel
  const ClanModel = getMongooseModel('Clan');
  if (!ClanModel) {
    return interaction.reply({
      content: "Ошибка: Не удалось найти модель Clan",
      ephemeral: true
    });
  }

  // Проверяем, состоит ли пользователь в клане и является ли владельцем или заместителем
  const clan = await ClanModel.findOne({
    "members.userId": userId,
    $or: [
      { ownerId: userId },
      { deputyId: userId }
    ]
  });

  if (!clan) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("—・Настройки клана")
          .setDescription("Вы не являетесь владельцем или заместителем клана.")
          .setColor("#2f3136")
          .setTimestamp()
      ],
      ephemeral: true
    });
  }

  try {
    const newName = interaction.fields.getTextInputValue("clan_name");

    // Проверка, первое ли это изменение названия (бесплатное)
    const isFirstRename = clan.name === `Клан${clan.clanId}`;

    // Если это не первое изменение, то проверяем возможность оплаты
    if (!isFirstRename) {
      // Здесь можно добавить логику для списания монет
      // Например: await addBalance(userId, -5000, "CLAN_RENAME");

      // Пока просто выводим сообщение
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("—・Изменение названия")
            .setDescription("Эта функция будет доступна позже. Первое изменение названия бесплатно, последующие платные.")
            .setColor("#2f3136")
            .setTimestamp()
        ],
        ephemeral: true
      });
    }

    // Изменяем название клана
    clan.name = newName;
    await clan.save();

    // Изменяем название роли клана, если она существует
    if (clan.roleId && interaction.guild) {
      try {
        const role = await interaction.guild.roles.fetch(clan.roleId);
        if (role) {
          await role.setName(`${newName}`);
        }
      } catch (error) {
        console.error("Ошибка при изменении названия роли клана:", error);
      }
    }

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("—・Настройки клана")
          .setDescription(`Название клана успешно изменено на **${newName}**.`)
          .setColor("#2f3136")
          .setTimestamp()
      ],
      ephemeral: true
    });
  } catch (error) {
    console.error("Ошибка при обработке модального окна:", error);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("—・Ошибка")
          .setDescription("Произошла ошибка при обработке вашего запроса.")
          .setColor("#ff0000")
          .setTimestamp()
      ],
      ephemeral: true
    });
  }
}

/**
 * Handles clan description modal submission
 */
export async function handleClanDescriptionModal(interaction: ModalSubmitInteraction) {
  const userId = interaction.user.id;

  // Get the ClanModel
  const ClanModel = getMongooseModel('Clan');
  if (!ClanModel) {
    return interaction.reply({
      content: "Ошибка: Не удалось найти модель Clan",
      ephemeral: true
    });
  }

  // Проверяем, состоит ли пользователь в клане и является ли владельцем или заместителем
  const clan = await ClanModel.findOne({
    "members.userId": userId,
    $or: [
      { ownerId: userId },
      { deputyId: userId }
    ]
  });

  if (!clan) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("—・Настройки клана")
          .setDescription("Вы не являетесь владельцем или заместителем клана.")
          .setColor("#2f3136")
          .setTimestamp()
      ],
      ephemeral: true
    });
  }

  try {
    const newDescription = interaction.fields.getTextInputValue("clan_description");

    // Изменяем описание клана
    clan.description = newDescription;
    await clan.save();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("—・Настройки клана")
          .setDescription("Описание клана успешно изменено.")
          .setColor("#2f3136")
          .setTimestamp()
      ],
      ephemeral: true
    });
  } catch (error) {
    console.error("Ошибка при обработке модального окна:", error);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("—・Ошибка")
          .setDescription("Произошла ошибка при обработке вашего запроса.")
          .setColor("#ff0000")
          .setTimestamp()
      ],
      ephemeral: true
    });
  }
}

/**
 * Handles clan icon modal submission
 */
export async function handleClanIconModal(interaction: ModalSubmitInteraction) {
  const userId = interaction.user.id;

  // Get the ClanModel
  const ClanModel = getMongooseModel('Clan');
  if (!ClanModel) {
    return interaction.reply({
      content: "Ошибка: Не удалось найти модель Clan",
      ephemeral: true
    });
  }

  // Проверяем, состоит ли пользователь в клане и является ли владельцем или заместителем
  const clan = await ClanModel.findOne({
    "members.userId": userId,
    $or: [
      { ownerId: userId },
      { deputyId: userId }
    ]
  });

  if (!clan) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("—・Настройки клана")
          .setDescription("Вы не являетесь владельцем или заместителем клана.")
          .setColor("#2f3136")
          .setTimestamp()
      ],
      ephemeral: true
    });
  }

  try {
    const newIcon = interaction.fields.getTextInputValue("clan_icon");

    // Проверяем, является ли ссылка действительной ссылкой на изображение
    if (!newIcon.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("—・Настройки клана")
            .setDescription("Неверная ссылка на изображение. Используйте прямую ссылку на изображение формата PNG, JPG, JPEG, GIF или WEBP.")
            .setColor("#ff0000")
            .setTimestamp()
        ],
        ephemeral: true
      });
    }

    // Изменяем логотип клана
    clan.icon = newIcon;
    await clan.save();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("—・Настройки клана")
          .setDescription("Логотип клана успешно изменен.")
          .setColor("#2f3136")
          .setTimestamp()
          .setThumbnail(newIcon)
      ],
      ephemeral: true
    });
  } catch (error) {
    console.error("Ошибка при обработке модального окна:", error);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("—・Ошибка")
          .setDescription("Произошла ошибка при обработке вашего запроса.")
          .setColor("#ff0000")
          .setTimestamp()
      ],
      ephemeral: true
    });
  }
}

/**
 * Handles leaderboard page navigation modal submission
 */
export async function handleLeaderboardGotoPageModal(interaction: ModalSubmitInteraction) {
  try {
    // Get the LevelModel
    const LevelModel = getMongooseModel('Level');
    if (!LevelModel) {
      return interaction.reply({
        content: "Ошибка: Не удалось найти модель Level",
        ephemeral: true
      });
    }

    const pageStr = interaction.fields.getTextInputValue("page");
    const page = parseInt(pageStr);

    if (isNaN(page) || page < 1) {
      return interaction.reply({
        content: "Введите корректный номер страницы (целое число больше 0).",
        ephemeral: true
      });
    }

    // Получаем общее количество записей для определения максимального числа страниц
    const totalUsers = await LevelModel.countDocuments();
    const usersPerPage = 10;
    const maxPages = Math.ceil(totalUsers / usersPerPage);

    if (page > maxPages) {
      return interaction.reply({
        content: `Указанная страница не существует. Всего страниц: ${maxPages}.`,
        ephemeral: true
      });
    }

    // Получаем данные для указанной страницы
    const skip = (page - 1) * usersPerPage;
    const users = await LevelModel.find()
      .sort({ xp: -1 })
      .skip(skip)
      .limit(usersPerPage);

    // Формируем эмбед с таблицей лидеров
    const embed = new EmbedBuilder()
      .setTitle("—・Таблица лидеров")
      .setColor("#2f3136")
      .setDescription(`Страница ${page}/${maxPages}`);

    // Загружаем информацию о пользователях
    let leaderboardText = "";
    let position = skip + 1;

    for (const userData of users) {
      try {
        const user = await interaction.client.users.fetch(userData.userId);
        const username = user ? user.username : "Неизвестный пользователь";
        leaderboardText += `**${position}.** ${username} - ${userData.xp.toLocaleString('ru-RU')} XP\n`;
      } catch (error) {
        leaderboardText += `**${position}.** ID: ${userData.userId} - ${userData.xp.toLocaleString('ru-RU')} XP\n`;
      }
      position++;
    }

    embed.addFields({ name: "Участники", value: leaderboardText || "Нет данных" });

    // Создаем компоненты навигации (кнопки)
    // ... [кнопки навигации]

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });

  } catch (error) {
    console.error("Ошибка при обработке перехода на страницу:", error);
    return interaction.reply({
      content: "Произошла ошибка при обработке вашего запроса.",
      ephemeral: true
    });
  }
}
