import { Interaction } from 'discord.js';

/**
 * Centralized error handling utility
 * Provides consistent error handling across the application
 */
export class ErrorHandler {
  /**
   * Log an error with contextual information
   * @param context The context where the error occurred (e.g., "Daily Command", "Voice State")
   * @param error The error object
   * @param details Additional details about the error
   */
  static logError(context: string, error: any, details?: string): void {
    console.error(`[ERROR] ${context}: ${error.message || error}`);
    if (details) {
      console.error(`[ERROR] Details: ${details}`);
    }
    if (error.stack) {
      console.error(`[ERROR] Stack: ${error.stack}`);
    }
  }

  /**
   * Safely reply to an interaction regardless of its current state
   * @param interaction The Discord interaction
   * @param message The error message to send
   * @param ephemeral Whether the response should be ephemeral
   */
  static async safeReply(interaction: Interaction, message: string, ephemeral: boolean = true): Promise<void> {
    try {
      if (!interaction.isRepliable()) return;

      if (interaction.replied) {
        await interaction.followUp({ content: message, ephemeral }).catch(() => { });
      }
      else if (interaction.deferred) {
        await interaction.editReply({ content: message }).catch(() => { });
      }
      else {
        await interaction.reply({ content: message, ephemeral }).catch(() => { });
      }
    } catch (error) {
      this.logError("Safe Reply", error, `Failed to reply to interaction ${interaction.id}`);
    }
  }

  /**
   * Handle command execution errors with proper response
   * @param interaction The Discord interaction
   * @param error The error object
   * @param context The command context
   */
  static async handleCommandError(interaction: any, error: any, context: string): Promise<void> {
    this.logError(`Command: ${context}`, error);
    await this.safeReply(interaction, "Произошла ошибка при выполнении команды. Пожалуйста, попробуйте позже.");
  }

  /**
   * Create a timeout promise that rejects after specified milliseconds
   * Useful for adding timeouts to database operations
   * @param ms Timeout in milliseconds
   */
  static timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
    });
  }

  /**
   * Execute an operation with a timeout
   * @param promise The promise to execute
   * @param ms Timeout in milliseconds
   * @param context Error context information
   */
  static async withTimeout<T>(promise: Promise<T>, ms: number, context: string): Promise<T> {
    try {
      return await Promise.race([
        promise,
        this.timeout(ms)
      ]);
    } catch (error) {
      this.logError(context, error, `Operation timed out after ${ms}ms`);
      throw error;
    }
  }
}
