import { ModalSubmitInteraction } from "discord.js";
import { handleClanIconModal } from "./ModalHandlers";

export default {
  customId: "clan_icon_modal",
  async run(interaction: ModalSubmitInteraction) {
    return handleClanIconModal(interaction);
  }
};
