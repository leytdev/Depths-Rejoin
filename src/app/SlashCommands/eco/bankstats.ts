import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, AttachmentBuilder } from "discord.js";
import { getTransactionStats, TRANSACTION_TYPES } from "../../../Utils/EconomyBase";
import { ownerUID } from "../../../config";
import { money } from "../../../Utils/Ids";

// Закомментированы импорты для будущего использования
// import { ChartJSNodeCanvas } from "chartjs-node-canvas";

// Это заготовка для будущей интеграции с ChartJS
// Для полной реализации потребуется установить пакеты:
// npm install chartjs-node-canvas chart.js

export default {
  data: new SlashCommandBuilder()
    .setName("bankstats")
    .setDescription("Статистика доходов и расходов банка")
    .addStringOption(option =>
      option.setName("period")
        .setDescription("Период для отображения статистики")
        .setRequired(false)
        .addChoices(
          { name: "День", value: "day" },
          { name: "Неделя", value: "week" },
          { name: "Месяц", value: "month" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    // Проверяем, является ли исполнитель владельцем
    if (interaction.user.id !== ownerUID) {
      return interaction.reply({
        content: "У вас нет прав для использования этой команды.",
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const period = (interaction.options.getString("period") || "week") as "day" | "week" | "month";

      const stats = await getTransactionStats(period);

      let periodText = "за последнюю неделю";
      if (period === "day") periodText = "за последние 24 часа";
      if (period === "month") periodText = "за последний месяц";

      // Создаем эмбед с текстовой статистикой
      const embed = new EmbedBuilder()
        .setTitle(`—・Статистика банка ${periodText}`)
        .addFields(
          { name: 'Общий доход:', value: `\`\`\`${stats.income.total.toLocaleString()} монет\`\`\``, inline: true },
          { name: 'Общий расход:', value: `\`\`\`${stats.expense.total.toLocaleString()} монет\`\`\``, inline: true },
          { name: 'Баланс:', value: `\`\`\`${(stats.income.total - stats.expense.total).toLocaleString()} монет\`\`\``, inline: false }
        )
        .setColor(0x2f3136)
        .setTimestamp();

      // Добавляем топ-3 источника доходов
      const incomeEntries = Object.entries(stats.income.byType)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      if (incomeEntries.length > 0) {
        const incomeText = incomeEntries
          .map(([type, amount], i) => `${i + 1}. ${formatTransactionType(type)}: ${amount.toLocaleString()} монет`)
          .join('\n');

        embed.addFields({ name: 'Топ источники дохода:', value: `\`\`\`${incomeText}\`\`\``, inline: false });
      }

      // Добавляем топ-3 статьи расходов
      const expenseEntries = Object.entries(stats.expense.byType)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      if (expenseEntries.length > 0) {
        const expenseText = expenseEntries
          .map(([type, amount], i) => `${i + 1}. ${formatTransactionType(type)}: ${amount.toLocaleString()} монет`)
          .join('\n');

        embed.addFields({ name: 'Топ статьи расходов:', value: `\`\`\`${expenseText}\`\`\``, inline: false });
      }

      // В будущем здесь можно добавить генерацию графика
      // const chart = await generateChart(stats, period);
      // const attachment = new AttachmentBuilder(chart, { name: 'chart.png' });
      // embed.setImage('attachment://chart.png');
      // 
      // return interaction.editReply({ embeds: [embed], files: [attachment] });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Ошибка при получении статистики:", error);
      return interaction.editReply({
        content: "Произошла ошибка при получении статистики банка."
      });
    }
  }
};

// Форматирование типа транзакции для отображения
function formatTransactionType(type: string): string {
  const typeMap: Record<string, string> = {
    [TRANSACTION_TYPES.AWARD]: "Выдача администратором",
    [TRANSACTION_TYPES.DAILY]: "Ежедневные награды",
    [TRANSACTION_TYPES.COINFLIP_WIN]: "Выигрыши в монетке",
    [TRANSACTION_TYPES.COINFLIP_LOSE]: "Проигрыши в монетке",
    [TRANSACTION_TYPES.BLACKJACK_WIN]: "Выигрыши в блэкджеке",
    [TRANSACTION_TYPES.BLACKJACK_LOSE]: "Проигрыши в блэкджеке",
    [TRANSACTION_TYPES.BLACKJACK_DRAW]: "Ничьи в блэкджеке",
    [TRANSACTION_TYPES.BANK_TO_USER]: "Переводы из банка",
    [TRANSACTION_TYPES.USER_TO_BANK]: "Переводы в банк",
    [TRANSACTION_TYPES.SYSTEM]: "Системные операции",
  };

  return typeMap[type] || type;
}

/* 
// Пример функции для генерации графика (требует установки chartjs-node-canvas)
async function generateChart(stats: any, period: string) {
  const width = 800;
  const height = 400;
  
  const chartCallback = (ChartJS: any) => {
    ChartJS.defaults.color = '#ffffff';
    ChartJS.defaults.font.family = 'Arial';
  };
  
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });
  
  // Подготавливаем данные для графика
  const incomeData = Object.entries(stats.income.byType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
    
  const expenseData = Object.entries(stats.expense.byType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  
  // Конфигурация графика
  const configuration = {
    type: 'bar',
    data: {
      labels: [...new Set([...incomeData.map(([type]) => formatTransactionType(type)), 
                           ...expenseData.map(([type]) => formatTransactionType(type))])],
      datasets: [
        {
          label: 'Доходы',
          data: incomeData.map(([type, amount]) => ({ x: formatTransactionType(type), y: amount })),
          backgroundColor: 'rgba(75, 192, 192, 0.7)',
          borderColor: 'rgb(75, 192, 192)',
          borderWidth: 1
        },
        {
          label: 'Расходы',
          data: expenseData.map(([type, amount]) => ({ x: formatTransactionType(type), y: amount })),
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          borderColor: 'rgb(255, 99, 132)',
          borderWidth: 1
        }
      ]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: `Статистика банка за ${period === 'day' ? 'день' : period === 'week' ? 'неделю' : 'месяц'}`
        },
        legend: {
          display: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Монеты'
          }
        }
      },
      backgroundColor: '#2f3136'
    }
  };
  
  // Генерируем график
  return await chartJSNodeCanvas.renderToBuffer(configuration);
}
*/
