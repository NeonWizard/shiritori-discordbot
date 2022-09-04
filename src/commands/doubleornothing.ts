import {
  AttachmentBuilder,
  CommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import path from "path";
import * as utils from "../utils";

export const builder = new SlashCommandBuilder()
  .setName("doubleornothing")
  .setDescription(
    "50% chance to double your points, 50% chance to lose your points"
  );

export const execute = async (interaction: CommandInteraction) => {
  const user = await utils.fetchCreateUser(interaction.user.id);

  if (user.sockpoints < 0) {
    await interaction.reply("brokeass. try again when you've paid your debt");
    return;
  }

  if (Math.random() < 0.5) {
    // -- Double
    const oldPoints = user.sockpoints;
    user.sockpoints *= 2;
    await user.save();

    await interaction.reply(
      `<@${interaction.user.id}> DOUBLED BABY!! ${oldPoints} -> ${user.sockpoints}`
    );
  } else {
    // -- Nothing
    user.sockpoints = 0;
    await user.save();

    const attachment = new AttachmentBuilder(
      path.join(__dirname, "../images/cry-man.gif")
    );
    await interaction.reply({ files: [attachment] });
  }
};
