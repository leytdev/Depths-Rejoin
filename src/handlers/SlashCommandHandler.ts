import { Collection, CommandInteraction, AutocompleteInteraction, REST, Routes, Client, Interaction } from "discord.js";
import fs from "fs/promises";
import path from "path";
import { clientId, guildId, token } from "../config";
import { ErrorHandler } from "../Utils/ErrorHandler";

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
      try {
        if (interaction.isChatInputCommand()) {
          await this.handleInteraction(interaction);
        }
        else if (interaction.isButton()) {
          const handler = (client as any).interactions.getButton(interaction.customId);
          if (handler && typeof handler.run === "function") {
            try {
              await handler.run(interaction);
            } catch (buttonError) {
              ErrorHandler.logError(`Button Handler: ${interaction.customId}`, buttonError);
              await ErrorHandler.safeReply(interaction, "Произошла ошибка при обработке кнопки.");
            }
          }
        }
        else if (interaction.isStringSelectMenu()) {
          const handler = (client as any).interactions.getMenu(interaction.customId);
          if (handler && typeof handler.run === "function") {
            try {
              await handler.run(interaction);
            } catch (menuError) {
              ErrorHandler.logError(`Menu Handler: ${interaction.customId}`, menuError);
              await ErrorHandler.safeReply(interaction, "Произошла ошибка при обработке меню.");
            }
          }
        }
        else if (interaction.isModalSubmit()) {
          const handler = (client as any).interactions.getModal(interaction.customId);
          if (handler && typeof handler.run === "function") {
            try {
              await handler.run(interaction);
            } catch (modalError) {
              ErrorHandler.logError(`Modal Handler: ${interaction.customId}`, modalError);
              await ErrorHandler.safeReply(interaction, "Произошла ошибка при обработке формы.");
            }
          }
        }
      } catch (error) {
        ErrorHandler.logError("Global Interaction Handler", error);
      }
    });
  }

  async registerCommands() {
    const rest = new REST({ version: "10" }).setToken(token);
    const commandsData = Array.from(this.cache.values()).map((cmd: any) => cmd.data.toJSON());
    try {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsData }
      );
    } catch (error) {
      ErrorHandler.logError("Command Registration", error);
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
        await ErrorHandler.handleCommandError(interaction, err, interaction.commandName);
      }
    }
  }

  // Removed safeReply in favor of centralized ErrorHandler.safeReply

  async handleAutocomplete(interaction: AutocompleteInteraction) {
    const command = this.get(interaction.commandName);
    if (command && typeof command.autocomplete === "function") {
      try {
        await command.autocomplete(interaction);
      } catch { }
    }
  }
} 