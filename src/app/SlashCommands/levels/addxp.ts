import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { addXP, getUserLevel } from '../../../Utils/LevelSystem';

export default {
  data: new SlashCommandBuilder()
    .setName('addxp')
    .setDescription('Добавить XP пользователю (только для администраторов)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Пользователь, которому нужно добавить XP')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Количество XP для добавления')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100000)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Причина добавления XP')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('silent')
        .setDescription('Тихое добавление XP (пользователь не получит уведомление)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    // Проверяем права
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'У вас нет прав для использования этой команды.',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const reason = interaction.options.getString('reason') || 'Административное действие';
    const silent = interaction.options.getBoolean('silent') || false;

    await interaction.deferReply({ ephemeral: silent });

    try {
      const { oldLevel, newLevel } = await addXP(targetUser.id, amount);
      const { xp, progress, rank } = await getUserLevel(targetUser.id);

      // Проверяем повышение уровня для отображения в сообщении
      let levelUpText = '';
      if (newLevel > oldLevel) {
        const levelDiff = newLevel - oldLevel;
        levelUpText = `\n\n🎉 **Повышение уровня!** +${levelDiff} ${levelDiff === 1 ? 'уровень' : levelDiff < 5 ? 'уровня' : 'уровней'}`;
      }

      const adminEmbed = new EmbedBuilder()
        .setTitle('—・Добавление XP')
        .setDescription(`Пользователю ${targetUser} успешно добавлено **${amount.toLocaleString()}** XP.
**Причина:** ${reason}

**Текущий статус:**
• **Уровень:** ${newLevel} ${newLevel > oldLevel ? `(+${newLevel - oldLevel})` : ''}
• **Всего XP:** ${xp.toLocaleString()}
• **Прогресс:** ${progress}%
• **Ранг:** #${rank || '??'}${levelUpText}`)
        .setColor('#2f3136')
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      // Отправляем сообщение пользователю, если не в тихом режиме
      if (!silent && targetUser.id !== interaction.user.id) {
        try {
          const userEmbed = new EmbedBuilder()
            .setTitle('—・Получение XP')
            .setDescription(`Вы получили **${amount.toLocaleString()}** XP от администратора.
**Причина:** ${reason}

**Ваш текущий статус:**
• **Уровень:** ${newLevel} ${newLevel > oldLevel ? `(+${newLevel - oldLevel})` : ''}
• **Всего XP:** ${xp.toLocaleString()}
• **Прогресс:** ${progress}%
• **Ранг:** #${rank || '??'}${levelUpText}`)
            .setColor('#2f3136')
            .setTimestamp();

          await targetUser.send({ embeds: [userEmbed] })
            .catch(() => {
              // Если не удалось отправить сообщение, добавляем информацию в основное сообщение
              adminEmbed.setFooter({ text: 'Не удалось отправить уведомление пользователю (личные сообщения закрыты)' });
            });
        } catch (dmError) {
          console.error(`[LEVELS] Failed to send DM to user ${targetUser.id}:`, dmError);
          adminEmbed.setFooter({ text: 'Не удалось отправить уведомление пользователю' });
        }
      }

      await interaction.editReply({ embeds: [adminEmbed] });
    } catch (error) {
      console.error('Error adding XP:', error);
      await interaction.editReply({
        content: 'Произошла ошибка при добавлении XP. Пожалуйста, попробуйте позже.'
      });
    }
  }
};
