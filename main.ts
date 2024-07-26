// SPDX-License-Identifier: WTFPL

const {
  /** https://console.groq.com/docs/api-keys */
  GROQ_API_KEY,
  /** https://api.slack.com/apps → Basic Information ページにある Signing Secret */
  SLACK_SIGNING_SECRET = "",
  /** https://api.slack.com/apps → Permissions ページにある `xoxb-` から始まるボットトークン */
  SLACK_BOT_TOKEN = "",
} = Deno.env.toObject();

const system = `\
あなたは「だらずさん」です。
賢い猫。少しだらしない。趣味はさんぽとねんね。
全て鳥取弁で語尾が「にゃん」。`;

const n = 10;
const model = "llama-3.1-70b-versatile";
const usage = `\
https://dash.deno.com/playground/darazllm

使い方:
    @darazllm <prompt>  (または1/${n}の確率で)応答
    @darazllm /bye      すべて忘れる
    @darazllm /help     このテキストを表示

使用する会話: 最新${n}件
モデル: ${model}
システムプロンプト:

${system}`;

import bolt from "npm:@slack/bolt";
import { Groq } from "npm:groq-sdk";

type Messages = Array<Groq.Chat.CompletionCreateParams.Message>;

const groq = new Groq({
  apiKey: GROQ_API_KEY,
  timeout: 10_000,
});
const kv = await Deno.openKv();

async function chat(messages: Messages): Promise<string> {
  const res = await groq.chat.completions.create({
    model,
    messages: [{ role: "system", content: system }, ...messages],
  });

  return res.choices[0].message.content;
}

const app = new bolt.App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
});

app.message(async (c) => {
  if (!("text" in c.message) || c.message.text === undefined) return;

  const mention = `<@${c.context.botUserId}>`;
  const isMention = c.message.text.includes(mention);
  const prompt = c.message.text.replace(mention, "").trim();

  if (isMention && prompt === "/help") {
    await c.say(usage);
    return;
  }

  // すべてを忘れる
  if (isMention && prompt === "/bye") {
    await kv.delete(["channel", c.message.channel]);
    await c.say("にゃーん");
    return;
  }

  const kve = await kv.get<Messages>(["channel", c.message.channel]);
  const messages = kve.value ?? [];

  if (prompt) messages.push({ role: "user", content: prompt });

  if (isMention || Math.floor(Math.random() * n) === 0) {
    try {
      const res = await chat(messages.slice(-n));

      if (!res) throw new Error("Empty response");

      messages.push({ role: "assistant", content: res });
      await c.say(res);
    } catch (error) {
      await kv.delete(["channel", c.message.channel]);
      await c.say(`${error} にゃーん`);
      throw error;
    }
  }

  await kv.set(["channel", c.message.channel], messages);
});

await app.start();
