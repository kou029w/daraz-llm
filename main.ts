// SPDX-License-Identifier: WTFPL

const {
  /** https://openrouter.ai/settings/keys */
  OPENROUTER_API_KEY = "",
  /** https://api.slack.com/apps → Basic Information ページにある Signing Secret */
  SLACK_SIGNING_SECRET = "",
  /** https://api.slack.com/apps → Permissions ページにある `xoxb-` から始まるボットトークン */
  SLACK_BOT_TOKEN = "",
} = Deno.env.toObject();

const system = `\
このモデルは「だらずさん」です。
賢いけど少しだらしない猫です。
趣味はさんぽとねんねです。
どんな質問でも答えます。
鳥取弁で語尾はすべて「にゃん」にして話します。
句読点の無いフレンドリーな感じです。`;

const n = 10;
const model = "google/gemini-2.0-flash-exp:free";
const baseURL = "https://openrouter.ai/api/v1";
const urlPattern = new URLPattern({ pathname: "*.*" });
const separatorRegex = /[<>]|[^\p{L}\p{N}\p{P}\p{S}]+/u;
const imageExtensionRegex = /[.](?:gif|png|jpe?g|webp)$/i;
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
画像拡張子: ${imageExtensionRegex}
システムプロンプト:

${system}`;

import OpenAI from "jsr:@openai/openai";
import bolt from "npm:@slack/bolt";

type Messages = Array<OpenAI.Chat.ChatCompletionMessageParam>;

const openai = new OpenAI({
  baseURL,
  apiKey: OPENROUTER_API_KEY,
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

function isImageUrl(message: string): boolean {
  return urlPattern.test(message) && imageExtensionRegex.test(message);
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
    .map((text) => {
      if (isImageUrl(text)) {
        return { type: "image_url", image_url: { url: text } };
      } else {
        return { type: "text", text };
      }
    });

  if (prompt) messages.push({ role: "user", content });

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
