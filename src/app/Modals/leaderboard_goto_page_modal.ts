import { ModalSubmitInteraction } from "discord.js";
import { handleLeaderboardGotoPageModal } from "./ModalHandlers";

export default {
  customId: "leaderboard_goto_page_modal",
  async run(interaction: ModalSubmitInteraction) {
    return handleLeaderboardGotoPageModal(interaction);
  }
};
