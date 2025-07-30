import { ModalSubmitInteraction } from "discord.js";
import { handleClanRenameModal } from "./ModalHandlers";

export default {
  customId: "clan_rename_modal",
  async run(interaction: ModalSubmitInteraction) {
    return handleClanRenameModal(interaction);
  }
};
