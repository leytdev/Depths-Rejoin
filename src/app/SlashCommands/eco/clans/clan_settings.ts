import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  ModalActionRowComponentBuilder
} from "discord.js";
import { ClanModel } from "../../../../schema/ClanSchema";

export default {
  data: new SlashCommandBuilder()
    .setName("clan_settings")
    .setDescription("Настройки клана"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = interaction.user.id;

      // Проверяем, состоит ли пользователь в клане и является ли владельцем
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
              .setTitle("—・Настройки клана")
              .setDescription("Вы не являетесь владельцем или заместителем клана.")
              .setColor("#2f3136")
              .setTimestamp()
          ]
        });
      }

      // Создаем меню выбора настроек
      const settingsMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("clan_settings_menu")
            .setPlaceholder("Выберите настройку")
            .addOptions([
              new StringSelectMenuOptionBuilder()
                .setLabel("Изменить название")
                .setValue("rename")
                .setDescription("Изменить название клана")
                .setEmoji("✏️"),
              new StringSelectMenuOptionBuilder()
                .setLabel("Изменить описание")
                .setValue("description")
                .setDescription("Изменить описание клана")
                .setEmoji("📝"),
              new StringSelectMenuOptionBuilder()
                .setLabel("Изменить логотип")
                .setValue("icon")
                .setDescription("Изменить логотип клана")
                .setEmoji("🖼️")
            ])
        );

      const reply = await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("—・Настройки клана")
            .setDescription(`Текущие настройки клана **${clan.name}** ${clan.clanId}:
            
**Название:** ${clan.name}
**Описание:** ${clan.description || "Отсутствует"}
**Логотип:** ${clan.icon ? "Установлен" : "Отсутствует"}

Выберите, что вы хотите изменить:`)
            .setColor("#2f3136")
            .setTimestamp()
        ],
        components: [settingsMenu]
      });

      // Создаем коллектор для меню выбора
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 300000 // 5 минут
      });

      collector.on("collect", async (menuInteraction) => {
        if (menuInteraction.user.id !== userId) {
          return menuInteraction.reply({
            content: "Эти настройки предназначены не для вас.",
            ephemeral: true
          });
        }

        const choice = menuInteraction.values[0];

        switch (choice) {
          case "rename":
            // Открываем модальное окно для изменения названия
            const renameModal = new ModalBuilder()
              .setCustomId("clan_rename_modal")
              .setTitle("Изменение названия клана");

            // Добавляем поле для ввода нового названия
            const nameInput = new TextInputBuilder()
              .setCustomId("clan_name")
              .setLabel("Новое название клана")
              .setStyle(TextInputStyle.Short)
              .setMinLength(3)
              .setMaxLength(32)
              .setPlaceholder("Введите новое название клана")
              .setRequired(true);

            // Добавляем поле в модальное окно
            renameModal.addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput)
            );

            // Показываем модальное окно
            await menuInteraction.showModal(renameModal);
            break;

          case "description":
            // Открываем модальное окно для изменения описания
            const descriptionModal = new ModalBuilder()
              .setCustomId("clan_description_modal")
              .setTitle("Изменение описания клана");

            // Добавляем поле для ввода нового описания
            const descriptionInput = new TextInputBuilder()
              .setCustomId("clan_description")
              .setLabel("Новое описание клана")
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(1000)
              .setPlaceholder("Введите новое описание клана")
              .setRequired(true);

            // Добавляем поле в модальное окно
            descriptionModal.addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(descriptionInput)
            );

            // Показываем модальное окно
            await menuInteraction.showModal(descriptionModal);
            break;

          case "icon":
            // Открываем модальное окно для изменения логотипа
            const iconModal = new ModalBuilder()
              .setCustomId("clan_icon_modal")
              .setTitle("Изменение логотипа клана");

            // Добавляем поле для ввода ссылки на логотип
            const iconInput = new TextInputBuilder()
              .setCustomId("clan_icon")
              .setLabel("Ссылка на изображение логотипа")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("https://example.com/image.png")
              .setRequired(true);

            // Добавляем поле в модальное окно
            iconModal.addComponents(
              new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(iconInput)
            );

            // Показываем модальное окно
            await menuInteraction.showModal(iconModal);
            break;
        }
      });

      // Обработчик окончания времени коллектора
      collector.on("end", () => {
        interaction.editReply({
          components: [],
          embeds: [
            new EmbedBuilder()
              .setTitle("—・Настройки клана")
              .setDescription("Время выбора настроек истекло.")
              .setColor("#2f3136")
              .setTimestamp()
          ]
        }).catch(() => { });
      });

    } catch (error) {
      console.error("Ошибка в настройках клана:", error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("—・Ошибка")
            .setDescription("Произошла ошибка при настройке клана. Пожалуйста, попробуйте позже.")
            .setColor("#ff0000")
            .setTimestamp()
        ]
      });
    }
  }
};

// Функция обработки модальных окон для настроек клана - больше не используется, так как теперь используются отдельные файлы в папке Modals
// DEPRECATED: This function is no longer needed as we're using separate modal handlers in Modals folder
export function handleClanSettingsModals(client: any) {
  client.on("interactionCreate", async (interaction: any) => {
    if (!interaction.isModalSubmit()) return;

    const userId = interaction.user.id;

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
      // Обработка модального окна изменения названия
      if (interaction.customId === "clan_rename_modal") {
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
      }

      // Обработка модального окна изменения описания
      else if (interaction.customId === "clan_description_modal") {
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
      }

      // Обработка модального окна изменения логотипа
      else if (interaction.customId === "clan_icon_modal") {
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
      }
    } catch (error) {
      console.error("Ошибка при обработке модального окна:", error);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("—・Ошибка")
            .setDescription("Произошла ошибка при изменении настроек клана. Пожалуйста, попробуйте позже.")
            .setColor("#ff0000")
            .setTimestamp()
        ],
        ephemeral: true
      });
    }
  });
}
