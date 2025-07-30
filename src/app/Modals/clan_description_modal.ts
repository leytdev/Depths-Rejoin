import { ModalSubmitInteraction } from "discord.js";
import { handleClanDescriptionModal } from "./ModalHandlers";

export default {
  customId: "clan_description_modal",
  async run(interaction: ModalSubmitInteraction) {
    return handleClanDescriptionModal(interaction);
  }
};
