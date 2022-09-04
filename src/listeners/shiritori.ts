import { Message } from "discord.js";
import { ShiritoriChannel } from "../database/models/ShiritoriChannel";
import { Bot } from "../bot";
import { ShiritoriWord } from "../database/models/ShiritoriWord";
import * as utils from "../utils";

// Tests a message for adhering to shiritori rules. Returns a string error
// on failure, otherwise returns undefined.
const testMessage = (
  message: Message,
  channel: ShiritoriChannel,
  lastWord: ShiritoriWord | null
): string | undefined => {
  const content = message.content.toLowerCase();

  // -- Shiritori rules
  // 1. Only one word and letters only!
  if (content.includes(" ") || !/^[a-z]+$/.test(content)) {
    return "post must be one word only and umm also only contain alphabetic characters.";
  }

  if (lastWord === null || channel.lastUser === null) {
    return;
  }

  // 2. No self-replying
  if (channel.lastUser.discordID === message.author.id) {
    return "you can't respond to yourself...";
  }

  // 3. Message starts with last message's last character (CHAIN-BREAKER)
  const expectedStartLetter = lastWord.word.at(lastWord.word.length - 1) ?? "";
  if (!content.startsWith(expectedStartLetter)) {
    return "get freaking shiritori'd";
  }
};

// -- TypeORM helpers
const addWord = async (
  channel: ShiritoriChannel,
  userDiscordID: string,
  word: string
): Promise<void> => {
  let wordEnt = await ShiritoriWord.findOne({
    where: { channel: { id: channel.id }, word: word },
    relations: { channel: true },
  });
  if (wordEnt === null) {
    wordEnt = new ShiritoriWord();
    wordEnt.word = word;
    wordEnt.occurrences = 0;
    channel.wordHistory.push(wordEnt);
  }

  wordEnt.occurrences += 1;
  await wordEnt.save();

  channel.lastUser = await utils.fetchCreateUser(userDiscordID);
  channel.lastWord = wordEnt;
  channel.chainWords.push(wordEnt);
  channel.chainLength += 1;
  await channel.save();

  return;
};

export default (bot: Bot): void => {
  const client = bot.client;

  client.on("messageCreate", async (message: Message) => {
    // Bots can't participate in Shiritori. T-T
    if (message.author.bot) return;

    // Find ShiritoriChannel in database
    const channel = await ShiritoriChannel.findOneBy({
      channelID: message.channelId,
    });
    if (channel === null) return;

    const user = await utils.fetchCreateUser(message.author.id);

    // Check validity of message
    const err = testMessage(message, channel, channel.lastWord);
    if (err !== undefined) {
      const pointPenalty = channel.chainLength * 1;

      // penalize user
      user.sockpoints -= pointPenalty;
      await user.save();

      // reset channel
      channel.chainWords = [];
      channel.chainLength = 0;
      channel.lastWord = null;
      channel.lastUser = null;
      await channel.save();

      // send response
      await message.react("❌");
      await message.reply(
        `<@${message.author.id}> broke the shiritori chain T-T\nthey lost: ${pointPenalty} sockpoints\nreason: ${err}\nthe chain was ${channel.chainWords.length} words long when SOMEONE broke it x.x`
      );

      return;
    }

    // Add word to chain
    await addWord(channel, message.author.id, message.content.toLowerCase());

    // Calculate point award
    const pointAward = Math.min(9, Math.floor(channel.chainLength / 3) + 1);
    user.sockpoints += pointAward;
    await user.save();

    // Send reactions
    await message.react("✅");
    await message.react(utils.numberToEmoji(pointAward));
  });
};
