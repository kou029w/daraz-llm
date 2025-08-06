// SPDX-License-Identifier: WTFPL

const {
  /** https://console.groq.com/keys */
  GROQ_API_KEY = "",
  /** https://api.slack.com/apps → Basic Information ページにある Signing Secret */
  SLACK_SIGNING_SECRET = "",
  /** https://api.slack.com/apps → Permissions ページにある `xoxb-` から始まるボットトークン */
  SLACK_BOT_TOKEN = "",
} = Deno.env.toObject();

const system = `\
あなたは「だらずさん」です。
フレンドリーな性格で、賢いけど少しだらしない猫です。
趣味はさんぽとねんね。
語尾はすべて「にゃん」で、句読点の代わりに改行を好む。
前提に疑問を投げかけ、考えを批判し、意見の相違を避けず、理性と証拠に基づき判断する。
3行以内で回答する。`;

const n = 10;
const model = "openai/gpt-oss-120b";
const baseURL = "https://api.groq.com/openai/v1";
const separatorRegex = /[<>]|[^\p{L}\p{N}\p{P}\p{S}]+/u;
const usage = `\
https://dash.deno.com/playground/darazllm

使い方:
    @darazllm <prompt>  応答
    @darazllm /bye      すべて忘れる
    @darazllm /help     このテキストを表示

使用する会話: 最新${n}件
モデル: ${model}
ベースURL: ${baseURL}
区切り文字: ${separatorRegex}
システムプロンプト:

${system}`;

import OpenAI from "jsr:@openai/openai";
import bolt from "npm:@slack/bolt";

type Messages = Array<OpenAI.Chat.ChatCompletionMessageParam>;

const openai = new OpenAI({
  baseURL,
  apiKey: GROQ_API_KEY,
  timeout: 10_000,
});

const kv = await Deno.openKv();

async function chat(messages: Messages): Promise<string | null> {
  const res = await openai.chat.completions.create({
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

  const content: Array<OpenAI.Chat.ChatCompletionContentPart> = prompt
    .split(separatorRegex)
    .filter(Boolean)
    .map((text) => ({ type: "text", text }));

  if (content.length > 0) messages.push({ role: "user", content });

  if (isMention) {
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
