import { ColorResolvable, EmbedBuilder } from 'discord.js';

// Export types from Discord.js for consistent usage across the project
export { ColorResolvable, EmbedBuilder };

// Helper function to convert string to ColorResolvable safely
export function toColorResolvable(color: string | null | undefined): ColorResolvable {
  return (color || "#2f3136") as ColorResolvable;
}
