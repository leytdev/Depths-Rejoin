import { Collection, CommandInteraction, AutocompleteInteraction, REST, Routes, Client, Interaction } from "discord.js";
import fs from "fs/promises";
import path from "path";
import { clientId, guildId, token } from "../config";

export default class SlashCommandHandler {
  public cache = new Collection<string, any>();

  constructor(private commandsDir: string) { }

  async load() {
    const files = await this.getAllFiles(this.commandsDir);
    for (const file of files) {
      const cmdModule = await import(file);
      const command = cmdModule.default;
      if (command && command.data && (typeof command.execute === "function" || typeof command.run === "function")) {
        this.cache.set(command.data.name, command);
      }
    }
    await this.registerCommands();
  }

  listen(client: Client) {
    client.on("interactionCreate", async (interaction: Interaction) => {
      if (interaction.isChatInputCommand()) {
        await this.handleInteraction(interaction);
      }
      // Обработка кнопок
      if (interaction.isButton()) {
        const handler = (client as any).interactions.getButton(interaction.customId);
        if (handler && typeof handler.run === "function") {
          await handler.run(interaction);
        }
      }
      // Обработка селект-меню
      if (interaction.isStringSelectMenu()) {
        console.log(`[DEBUG] Received StringSelectMenu interaction: ${interaction.customId}`);
        const handler = (client as any).interactions.getMenu(interaction.customId);
        if (handler && typeof handler.run === "function") {
          console.log(`[DEBUG] Found handler for menu ${interaction.customId}, executing...`);
          await handler.run(interaction);
        } else {
          console.log(`[DEBUG] No handler found for menu ${interaction.customId}`);
          console.log(`[DEBUG] Available menu handlers: ${Array.from((client as any).interactions.menus.keys()).join(', ')}`);
        }
      }
      // Обработка модальных окон
      if (interaction.isModalSubmit()) {
        const handler = (client as any).interactions.getModal(interaction.customId);
        if (handler && typeof handler.run === "function") {
          await handler.run(interaction);
        }
      }
    });
  }

  async registerCommands() {
    const rest = new REST({ version: "10" }).setToken(token);
    const commandsData = Array.from(this.cache.values()).map(cmd => cmd.data.toJSON());
    try {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsData }
      );
    } catch (error) {
      // Ошибка при регистрации команд
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    let results: string[] = [];
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const file of list) {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        results = results.concat(await this.getAllFiles(filePath));
      } else if (file.name.endsWith(".ts") || file.name.endsWith(".js")) {
        results.push(filePath);
      }
    }
    return results;
  }

  get(commandName: string) {
    return this.cache.get(commandName);
  }

  async handleInteraction(interaction: CommandInteraction) {
    const command = this.get(interaction.commandName);
    if (command) {
      try {
        if (typeof command.execute === "function") {
          await command.execute(interaction);
        } else if (typeof command.run === "function") {
          await command.run(interaction);
        }
      } catch (err) {
        console.error('Error executing command:', err);
        try {
          // Проверяем, было ли взаимодействие уже отвечено
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "Произошла ошибка при выполнении команды.", ephemeral: true });
          } else {
            await interaction.reply({ content: "Произошла ошибка при выполнении команды.", ephemeral: true });
          }
        } catch (replyError) {
          console.error('Error sending error response:', replyError);
        }
      }
    }
  }

  async handleAutocomplete(interaction: AutocompleteInteraction) {
    const command = this.get(interaction.commandName);
    if (command && typeof command.autocomplete === "function") {
      try {
        await command.autocomplete(interaction);
      } catch { }
    }
  }
} 